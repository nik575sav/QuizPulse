import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DB_FILE = path.join(__dirname, "db.json");

// Simple JSON DB
let db = {
  users: {}, // id -> { id, username, role (organizer/participant) }
  quizzes: {}, // id -> { id, title, defaultTime, questions: [{id, text, image, type, options, correctOptionId}], organizerId }
  rooms: {}, // id -> { id, quizId, organizerId, state: 'waiting' | 'active' | 'finished', currentQuestionIndex: -1, participants: {}, results: {} }
};

if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    if (data.trim()) {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object') {
        db = {
          users: parsed.users || {},
          quizzes: parsed.quizzes || {},
          rooms: parsed.rooms || {},
        };
      }
    }
  } catch (e) {
    console.error("Error reading db", e);
  }
}
// Ensure integrity even after loading
db.users = db.users || {};
db.quizzes = db.quizzes || {};
db.rooms = db.rooms || {};

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
  });

  // Basic API
  app.post("/api/auth/register", (req, res) => {
    const { username, password } = req.body;
    if (Object.values(db.users).find((u: any) => u.username === username)) {
      return res.status(400).json({ error: "User already exists" });
    }
    const id = Date.now().toString();
    db.users[id] = { id, username, password, history: [] };
    saveDb();
    res.json(db.users[id]);
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = Object.values(db.users).find((u: any) => u.username === username && u.password === password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/users/:id/dashboard", (req, res) => {
    const user = db.users[req.params.id] as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const quizzes = Object.values(db.quizzes).filter((q: any) => q.organizerId === user.id);
    res.json({
      ...user,
      quizzes,
      history: user.history || []
    });
  });

  app.put("/api/quizzes/:id", (req, res) => {
    const { id } = req.params;
    if (!db.quizzes[id]) return res.status(404).json({ error: "Quiz not found" });
    
    db.quizzes[id] = {
      ...db.quizzes[id],
      ...req.body,
      id // ensure ID doesn't change
    };
    saveDb();
    res.json(db.quizzes[id]);
  });

  app.get("/api/users/:id", (req, res) => {
    const user = db.users[req.params.id];
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });

  app.post("/api/quizzes", (req, res) => {
    const quiz = {
      id: Date.now().toString(),
      ...req.body, // { title, questions, defaultTime, organizerId }
    };
    db.quizzes[quiz.id] = quiz;
    saveDb();
    res.json(quiz);
  });

  app.get("/api/quizzes/organizer/:orgId", (req, res) => {
    const orgQuizzes = Object.values(db.quizzes).filter(
      (q: any) => q.organizerId === req.params.orgId
    );
    res.json(orgQuizzes);
  });
  
  app.get("/api/quizzes/:id", (req, res) => {
    const quiz = db.quizzes[req.params.id];
    if (quiz) res.json(quiz);
    else res.status(404).json({ error: "Not found" });
  });

  app.post("/api/rooms", (req, res) => {
    const { quizId, organizerId } = req.body;
    // Generate a 4-digit code
    let code;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (db.rooms[code]);

    const room = {
      id: code,
      quizId,
      organizerId,
      state: "waiting", // waiting | active | showing_results | finished
      currentQuestionIndex: -1,
      startTime: null,
      participants: {}, // userId -> { username, score, answers: { questionId: optionId } }
      leaderboard: []
    };
    db.rooms[code] = room;
    saveDb();
    res.json(room);
  });

  function currentQuiz(room: any) {
    return db.quizzes[room.quizId] as any;
  }

  function setupQuestionTimeout(roomCode: string, question: any) {
    const room = db.rooms[roomCode];
    if (!room) return;
    
    // Clear any existing timeout for this room if we had one (usually handled by state machine)
    const timeLimit = (question.timeLimit || currentQuiz(room).defaultTime || 30) * 1000;
    
    setTimeout(() => {
      const currentRoom = db.rooms[roomCode];
      if (currentRoom && currentRoom.state === "active" && currentRoom.startTime === room.startTime) {
        currentRoom.state = "showing_results";
        saveDb();
        io.to(roomCode).emit("room_state", getRoomStateForClients(roomCode));
      }
    }, timeLimit + 1000); // Small buffer
  }

  // WebSockets
  io.on("connection", (socket) => {
    socket.on("join_room", ({ roomCode, userId, username }) => {
      socket.join(roomCode);
      const room = db.rooms[roomCode];
      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      const isOrganizer = room.organizerId === userId;
      const isRegisteredParticipant = !!room.participants[userId];

      if (room.state === "waiting") {
        // Anyone can join in waiting state (if they are not the organizer)
        if (!room.participants[userId] && !isOrganizer) {
          room.participants[userId] = { userId, username, score: 0, answers: {} };
          saveDb();
        }
        io.to(roomCode).emit("room_state", getRoomStateForClients(roomCode));
      } else {
        // In active/finished states, only allow recognized users (organizer or registered participants)
        if (isOrganizer || isRegisteredParticipant) {
          // If they are registered but userId is missing in the object (compatibility), fix it
          if (isRegisteredParticipant && !room.participants[userId].userId) {
            room.participants[userId].userId = userId;
          }
          // Send personalized state to the user who joined
          socket.emit("room_state", getRoomStateForClients(roomCode, isOrganizer, userId));
          // Also let the room know someone (re)joined if waiting? No, mostly for organizer
          if (isOrganizer) {
            socket.emit("org_room_state", getRoomStateForClients(roomCode, true));
          }
        } else {
          socket.emit("error", "Cannot join a quiz that has already started");
        }
      }
    });

    socket.on("organizer_action", ({ roomCode, action, data, userId }) => {
      const room = db.rooms[roomCode];
      if (!room || room.organizerId !== userId) return;

      if (action === "start_quiz") {
        room.state = "active";
        room.currentQuestionIndex = 0;
        room.startTime = Date.now();
        setupQuestionTimeout(roomCode, currentQuiz(room).questions[0]);
        saveDb();
        io.to(roomCode).emit("room_state", getRoomStateForClients(roomCode));
      } else if (action === "next_question") {
        const quiz = db.quizzes[room.quizId] as any;
        if (room.currentQuestionIndex < quiz.questions.length - 1) {
          room.currentQuestionIndex++;
          room.state = "active";
          room.startTime = Date.now();
          setupQuestionTimeout(roomCode, quiz.questions[room.currentQuestionIndex]);
        } else {
          room.state = "finished";
          calculateLeaderboard(roomCode);
          saveQuizHistory(roomCode);
        }
        saveDb();
        io.to(roomCode).emit("room_state", getRoomStateForClients(roomCode));
      } else if (action === "show_results") {
        room.state = "showing_results";
        saveDb();
        io.to(roomCode).emit("room_state", getRoomStateForClients(roomCode));
      } else if (action === "finish_quiz") {
        room.state = "finished";
        calculateLeaderboard(roomCode);
        saveQuizHistory(roomCode);
        saveDb();
        io.to(roomCode).emit("room_state", getRoomStateForClients(roomCode));
      }
    });

    socket.on("submit_answer", ({ roomCode, userId, answerId }) => {
      const room = db.rooms[roomCode];
      if (!room || (room.state !== "active" && room.state !== "showing_results")) return;
      const quiz: any = db.quizzes[room.quizId];
      if (!quiz) return;
      
      const p = room.participants[userId];
      if (p) {
        const qIndex = room.currentQuestionIndex;
        const q = quiz.questions[qIndex];
        
        // Prevent double answering if already stored
        if (p.answers[q.id]) return;

        p.answers[q.id] = answerId;
        
        if (
          (Array.isArray(q.correctOptionId) && Array.isArray(answerId) && 
           [...q.correctOptionId].sort().join() === [...answerId].sort().join()) ||
          (!Array.isArray(q.correctOptionId) && q.correctOptionId === answerId)
        ) {
          // simple score based on speed, max 1000 per question
          const timeTaken = Date.now() - room.startTime;
          const maxTimeInMs = (q.timeLimit || quiz.defaultTime || 30) * 1000;
          let points = 1000 - Math.floor((timeTaken / maxTimeInMs) * 500);
          if (points < 500) points = 500;
          if (timeTaken > maxTimeInMs) points = 0; // too late
          
          p.score += points;
        }
        saveDb();
        // Update organizer with participant count etc.
        io.to(roomCode).emit("org_room_state", getRoomStateForClients(roomCode, true));
      }
    });
  });

  function calculateLeaderboard(roomCode) {
    const room = db.rooms[roomCode];
    if (!room) return;
    const sorted = Object.values(room.participants).sort((a: any, b: any) => b.score - a.score).map((p: any) => ({
      username: p.username,
      score: p.score,
      userId: p.userId,
      answers: p.answers // Include answers for result comparison
    }));
    room.leaderboard = sorted;
  }

  function saveQuizHistory(roomCode) {
    const room = db.rooms[roomCode];
    if (!room) return;
    const quiz = db.quizzes[room.quizId] as any;
    
    const participantsList = Object.values(room.participants).sort((a: any, b: any) => b.score - a.score);
    const winners = participantsList.slice(0, 3).map((p: any) => ({
      username: p.username,
      score: p.score
    }));
    const date = Date.now();

    // Save to organizer history
    if (db.users[room.organizerId]) {
      if (!db.users[room.organizerId].history) db.users[room.organizerId].history = [];
      db.users[room.organizerId].history.unshift({
        id: roomCode,
        quizTitle: quiz?.title || "Deleted Quiz",
        date,
        participantsCount: participantsList.length,
        winners,
        type: 'hosted'
      });
    }

    // Save to each participant
    participantsList.forEach((p: any, index) => {
      const uid = p.userId;
      if (db.users[uid]) {
        if (!db.users[uid].history) db.users[uid].history = [];
        db.users[uid].history.unshift({
          id: roomCode,
          quizTitle: quiz?.title || "Deleted Quiz",
          date,
          score: p.score,
          rank: index + 1,
          totalParticipants: participantsList.length,
          isWinner: index === 0,
          type: 'played'
        });
      }
    });
  }

  function getRoomStateForClients(roomCode, forOrganizer = false, requestingUserId: string | null = null) {
    const room = db.rooms[roomCode];
    if (!room) return null;
    const quiz: any = db.quizzes[room.quizId];
    
    // safe quiz logic that doesn't leak answers to participants
    const safeQuiz = {
      title: quiz.title,
      questionsCount: quiz.questions.length,
      currentQuestion: null as any
    };

    if (room.currentQuestionIndex >= 0 && room.currentQuestionIndex < quiz.questions.length) {
      const q = quiz.questions[room.currentQuestionIndex];
      safeQuiz.currentQuestion = {
        id: q.id,
        text: q.text,
        image: q.image,
        type: q.type, // 'single_choice' | 'multi_choice'
        options: q.options, // list of items
        timeLimit: q.timeLimit || quiz.defaultTime || 30,
        startTime: room.startTime
      };
      
      // If showing results or organizer, include the correct answer
      if (room.state === "showing_results" || forOrganizer) {
        safeQuiz.currentQuestion.correctOptionId = q.correctOptionId;
      }
    }

    // Scoped participants:
    // Organizer/Finished/Results: see all answers
    // Active: see only own answers, other participants have empty answers list
    const participants = {};
    Object.entries(room.participants).forEach(([uid, p]: [string, any]) => {
      const shouldShowAnswers = forOrganizer || room.state === 'finished' || room.state === 'showing_results' || uid === requestingUserId;
      participants[uid] = {
        ...p,
        answers: shouldShowAnswers ? p.answers : {}
      };
    });

    return {
      id: room.id,
      organizerId: room.organizerId,
      state: room.state, // waiting, active, showing_results, finished
      participants: (room.state === 'waiting') ? null : participants,
      participantCount: Object.keys(room.participants).length,
      leaderboard: room.leaderboard,
      quiz: safeQuiz
    };
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // For express v5 we use *all, for v4 *
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

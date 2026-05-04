import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/auth";
import { Button } from "../components/ui/button";

// Optional: DiceBear avatars for leaderboard
const getAvatarUrl = (seed: string) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;

export default function QuizRoom() {
  const { code } = useParams();
  const user = useAuthStore((state) => state.user);
  const mode = useAuthStore((state) => state.mode);
  const navigate = useNavigate();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomState, setRoomState] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<any>(null);
  const [localAnswer, setLocalAnswer] = useState<any>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const newSocket = io("/", { transports: ["websocket", "polling"] });
    setSocket(newSocket);

    newSocket.emit("join_room", { roomCode: code, userId: user.id, username: user.username });

    newSocket.on("room_state", (state: any) => {
      setRoomState((prev: any) => {
        const isNewQuestion = prev?.quiz?.currentQuestion?.id !== state.quiz?.currentQuestion?.id;
        const isNewActivePhase = state.state === 'active' && prev?.state !== 'active';
        
        if (isNewQuestion || isNewActivePhase) {
          setLocalAnswer(null);
          setIsSubmitted(false);
        }

        return state;
      });
      
      if (state.state === 'active' && state.quiz?.currentQuestion) {
        setupTimer(state.quiz.currentQuestion.startTime, state.quiz.currentQuestion.timeLimit);
      } else {
        clearInterval(timerRef.current);
        setTimeLeft(0);
      }
    });
    
    newSocket.on("org_room_state", (state: any) => {
      if (mode === 'organizer') setRoomState(state);
    });

    newSocket.on("error", (msg) => {
      alert(msg);
      navigate("/");
    });

    return () => {
      newSocket.close();
      clearInterval(timerRef.current);
    };
  }, [code, user, navigate, mode]);

  // Sync answer from server if missing locally or if server record exists (e.g. after refresh or late state update)
  useEffect(() => {
    if ((roomState?.state === 'active' || roomState?.state === 'showing_results') && roomState?.quiz?.currentQuestion) {
      const myAnswer = roomState.participants?.[user?.id]?.answers?.[roomState.quiz.currentQuestion.id];
      if (myAnswer) {
        // Only sync if local is null OR if we are in results phase (server is source of truth then)
        if (!localAnswer || roomState.state === 'showing_results') {
          setLocalAnswer(myAnswer);
          setIsSubmitted(true);
        }
      }
    }
  }, [roomState, user?.id, localAnswer]);

  const setupTimer = (startTime: number, timeLimit: number) => {
    clearInterval(timerRef.current);
    const updateTime = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rem = Math.max(0, timeLimit - elapsed);
      setTimeLeft(Math.ceil(rem));
      if (rem <= 0) {
        clearInterval(timerRef.current);
        // Server handles auto-switch, but organizer can trigger if needed
        if (mode === 'organizer' && roomState?.state === 'active') {
          // handleOrgAction("show_results"); // Server handles this now automatically
        }
      }
    };
    updateTime();
    timerRef.current = setInterval(updateTime, 1000);
  };

  const handleOrgAction = (action: string) => {
    socket?.emit("organizer_action", { roomCode: code, action, userId: user?.id });
  };

  const submitAnswer = () => {
    if (!localAnswer || isSubmitted) return;
    socket?.emit("submit_answer", { roomCode: code, userId: user?.id, answerId: localAnswer });
    setIsSubmitted(true);
  };

  const isMultiChoiceQuestion = (type: string) => type === "multi" || type === "multi_choice";

  if (!roomState) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F0F4FF]"><div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  }

  const isOrganizer = mode === "organizer" || roomState?.organizerId === user?.id;
  const { state: currentPhase, quiz, participants, leaderboard } = roomState;

  // Render Organizer View
  if (isOrganizer) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] p-4 flex flex-col font-sans">
        <div className="max-w-5xl mx-auto w-full bg-white shadow-xl shadow-indigo-100/50 rounded-[2.5rem] flex-1 flex flex-col overflow-hidden border-4 border-white my-4 relative">
          
          <div className="flex justify-between items-center bg-indigo-50 px-8 py-6 border-b border-indigo-100 z-10 relative">
            <div>
              <div className="bg-white text-indigo-600 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-100 mb-2 inline-block">LIVE SESSION</div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">{quiz.title}</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Room Code</span>
                <span className="font-mono text-indigo-600 font-black text-3xl tracking-[0.2em]">{code}</span>
              </div>
              <div className="text-center bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-[0_4px_0_#4F46E5]">
                <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest block mb-1">Players</span>
                <span className="font-black text-3xl">{roomState.participantCount}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 p-8 pb-12 flex flex-col relative z-10">
            {currentPhase === "waiting" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-32 h-32 bg-indigo-100 rounded-[2rem] flex items-center justify-center text-indigo-500 mb-8 -rotate-6">
                  <svg className="w-16 h-16 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h2 className="text-4xl font-black mb-4 text-slate-800">Waiting for players...</h2>
                <p className="text-xl text-slate-500 font-medium mb-12">Ask participants to join at <span className="font-bold text-slate-700">{window.location.origin}</span> and enter code <span className="font-bold text-indigo-600">{code}</span></p>
                <Button size="lg" className="w-64" onClick={() => handleOrgAction("start_quiz")}>START EXACTLY NOW</Button>
              </div>
            )}

            {currentPhase === "active" && quiz.currentQuestion && (
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-8">
                  <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-sm">
                    Question {roomState.currentQuestionIndex !== undefined ? roomState.currentQuestionIndex + 1 : '?'}
                  </div>
                  <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center border-4 relative ${timeLeft <= 5 ? 'border-rose-500 bg-rose-50 text-rose-600 animate-pulse' : 'border-slate-200 bg-white text-slate-800'}`}>
                    <span className="font-black text-4xl">{timeLeft}</span>
                    <span className="absolute -bottom-3 bg-white px-2 text-xs font-bold uppercase tracking-widest text-slate-400 rounded-full border border-slate-200">SEC</span>
                  </div>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-black mb-8 text-center text-slate-800 leading-tight">
                  {quiz.currentQuestion.text}
                </h2>
                
                {quiz.currentQuestion.image && (
                  <div className="max-w-2xl mx-auto mb-8 w-full">
                     <img src={quiz.currentQuestion.image} className="w-full h-64 object-cover rounded-[2rem] border-4 border-slate-100 shadow-md" />
                  </div>
                )}
                
                <div className="mt-8 flex justify-center mt-auto">
                  <Button size="lg" variant="outline" className="text-rose-500 border-rose-200 hover:bg-rose-50 hover:border-rose-300" onClick={() => handleOrgAction("show_results")}>
                    STOP TIMER & SHOW RESULTS
                  </Button>
                </div>
              </div>
            )}

            {currentPhase === "showing_results" && quiz.currentQuestion && (
              <div className="flex-1 flex flex-col items-center">
                <div className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl font-bold uppercase tracking-widest text-sm mb-6">
                  Times Up! Results
                </div>
                <p className="text-2xl font-black mb-8 text-center text-slate-800 max-w-3xl">{quiz.currentQuestion.text}</p>
                
                <div className="grid gap-4 w-full max-w-2xl mx-auto mb-12">
                  {quiz.currentQuestion.options.map((opt: any, i: number) => {
                    const isCorrect = Array.isArray(quiz.currentQuestion.correctOptionId) 
                      ? quiz.currentQuestion.correctOptionId.includes(opt.id)
                      : quiz.currentQuestion.correctOptionId === opt.id;
                    
                    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                    return (
                      <div key={opt.id} className={`flex items-center gap-4 p-5 rounded-[1.5rem] font-bold text-lg border-4 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-400 text-emerald-800 transform scale-[1.02]' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${isCorrect ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          {isCorrect ? '✓' : letters[i] || '-'}
                        </div>
                        {opt.text}
                      </div>
                    );
                  })}
                </div>

                <Button size="lg" className="w-64" onClick={() => handleOrgAction("next_question")}>
                  NEXT QUESTION &rarr;
                </Button>
              </div>
            )}

            {currentPhase === "finished" && leaderboard && (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="text-6xl mb-4 text-center">🏆</div>
                <h2 className="text-4xl font-black mb-2 text-center text-slate-800 uppercase tracking-tight">Final Leaderboard</h2>
                <p className="text-slate-500 font-medium mb-10">The quiz has ended. Here are your winners!</p>

                <div className="w-full max-w-xl mx-auto space-y-4">
                  {leaderboard.map((lp: any, i: number) => {
                    let rankStyle = "bg-white border-slate-200 text-slate-600";
                    let rankBg = "bg-slate-100";
                    if (i === 0) { rankStyle = "bg-[#FFF9C4] border-[#FBC02D] text-[#F57F17] transform scale-105 shadow-md relative z-10"; rankBg = "bg-[#FBC02D] text-white"; }
                    else if (i === 1) { rankStyle = "bg-slate-100 border-slate-300 text-slate-700"; rankBg = "bg-slate-400 text-white"; }
                    else if (i === 2) { rankStyle = "bg-[#FFCC80] border-[#F57C00] text-[#E65100] opacity-90"; rankBg = "bg-[#F57C00] text-white"; }

                    // We compute the percentage width for a bar purely for visual effect if we want, but doing simple list here
                    return (
                      <div key={i} className={`flex items-center gap-4 p-4 rounded-[1.5rem] border-4 ${rankStyle}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${rankBg}`}>
                          {i + 1}
                        </div>
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 bg-white">
                          <img src={getAvatarUrl(lp.username)} alt="avatar" />
                        </div>
                        <span className="font-black text-xl flex-1">{lp.username}</span>
                        <span className="font-black text-2xl">{lp.score} <span className="text-sm opacity-60 uppercase tracking-widest">pts</span></span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-12 text-center">
                  <Button variant="outline" className="w-64" onClick={() => navigate("/")}>EXIT TO DASHBOARD</Button>
                </div>
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        </div>
      </div>
    );
  }

  // Render Participant View
  return (
    <div className="min-h-screen bg-indigo-600 p-4 sm:p-6 flex flex-col justify-center relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] left-[-10%] w-[140%] h-[140%] bg-gradient-to-br from-indigo-500 to-purple-700 pointer-events-none z-0"></div>
      
      <div className="max-w-md w-full mx-auto bg-white rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[500px] flex flex-col relative z-10 border-4 border-white/20">
        
        {currentPhase === "waiting" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="w-24 h-24 rounded-full border-4 border-indigo-100 overflow-hidden bg-white mb-6 shadow-sm">
              <img src={getAvatarUrl(user.username)} alt="avatar" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">You're in!</h2>
            <p className="text-slate-500 font-bold mb-12 uppercase tracking-widest text-sm">Waiting for host</p>
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
              <div className="w-1/3 h-full bg-indigo-500 rounded-full animate-[wiggle_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
        )}

        {currentPhase === "active" && quiz.currentQuestion && (
          <div className="p-6 flex flex-col flex-1">
            <div className="flex justify-between items-center mb-6">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 line-clamp-1 max-w-[60%]">{quiz.title}</div>
              <div className={`font-black text-2xl w-14 h-14 flex items-center justify-center rounded-2xl border-4 ${timeLeft <= 5 ? 'border-rose-500 bg-rose-50 text-rose-600 animate-pulse' : 'border-slate-200 bg-white text-slate-700 shadow-sm'}`}>
                {timeLeft}
              </div>
            </div>
            
            <h2 className="text-2xl font-black text-slate-800 mb-6 leading-tight flex-1">{quiz.currentQuestion.text}</h2>
            {quiz.currentQuestion.image && <img src={quiz.currentQuestion.image} className="w-full h-48 object-cover rounded-[2rem] mb-6 border-4 border-slate-100" />}
            
            <div className="grid gap-3 flex-none content-center">
              {quiz.currentQuestion.options.map((opt: any) => {
                const isMulti = isMultiChoiceQuestion(quiz.currentQuestion.type);
                const isSelected = isMulti ? !!(localAnswer as string[])?.includes(opt.id) : localAnswer === opt.id;
                
                return (
                  <button
                    key={opt.id}
                    disabled={isSubmitted}
                    onClick={() => {
                      if (isSubmitted) return;
                      if (isMulti) {
                        const arr = Array.isArray(localAnswer) ? [...localAnswer] : [];
                        setLocalAnswer(arr.includes(opt.id) ? arr.filter(x => x !== opt.id) : [...arr, opt.id]);
                      } else {
                        setLocalAnswer(opt.id);
                        socket?.emit("submit_answer", { roomCode: code, userId: user?.id, answerId: opt.id });
                        setIsSubmitted(true);
                      }
                    }}
                    className={`w-full p-5 rounded-[1.5rem] text-left font-black text-lg transition-transform active:scale-95 border-b-4 ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-800 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    } ${isSubmitted ? 'opacity-80 cursor-not-allowed active:scale-100' : ''}`}
                  >
                    {opt.text}
                  </button>
                )
              })}
            </div>
            
            <Button 
              size="lg" 
              className={`w-full mt-6 shadow-[0_4px_0_#4F46E5] uppercase tracking-widest ${isSubmitted ? 'bg-emerald-500 shadow-[0_4px_0_#059669]' : ''}`} 
              onClick={submitAnswer} 
              disabled={isSubmitted || !localAnswer || (Array.isArray(localAnswer) && localAnswer.length===0)}
            >
              {isSubmitted ? "Submitted! 👍" : "Submit"}
            </Button>
          </div>
        )}

        {currentPhase === "showing_results" && quiz.currentQuestion && (
          <div className="p-6 flex flex-col flex-1 bg-slate-50 overflow-y-auto">
            <div className="text-center mb-6">
              <div className="inline-block px-4 py-2 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs mb-4 shadow-sm">
                Question Results
              </div>
              <h2 className="text-xl font-black text-slate-800 leading-tight mb-2 leading-relaxed">{quiz.currentQuestion.text}</h2>
              {(!localAnswer || (Array.isArray(localAnswer) && localAnswer.length === 0)) && (
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">You didn't answer in time!</p>
              )}
            </div>
            
            <div className="grid gap-3 flex-1 content-center">
              {quiz.currentQuestion.options.map((opt: any) => {
                const isMulti = isMultiChoiceQuestion(quiz.currentQuestion.type);
                const isSelected = isMulti ? !!(localAnswer as string[])?.includes(opt.id) : localAnswer === opt.id;
                
                const isCorrect = Array.isArray(quiz.currentQuestion.correctOptionId)
                  ? quiz.currentQuestion.correctOptionId.includes(opt.id)
                  : quiz.currentQuestion.correctOptionId === opt.id;

                let stateClass = "bg-white border-slate-100 text-slate-400 opacity-60 scale-95 flex-col items-start";
                let badge = null;
                
                if (isCorrect && isSelected) {
                  stateClass = "bg-emerald-500 border-emerald-700 text-white shadow-lg scale-100 opacity-100";
                  badge = <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider">Correct Pick ✅</span>;
                } else if (isCorrect) {
                  stateClass = "bg-emerald-50 border-emerald-400 border-dashed text-emerald-800 opacity-100 scale-100";
                  badge = <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded uppercase tracking-wider">Correct Answer ⭕</span>;
                } else if (isSelected && !isCorrect) {
                  stateClass = "bg-rose-500 border-rose-700 text-white shadow-md opacity-100 scale-100";
                  badge = <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider">Your Wrong Pick ❌</span>;
                }

                return (
                  <div
                    key={opt.id}
                    className={`w-full p-4 rounded-2xl font-black text-lg border-b-4 transition-all flex flex-col gap-1 items-start ${stateClass}`}
                  >
                    <div className="flex w-full justify-between items-center">
                      <span className="flex-1 pr-2">{opt.text}</span>
                      {badge}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-white border-2 border-indigo-100 border-dashed text-center">
              <p className="font-bold text-indigo-600 uppercase tracking-widest text-[10px] animate-pulse">
                Next question starting soon...
              </p>
            </div>
          </div>
        )}

        {currentPhase === "finished" && (
          <div className="flex-1 flex flex-col p-6 bg-indigo-50 overflow-y-auto">
            <div className="text-center mb-8">
              {(() => {
                const myRank = leaderboard?.findIndex((lp: any) => lp.userId === user.id) ?? -1;
                const isWinner = myRank === 0;
                
                return (
                  <>
                    <div className="text-7xl mb-4 animate-bounce">
                      {isWinner ? "👑" : "👏"}
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tight leading-none mb-2">
                      {isWinner ? "YOU WIN!" : "WELL PLAYED!"}
                    </h2>
                    <p className="font-black text-indigo-600 uppercase tracking-[0.2em] text-sm mb-4">
                      {isWinner ? "Master of Quiz" : `Finished #${myRank + 1} Overall`}
                    </p>
                  </>
                );
              })()}
              
              <div className="mt-4 inline-block px-6 py-2 bg-white rounded-2xl text-xs font-black text-slate-500 border-2 border-indigo-100 shadow-sm uppercase tracking-widest">
                Final Leaderboard
              </div>
            </div>

            <div className="space-y-3 mb-8">
              {leaderboard?.map((lp: any, i: number) => {
                const isMe = lp.userId === user.id;
                let rankColor = "bg-white border-slate-200 text-slate-600 opacity-80 scale-95";
                let emoji = "👤";
                
                if (i === 0) { rankColor = "bg-amber-100 border-amber-300 text-amber-900 scale-100 opacity-100"; emoji = "🥇"; }
                else if (i === 1) { rankColor = "bg-slate-100 border-slate-300 text-slate-800 scale-100 opacity-100"; emoji = "🥈"; }
                else if (i === 2) { rankColor = "bg-orange-100 border-orange-300 text-orange-900 scale-100 opacity-100"; emoji = "🥉"; }
                else if (isMe) { rankColor = "bg-indigo-50 border-indigo-300 text-indigo-900 scale-100 opacity-100"; }

                return (
                  <div key={i} className={`flex items-center gap-3 p-4 rounded-[1.5rem] border-b-4 transition-all ${rankColor} ${isMe ? 'ring-4 ring-indigo-400 ring-offset-2' : ''}`}>
                    <div className="w-8 h-8 rounded-lg bg-black/10 flex items-center justify-center font-black text-sm">
                      {i + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50 shadow-sm bg-white">
                      <img src={getAvatarUrl(lp.username)} alt="avatar" />
                    </div>
                    <div className="flex-1 truncate">
                      <span className="font-black block">{lp.username}</span>
                      {isMe && <span className="text-[8px] uppercase font-black tracking-widest opacity-60">You</span>}
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xl leading-none">{lp.score}</span>
                      <p className="text-[8px] uppercase font-black opacity-40">pts</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-auto">
              <Button 
                className="w-full bg-slate-900 shadow-[0_4px_0_#000] text-white h-16 text-lg font-black tracking-widest uppercase" 
                onClick={() => navigate("/")}
              >
                RETURN TO LOBBY &rarr;
              </Button>
            </div>
          </div>
        )}
        
        {/* Decorative footer */}
        <div className="h-3 w-full bg-indigo-400 opacity-50"></div>
      </div>
    </div>
  );
}

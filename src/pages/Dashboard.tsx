import { useAuthStore } from "../store/auth";
import { Button } from "../components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Input } from "../components/ui/input";

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const mode = useAuthStore((state) => state.mode);
  const setMode = useAuthStore((state) => state.setMode);
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [joinCode, setJoinCode] = useState("");

  const [history, setHistory] = useState<any[]>([]);
  const hostedHistory = history.filter(h => h.type === 'hosted');
  const playedHistory = history.filter(h => h.type === 'played');

  useEffect(() => {
    if (!user) return;
    
    // Fetch full dashboard data
    fetch(`/api/users/${user.id}/dashboard`)
      .then((res) => res.json())
      .then((data) => {
        if (data.history) setHistory(data.history);
        if (data.quizzes) setQuizzes(data.quizzes);
      })
      .catch(console.error);
  }, [user]);

  const handleStartQuiz = async (quizId: string) => {
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, organizerId: user?.id }),
      });
      const room = await res.json();
      navigate(`/room/${room.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditQuiz = (quiz: any) => {
    navigate("/create-quiz", { state: { quiz } });
  };

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/room/${joinCode.trim()}`);
    }
  };

  if (!user) return null;

  if (!mode) {
    return (
      <div className="min-h-screen bg-[#F0F4FF] flex flex-col items-center justify-center p-6 bg-dots">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-5xl shadow-2xl shadow-indigo-200 -rotate-6 mb-8">Q!</div>
        <h1 className="text-4xl font-black text-slate-900 mb-2 uppercase tracking-tight">Choose Your Path</h1>
        <p className="text-slate-500 font-medium mb-12">How do you want to experience QuizPulse today?</p>
        
        <div className="grid sm:grid-cols-2 gap-8 w-full max-w-2xl">
          <button 
            onClick={() => setMode('participant')}
            className="group relative bg-white p-10 rounded-[3rem] shadow-xl shadow-indigo-100/50 border-4 border-white hover:border-indigo-600 transition-all hover:scale-105"
          >
            <div className="text-7xl mb-6 transform group-hover:scale-125 transition-transform">🎮</div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase">Participant</h3>
            <p className="text-slate-400 font-bold text-sm">Join live games and win</p>
          </button>

          <button 
            onClick={() => setMode('organizer')}
            className="group relative bg-white p-10 rounded-[3rem] shadow-xl shadow-indigo-100/50 border-4 border-white hover:border-indigo-600 transition-all hover:scale-105"
          >
            <div className="text-7xl mb-6 transform group-hover:scale-125 transition-transform">🧑‍🏫</div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase">Host</h3>
            <p className="text-slate-400 font-bold text-sm">Create and run live quizzes</p>
          </button>
        </div>
        
        <Button variant="ghost" onClick={logout} className="mt-12 text-slate-400 font-bold uppercase tracking-widest text-xs hover:text-rose-500">
           Sign out of {user.username}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F4FF] flex flex-col font-sans">
      <header className="bg-white shadow-sm border-b border-indigo-100 rounded-b-[2rem] mx-4 mt-2 mb-6">
        <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-2xl -rotate-3 cursor-pointer" onClick={() => setMode(null as any)}>Q!</div>
            <h1 className="text-2xl font-black text-indigo-900 tracking-tight cursor-pointer" onClick={() => setMode(null as any)}>QuizPulse</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800">{user.username}</span>
              <span className="text-[10px] uppercase font-black tracking-wider bg-indigo-100 text-indigo-700 px-2 py-1 rounded-md">{mode}</span>
            </div>
            <Button variant="ghost" onClick={() => setMode(null as any)} className="font-bold text-indigo-600 hover:bg-indigo-50 px-3">
              Switch
            </Button>
            <Button variant="ghost" onClick={logout} className="font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 px-3">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-12 w-full flex-1">
        {mode === "organizer" ? (
          <div className="space-y-8 mb-12">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Your Quizzes</h2>
              <Link to="/create-quiz">
                <Button className="shadow-[0_4px_0_#4F46E5] uppercase font-black tracking-widest text-xs">CREATE NEW QUIZ</Button>
              </Link>
            </div>

            {quizzes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-[2rem] border-4 border-slate-200 border-dashed">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Quizzes Yet</h3>
                <p className="text-slate-500 mb-6 font-medium">Create your first awesome quiz and share it with the world!</p>
                <Link to="/create-quiz">
                  <Button className="shadow-[0_4px_0_#4F46E5]">CREATE NOW</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {quizzes.map((q, i) => {
                  const colors = ['border-emerald-400', 'border-amber-400', 'border-rose-400', 'border-indigo-400', 'border-purple-400'];
                  const colorClass = colors[i % colors.length];
                  return (
                    <div key={q.id} className={`vibrant-card bg-white p-6 border-b-4 ${colorClass} shadow-sm flex flex-col`}>
                      <h3 className="font-black text-xl text-slate-900 mb-2 line-clamp-2">{q.title}</h3>
                      <p className="font-semibold text-slate-400 mb-6">{q.questions?.length || 0} Questions</p>
                      <div className="mt-auto flex gap-2">
                        <Button onClick={() => handleStartQuiz(q.id)} className="flex-1 bg-indigo-600 text-white shadow-none text-xs font-black tracking-widest">HOST</Button>
                        <Button onClick={() => handleEditQuiz(q)} variant="outline" className="flex-1 border-slate-200 text-slate-600 text-xs font-black tracking-widest">EDIT</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {hostedHistory.length > 0 && (
              <div className="mt-12 pt-8">
                <h3 className="font-black text-slate-800 text-xl mb-6 uppercase tracking-widest text-sm flex items-center gap-2">
                  <span className="w-8 h-1 bg-indigo-600 rounded-full"></span> Hosted History
                </h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {hostedHistory.map((h, i) => (
                    <div key={i} className="vibrant-card bg-white p-6 shadow-sm border border-slate-100 flex flex-col gap-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-black text-slate-800 text-lg">{h.quizTitle}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(h.date).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-indigo-50 px-3 py-2 rounded-xl text-center border border-indigo-100">
                          <p className="font-black text-indigo-600 text-xl leading-none">{h.participantsCount}</p>
                          <p className="text-[8px] uppercase font-black text-indigo-400 tracking-[0.1em] mt-1">Players</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Final Winners & Scores</p>
                        <div className="flex flex-wrap gap-2">
                          {h.winners?.length > 0 ? h.winners.map((winner: any, wi: number) => (
                            <span key={wi} className="bg-white border border-slate-200 px-3 py-1 rounded-xl text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1">
                              <span className="text-indigo-600 font-black">{wi === 0 ? "🥇" : (wi === 1 ? "🥈" : "🥉")}</span>
                              <span className="max-w-[100px] truncate">{winner.username || winner}</span>
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-black">{winner.score ?? '?'}</span>
                            </span>
                          )) : <span className="text-xs font-bold text-slate-400 italic">No one joined</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto mt-4 px-2">
            <section className="bg-indigo-600 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
              <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center justify-between">
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">Ready to Play?</h2>
                  <p className="text-indigo-100 font-medium mb-8 text-lg">Enter the room code provided by your host to join the live session.</p>
                  <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto md:mx-0">
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      className="flex-1 py-4 px-6 rounded-2xl text-slate-900 font-black text-2xl tracking-[0.25em] text-center sm:text-left uppercase h-16 border-4 focus:ring-8 focus:ring-white/20 focus:border-white"
                      maxLength={4}
                    />
                    <Button type="submit" variant="play" className="h-16 px-10">JOIN</Button>
                  </form>
                </div>
                <div className="hidden md:block text-9xl transform rotate-12 drop-shadow-2xl opacity-90">
                  🎮
                </div>
              </div>
              <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl"></div>
            </section>

            {playedHistory.length > 0 && (
              <div className="mt-12">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm mb-6 px-4 flex items-center gap-2">
                   <span className="w-8 h-1 bg-amber-500 rounded-full"></span> My Playing History
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {playedHistory.map((h, i) => (
                    <div key={i} className={`vibrant-card bg-white p-6 rounded-[2rem] shadow-sm border-2 flex justify-between items-center transition-all ${h.isWinner ? 'border-amber-400 bg-amber-50/20' : 'border-slate-100'}`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {h.isWinner && <span className="bg-amber-400 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">🏆 Winner</span>}
                          <p className="font-black text-slate-800 text-lg line-clamp-1">{h.quizTitle}</p>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{new Date(h.date).toLocaleDateString()} • {h.totalParticipants || '?'} PLAYERS</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-indigo-600 text-xl leading-none">{h.score}</p>
                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mt-1">
                          #{h.rank} PLACE
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

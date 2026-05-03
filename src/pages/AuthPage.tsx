import type { FormEvent } from "react";
import { useState } from "react";
import { useAuthStore } from "../store/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setError("");

    try {
      if (isRegistering) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (res.ok) login(data);
        else setError(data.error || "Registration failed");
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (res.ok) {
          login(data);
        } else {
          setError(data.error || "Login failed");
        }
      }
    } catch (e) {
      console.error(e);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#F0F4FF] p-6 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl mix-blend-multiply"></div>
      <div className="absolute -bottom-20 left-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl mix-blend-multiply"></div>
      
      <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 shadow-xl shadow-indigo-100/50 border-4 border-indigo-50 relative z-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-4xl shadow-lg shadow-indigo-200 -rotate-3">Q!</div>
        </div>
        <h1 className="mb-2 text-3xl font-black text-center text-slate-900 tracking-tight">QuizPulse</h1>
        <p className="text-center text-slate-500 mb-8 font-medium">
          {isRegistering ? "Create your account" : "Welcome back!"}
        </p>
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-700 text-sm font-bold animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Username</label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              required
              className="h-14 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="h-14 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:border-indigo-600"
            />
          </div>

          <Button type="submit" size="lg" className="w-full mt-4 h-14 text-lg font-black shadow-[0_6px_0_#4338CA] active:shadow-none active:translate-y-[2px] rounded-2xl">
            {isRegistering ? "CREATE ACCOUNT" : "SIGN IN"} &rarr;
          </Button>

          <div className="text-center">
            <button 
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="text-slate-400 font-bold hover:text-indigo-600 text-sm transition-colors"
            >
              {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

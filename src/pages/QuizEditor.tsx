import { useState, useEffect } from "react";
import { useAuthStore } from "../store/auth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export default function QuizEditor() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();
  const existingQuiz = location.state?.quiz;
  
  const [title, setTitle] = useState(existingQuiz?.title || "");
  const [defaultTime, setDefaultTime] = useState(existingQuiz?.defaultTime || 30);
  const [questions, setQuestions] = useState<any[]>(existingQuiz?.questions || []);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now().toString(),
        text: "",
        image: "",
        type: "single",
        options: [
          { id: "1", text: "" },
          { id: "2", text: "" }
        ],
        correctOptionId: "1",
        timeLimit: defaultTime,
      }
    ]);
  };

  const updateQuestion = (index: number, updates: any) => {
    const newQ = [...questions];
    newQ[index] = { ...newQ[index], ...updates };
    setQuestions(newQ);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title) return alert("Title is required");
    if (questions.length === 0) return alert("Add at least one question");

    const payload = {
      title,
      defaultTime,
      questions,
      organizerId: user?.id,
    };

    try {
      if (existingQuiz) {
        await fetch(`/api/quizzes/${existingQuiz.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch("/api/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
      navigate("/");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4FF] flex flex-col font-sans">
      <header className="bg-white shadow-sm border-b border-indigo-100 rounded-b-[2rem] mx-4 mt-2 mb-6 sticky top-2 z-10">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{existingQuiz ? "Edit Quiz" : "Create Quiz"}</h1>
          </div>
          <Button onClick={handleSave} className="shadow-[0_4px_0_#4F46E5] font-black tracking-widest uppercase text-xs">SAVE & FINISH</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl w-full px-4 pb-12 flex-1">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 mb-8 border-b-4 border-indigo-400">
          <h2 className="text-xl font-black mb-6 text-slate-800 uppercase tracking-wide">Quiz Settings</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Quiz Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. History Trivia" className="font-bold text-lg" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Default Time per Question (sec)</label>
              <Input type="number" value={defaultTime} onChange={e => setDefaultTime(Number(e.target.value))} className="font-bold text-lg" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((q, qIndex) => (
            <div key={q.id} className="vibrant-card bg-white p-8 border-b-4 border-amber-400 relative group">
              <button 
                onClick={() => removeQuestion(qIndex)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <div className="flex gap-4 items-center mb-6">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 font-black text-xl">
                  {qIndex + 1}
                </div>
                <select 
                  className="h-12 border-2 border-slate-200 rounded-xl px-4 font-bold text-slate-700 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400"
                  value={q.type} 
                  onChange={e => {
                    const newType = e.target.value;
                    const newCorrect = newType === "multi" ? (Array.isArray(q.correctOptionId) ? q.correctOptionId : [q.correctOptionId]) : (Array.isArray(q.correctOptionId) ? q.correctOptionId[0] : q.correctOptionId);
                    updateQuestion(qIndex, { type: newType, correctOptionId: newCorrect });
                  }}
                >
                  <option value="single">Single Choice</option>
                  <option value="multi">Multiple Choice</option>
                </select>
                <div className="flex items-center gap-3 ml-auto mr-12 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Time (s)</label>
                  <Input type="number" className="w-20 h-10 text-center px-2" value={q.timeLimit} onChange={e => updateQuestion(qIndex, { timeLimit: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Question Text</label>
                  <Input value={q.text} onChange={e => updateQuestion(qIndex, { text: e.target.value })} placeholder="What is the capital of France?" className="text-lg font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Image URL (Optional)</label>
                  <Input value={q.image} onChange={e => updateQuestion(qIndex, { image: e.target.value })} placeholder="https://example.com/image.jpg" />
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">Responses</label>
                  <div className="grid gap-3">
                    {q.options.map((opt: any, oIndex: number) => {
                      const isChecked = q.type === 'single' ? q.correctOptionId === opt.id : q.correctOptionId?.includes?.(opt.id);
                      
                      return (
                        <div key={opt.id} className={`flex gap-3 items-center p-2 rounded-2xl border-2 transition-colors ${isChecked ? 'border-emerald-400 bg-emerald-50' : 'border-transparent'}`}>
                          <div className="relative flex items-center justify-center w-8 h-8 ml-2">
                            <input 
                              type={q.type === 'single' ? 'radio' : 'checkbox'} 
                              name={`correct-${q.id}`}
                              className="peer w-6 h-6 cursor-pointer opacity-0 absolute inset-0 z-10"
                              checked={isChecked}
                              onChange={() => {
                                if (q.type === 'single') {
                                  updateQuestion(qIndex, { correctOptionId: opt.id });
                                } else {
                                  const arr = Array.isArray(q.correctOptionId) ? [...q.correctOptionId] : [];
                                  if (isChecked) {
                                    updateQuestion(qIndex, { correctOptionId: arr.filter((x: string) => x !== opt.id) });
                                  } else {
                                    updateQuestion(qIndex, { correctOptionId: [...arr, opt.id] });
                                  }
                                }
                              }}
                            />
                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 peer-hover:border-emerald-400'} ${q.type === 'single' ? 'rounded-full' : 'rounded-md'}`}>
                              {isChecked && <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                            </div>
                          </div>
                          <Input 
                            value={opt.text} 
                            placeholder={`Option ${oIndex + 1}`}
                            className={`flex-1 ${isChecked ? 'border-emerald-200 focus-visible:ring-emerald-300 focus-visible:border-emerald-400 bg-white' : ''}`}
                            onChange={e => {
                              const newOpts = [...q.options];
                              newOpts[oIndex].text = e.target.value;
                              updateQuestion(qIndex, { options: newOpts });
                            }} 
                          />
                          <button 
                            onClick={() => {
                              const newOpts = q.options.filter((_: any, idx: number) => idx !== oIndex);
                              updateQuestion(qIndex, { options: newOpts });
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition mr-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <Button 
                    variant="outline" 
                    className="mt-4 border-dashed border-2 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50"
                    onClick={() => {
                      updateQuestion(qIndex, {
                        options: [...q.options, { id: Date.now().toString(), text: "" }]
                      })
                    }}
                  >
                    + ADD OPTION
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" className="w-full py-12 border-4 border-dashed border-slate-200 rounded-[2rem] flex-col gap-3 h-auto text-slate-400 font-black text-lg hover:border-indigo-300 hover:text-indigo-500 hover:bg-white" onClick={addQuestion}>
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100">
              <Plus className="w-6 h-6" />
            </div>
            ADD NEW QUESTION
          </Button>
        </div>
      </main>
    </div>
  );
}

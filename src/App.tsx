/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Save, Upload, HelpCircle } from 'lucide-react';

// --- Audio Service (Web Audio API) ---
const useAudio = () => {
  const audioCtx = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playSound = (type: 'correct' | 'wrong' | 'reveal' | 'win') => {
    initAudio();
    if (!audioCtx.current) return;
    
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.current.destination);

    const now = audioCtx.current.currentTime;

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(); osc.stop(now + 0.2);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(); osc.stop(now + 0.4);
    } else if (type === 'reveal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.3);
      gain.gain.setValueAtTime(0.05, now);
      osc.start(); osc.stop(now + 0.3);
    } else if (type === 'win') {
      [440, 554, 659, 880].forEach((f, i) => {
        const o = audioCtx.current!.createOscillator();
        const g = audioCtx.current!.createGain();
        o.connect(g); g.connect(audioCtx.current!.destination);
        o.frequency.setValueAtTime(f, now + i * 0.1);
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.5);
        o.start(now + i * 0.1); o.stop(now + i * 0.1 + 0.5);
      });
    }
  };

  return { playSound };
};

// --- Types ---
interface Question {
  text: string;
  correct: string;
  options: string[];
}

interface TeamData {
  name: string;
  img: string;
  questions: Question[];
  revealed: number[];
  keyword: string;
}

interface GameState {
  currentTurn: 1 | 2;
  teams: {
    1: TeamData;
    2: TeamData;
  };
  isGameStarted: boolean;
  winner: 1 | 2 | null;
}

export default function App() {
  const { playSound } = useAudio();
  const [gameState, setGameState] = useState<GameState>({
    currentTurn: 1,
    teams: {
      1: { name: "فريق النجوم", img: "", questions: [], revealed: [], keyword: "" },
      2: { name: "فريق الأبطال", img: "", questions: [], revealed: [], keyword: "" }
    },
    isGameStarted: false,
    winner: null
  });

  const [activeModal, setActiveModal] = useState<'question' | 'guess' | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<{ team: 1 | 2, index: number } | null>(null);
  const [guessInput, setGuessInput] = useState("");
  const [stars, setStars] = useState<{ id: number, size: string, left: string, top: string, duration: string }[]>([]);

  // Initialize stars
  useEffect(() => {
    const newStars = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      size: Math.random() * 3 + 'px',
      left: Math.random() * 100 + 'vw',
      top: Math.random() * 100 + 'vh',
      duration: (Math.random() * 50 + 50) + 's'
    }));
    setStars(newStars);
  }, []);

  // --- Setup Handlers ---
  const handleTeamNameChange = (team: 1 | 2, name: string) => {
    setGameState(prev => ({
      ...prev,
      teams: { ...prev.teams, [team]: { ...prev.teams[team], name } }
    }));
  };

  const handleImageUpload = (team: 1 | 2, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setGameState(prev => ({
          ...prev,
          teams: { ...prev.teams, [team]: { ...prev.teams[team], img: event.target?.result as string } }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuestionCountChange = (team: 1 | 2, count: number) => {
    const currentQuestions = gameState.teams[team].questions;
    const newQuestions = Array.from({ length: count }).map((_, i) => 
      currentQuestions[i] || { text: "", correct: "", options: ["", "", "", ""] }
    );
    setGameState(prev => ({
      ...prev,
      teams: { ...prev.teams, [team]: { ...prev.teams[team], questions: newQuestions } }
    }));
  };

  const updateQuestion = (team: 1 | 2, qIdx: number, field: 'text' | 'correct' | 'option', value: string, optIdx?: number) => {
    setGameState(prev => {
      const questions = [...prev.teams[team].questions];
      if (field === 'text') questions[qIdx].text = value;
      if (field === 'correct') questions[qIdx].correct = value;
      if (field === 'option' && optIdx !== undefined) {
        const options = [...questions[qIdx].options];
        options[optIdx] = value;
        questions[qIdx].options = options;
      }
      return { ...prev, teams: { ...prev.teams, [team]: { ...prev.teams[team], questions } } };
    });
  };

  const handleKeywordChange = (team: 1 | 2, keyword: string) => {
    setGameState(prev => ({
      ...prev,
      teams: { ...prev.teams, [team]: { ...prev.teams[team], keyword } }
    }));
  };

  const startGame = () => {
    const t1 = gameState.teams[1];
    const t2 = gameState.teams[2];

    if (!t1.img || !t2.img) return alert("يرجى رفع صور لكلا الفريقين!");
    if (!t1.keyword || !t2.keyword) return alert("يرجى إدخال الكلمة المفتاحية لكلا الفريقين!");
    
    // Validate and shuffle options
    const finalizeTeam = (team: TeamData) => ({
      ...team,
      questions: team.questions.map(q => ({
        ...q,
        options: [...q.options].sort(() => Math.random() - 0.5)
      }))
    });

    setGameState(prev => ({
      ...prev,
      teams: {
        1: finalizeTeam(prev.teams[1]),
        2: finalizeTeam(prev.teams[2])
      },
      isGameStarted: true
    }));
  };

  // --- Game Mechanics ---
  const handleSquareClick = (team: 1 | 2, qIdx: number) => {
    if (gameState.currentTurn !== team || gameState.teams[team].revealed.includes(qIdx)) return;
    setActiveQuestion({ team, index: qIdx });
    setActiveModal('question');
  };

  const handleAnswer = (answer: string) => {
    if (!activeQuestion) return;
    const { team, index } = activeQuestion;
    const isCorrect = answer === gameState.teams[team].questions[index].correct;

    if (isCorrect) {
      playSound('correct');
      setGameState(prev => {
        const revealed = [...prev.teams[team].revealed, index];
        const isWinner = revealed.length === prev.teams[team].questions.length;
        return {
          ...prev,
          teams: { ...prev.teams, [team]: { ...prev.teams[team], revealed } },
          winner: isWinner ? team : prev.winner
        };
      });
      if (gameState.teams[team].revealed.length + 1 === gameState.teams[team].questions.length) {
        playSound('win');
      } else {
        playSound('reveal');
      }
    } else {
      playSound('wrong');
    }

    setActiveModal(null);
    setActiveQuestion(null);
    setGameState(prev => ({ ...prev, currentTurn: prev.currentTurn === 1 ? 2 : 1 }));
  };

  const handleGuess = () => {
    const team = gameState.currentTurn;
    const isCorrect = guessInput.trim() === gameState.teams[team].keyword;

    if (isCorrect) {
      playSound('win');
      setGameState(prev => ({
        ...prev,
        teams: {
          ...prev.teams,
          [team]: {
            ...prev.teams[team],
            revealed: Array.from({ length: prev.teams[team].questions.length }).map((_, i) => i)
          }
        },
        winner: team
      }));
    } else {
      playSound('wrong');
      setGameState(prev => {
        const revealed = [...prev.teams[team].revealed];
        if (revealed.length > 0) revealed.pop();
        return {
          ...prev,
          teams: { ...prev.teams, [team]: { ...prev.teams[team], revealed } },
          currentTurn: prev.currentTurn === 1 ? 2 : 1
        };
      });
    }
    setActiveModal(null);
    setGuessInput("");
  };

  // --- Project Management ---
  const exportProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameState));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "picture_reveal_project.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          setGameState(imported);
          alert("تم تحميل المشروع بنجاح!");
        } catch (err) {
          alert("خطأ في تحميل الملف!");
        }
      };
      reader.readAsText(file);
    }
  };

  // --- Render Helpers ---
  const renderGrid = (team: 1 | 2) => {
    const teamData = gameState.teams[team];
    const qCount = teamData.questions.length;
    if (qCount === 0) return null;

    const cols = Math.ceil(Math.sqrt(qCount));
    const rows = Math.ceil(qCount / cols);

    return (
      <div 
        className="grid-overlay" 
        style={{ 
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`
        }}
      >
        {Array.from({ length: qCount }).map((_, i) => (
          <div
            key={i}
            className={`square ${teamData.revealed.includes(i) ? 'revealed' : ''}`}
            onClick={() => handleSquareClick(team, i)}
          >
            {!teamData.revealed.includes(i) && (i + 1)}
          </div>
        ))}
      </div>
    );
  };

  if (!gameState.isGameStarted) {
    return (
      <div className="min-h-screen p-4 md:p-8" dir="rtl">
        <div className="stars-container">
          {stars.map(star => (
            <div 
              key={star.id} 
              className="star" 
              style={{ width: star.size, height: star.size, left: star.left, top: star.top, animationDuration: star.duration }} 
            />
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          <h1 className="text-4xl md:text-6xl font-bold text-center mb-8 text-primary drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]">
            🚀 سباق كشف الصورتين
          </h1>

          <div className="glass-card flex flex-col md:flex-row justify-center gap-4 items-center">
            <h2 className="text-xl font-bold text-secondary">⚙️ إدارة المشروع</h2>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex items-center gap-2" onClick={exportProject}>
                <Save size={20} /> حفظ المشروع
              </button>
              <label className="btn btn-secondary flex items-center gap-2 cursor-pointer">
                <Upload size={20} /> تحميل مشروع
                <input type="file" className="hidden" accept=".json" onChange={importProject} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[1, 2].map(t => (
              <div key={t} className="glass-card">
                <h2 className="text-2xl font-bold mb-6 text-primary border-b border-primary/20 pb-2">
                  إعداد الفريق {t === 1 ? 'الأول' : 'الثاني'}
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">اسم الفريق:</label>
                    <input 
                      type="text" 
                      className="w-full bg-black/50 border border-primary/30 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                      value={gameState.teams[t as 1 | 2].name}
                      onChange={(e) => handleTeamNameChange(t as 1 | 2, e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">صورة التحدي:</label>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 cursor-pointer bg-black/50 border-2 border-dashed border-primary/30 rounded-xl p-4 text-center hover:bg-primary/5 transition-colors">
                        <Upload className="mx-auto mb-2 text-primary" />
                        <span className="text-sm">اضغط لرفع الصورة</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(t as 1 | 2, e)} />
                      </label>
                      {gameState.teams[t as 1 | 2].img && (
                        <img src={gameState.teams[t as 1 | 2].img} className="w-24 h-24 object-cover rounded-lg border border-primary/50" alt="Preview" />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">عدد الأسئلة:</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full bg-black/50 border border-primary/30 rounded-lg p-3 text-white"
                      value={gameState.teams[t as 1 | 2].questions.length || ""}
                      onChange={(e) => handleQuestionCountChange(t as 1 | 2, parseInt(e.target.value) || 0)}
                      placeholder="مثلاً: 6"
                    />
                  </div>

                  {gameState.teams[t as 1 | 2].questions.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <div className="p-4 bg-primary/10 rounded-xl border border-primary/20">
                        <label className="block text-sm font-bold mb-2 text-primary">الكلمة المفتاحية (حل الصورة):</label>
                        <input 
                          type="text" 
                          className="w-full bg-black/50 border border-primary/50 rounded-lg p-3 text-white"
                          value={gameState.teams[t as 1 | 2].keyword}
                          onChange={(e) => handleKeywordChange(t as 1 | 2, e.target.value)}
                          placeholder="ماذا يوجد في الصورة؟"
                        />
                      </div>

                      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {gameState.teams[t as 1 | 2].questions.map((q, qIdx) => (
                          <div key={qIdx} className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-xs font-bold text-secondary mb-2 uppercase">السؤال {qIdx + 1}</p>
                            <input 
                              type="text" 
                              placeholder="نص السؤال"
                              className="w-full bg-black/30 border border-white/10 rounded-lg p-2 mb-2 text-sm"
                              value={q.text}
                              onChange={(e) => updateQuestion(t as 1 | 2, qIdx, 'text', e.target.value)}
                            />
                            <div className="grid grid-cols-1 gap-2">
                              <input 
                                type="text" 
                                placeholder="الإجابة الصحيحة"
                                className="w-full bg-green-500/10 border border-green-500/30 rounded-lg p-2 text-sm"
                                value={q.correct}
                                onChange={(e) => updateQuestion(t as 1 | 2, qIdx, 'correct', e.target.value)}
                              />
                              {q.options.map((opt, optIdx) => (
                                <input 
                                  key={optIdx}
                                  type="text" 
                                  placeholder={`خيار خطأ ${optIdx + 1}`}
                                  className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-sm"
                                  value={opt}
                                  onChange={(e) => updateQuestion(t as 1 | 2, qIdx, 'option', e.target.value, optIdx)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 mb-20">
            <button 
              className="btn btn-primary text-2xl px-12 py-4 shadow-[0_0_30px_rgba(0,242,255,0.3)]"
              onClick={startGame}
            >
              🏁 ابدأ السباق الآن
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4" dir="rtl">
      <div className="stars-container">
        {stars.map(star => (
          <div 
            key={star.id} 
            className="star" 
            style={{ width: star.size, height: star.size, left: star.left, top: star.top, animationDuration: star.duration }} 
          />
        ))}
      </div>

      <div className="flex justify-between items-center bg-black/70 backdrop-blur-md p-4 rounded-2xl mb-6 border border-white/10">
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-full font-bold transition-all duration-300 ${gameState.currentTurn === 1 ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,255,0.5)]' : 'bg-white/10 text-white'}`}>
            دور: {gameState.teams[1].name}
          </div>
          <div className={`px-4 py-2 rounded-full font-bold transition-all duration-300 ${gameState.currentTurn === 2 ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,255,0.5)]' : 'bg-white/10 text-white'}`}>
            دور: {gameState.teams[2].name}
          </div>
        </div>
        <button className="btn btn-accent flex items-center gap-2 py-2" onClick={() => window.location.reload()}>
          <RotateCcw size={18} /> إنهاء اللعبة
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 items-center justify-center">
        {[1, 2].map(t => (
          <div key={t} className={`team-area ${gameState.currentTurn === t ? 'active' : ''}`}>
            <h3 className="text-2xl font-bold mb-4 text-white drop-shadow-md">{gameState.teams[t as 1 | 2].name}</h3>
            <div className="image-wrapper">
              <img src={gameState.teams[t as 1 | 2].img} className="w-full h-full object-cover" alt="Challenge" />
              {renderGrid(t as 1 | 2)}
            </div>
            <button 
              className="btn btn-primary mt-6 flex items-center gap-2"
              disabled={gameState.currentTurn !== t || gameState.winner !== null}
              onClick={() => {
                setGuessInput("");
                setActiveModal('guess');
              }}
            >
              <HelpCircle size={20} /> تخمين الصورة
            </button>
          </div>
        ))}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal === 'question' && activeQuestion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="modal-content"
            >
              <h2 className="text-2xl font-bold mb-6 text-primary">
                {gameState.teams[activeQuestion.team].questions[activeQuestion.index].text}
              </h2>
              <div className="options-grid">
                {[
                  gameState.teams[activeQuestion.team].questions[activeQuestion.index].correct,
                  ...gameState.teams[activeQuestion.team].questions[activeQuestion.index].options
                ].sort(() => 0.5 - Math.random()).map((opt, i) => (
                  <button 
                    key={i} 
                    className="btn btn-secondary text-sm md:text-base"
                    onClick={() => handleAnswer(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeModal === 'guess' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="modal-content"
            >
              <h2 className="text-2xl font-bold mb-6 text-primary">ماذا يوجد في الصورة؟</h2>
              <input 
                type="text" 
                className="w-full bg-black/50 border border-primary rounded-xl p-4 text-white text-center text-xl mb-6 focus:outline-none"
                placeholder="اكتب إجابتك هنا..."
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-center">
                <button className="btn btn-primary px-8" onClick={handleGuess}>تحقق</button>
                <button className="btn btn-accent px-8" onClick={() => setActiveModal(null)}>إغلاق</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {gameState.winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="modal"
          >
            <motion.div 
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className="modal-content border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.5)]"
            >
              <Trophy className="mx-auto mb-6 text-yellow-500" size={80} />
              <h1 className="text-4xl font-bold mb-2 text-white">🏆 مبروك الفوز! 🏆</h1>
              <h2 className="text-3xl font-bold text-yellow-500 mb-6">{gameState.teams[gameState.winner].name}</h2>
              <p className="text-lg text-white/70 mb-8">لقد نجحتم في كشف الصورة أولاً!</p>
              <button className="btn btn-primary text-xl px-12" onClick={() => window.location.reload()}>لعب مرة أخرى</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

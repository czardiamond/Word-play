import React, { useState, useEffect, useCallback } from "react";
import { X, Flame, Zap, Heart, Volume2, CheckCircle2, ArrowRight, Sparkles, Award, Trophy, RefreshCw, HelpCircle, Target, Shield, Gift, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";
import {
  getDuolingoProfile,
  addDuolingoXp,
  speakWord,
  claimQuestReward,
  loadDuolingoProfileFromCloud,
  fetchRealLeagueMembers,
  DuolingoProfile,
  DailyQuest,
  LeagueMember
} from "../utils/duolingoSystem";
import { playBadgeFanfare } from "../utils/soundEffects";

interface DuolingoLearnModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLetter?: string;
}

interface DrillItem {
  word: string;
  category: string;
  definition: string;
  phonetic: string;
  sampleSentence: string;
  quizQuestion: string;
  options: string[];
  correctIndex: number;
}

export default function DuolingoLearnModal({
  isOpen,
  onClose,
  currentLetter = "A"
}: DuolingoLearnModalProps) {
  const [profile, setProfile] = useState<DuolingoProfile>(getDuolingoProfile());
  const [modalTab, setModalTab] = useState<"drills" | "quests" | "league">("drills");
  const [activeStep, setActiveStep] = useState<"flashcards" | "quiz" | "completed">("flashcards");
  const [cardIndex, setCardIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);

  // Dynamic AI Drills State
  const [drillItems, setDrillItems] = useState<DrillItem[]>([]);
  const [loadingDrills, setLoadingDrills] = useState(true);
  const [drillSource, setDrillSource] = useState<string>("loading");

  // Real League Members State
  const [leagueMembers, setLeagueMembers] = useState<LeagueMember[]>([]);
  const [loadingLeague, setLoadingLeague] = useState(false);

  const letter = (currentLetter || "A").toUpperCase();

  // Load cloud-synced profile
  useEffect(() => {
    if (isOpen) {
      loadDuolingoProfileFromCloud().then((cloudProf) => {
        setProfile(cloudProf);
      });
    }
  }, [isOpen]);

  // Fetch dynamic AI drills for active letter
  const fetchDrillsForLetter = useCallback(async (targetLetter: string) => {
    setLoadingDrills(true);
    try {
      const res = await fetch(`/api/vocab-drill/${targetLetter}`);
      if (!res.ok) throw new Error("Failed to fetch drills");
      const data = await res.json();
      if (data.cards && Array.isArray(data.cards) && data.cards.length > 0) {
        setDrillItems(data.cards);
        setDrillSource(data.source || "gemini");
      }
    } catch (err) {
      console.warn("Could not fetch AI drills, using fallback:", err);
    } finally {
      setLoadingDrills(false);
    }
  }, []);

  // Fetch real league members from Firestore
  const loadLeagueData = useCallback(async (leagueName: string) => {
    setLoadingLeague(true);
    try {
      const realMembers = await fetchRealLeagueMembers(leagueName);
      const currentUserName = profile.displayName || localStorage.getItem("last_player_name") || "You (Player)";
      const currentUserAvatar = profile.avatar || localStorage.getItem("last_player_avatar") || "🦉";

      const hasUser = realMembers.some((m) => m.isUser);
      let combined = [...realMembers];

      if (!hasUser) {
        combined.push({
          uid: "current-user",
          displayName: `${currentUserName} (You)`,
          avatar: currentUserAvatar,
          league: leagueName,
          totalXp: profile.totalXp,
          isUser: true
        });
      }

      combined.sort((a, b) => b.totalXp - a.totalXp);
      setLeagueMembers(combined);
    } catch (e) {
      console.warn("Error fetching real league standings:", e);
    } finally {
      setLoadingLeague(false);
    }
  }, [profile.displayName, profile.avatar, profile.totalXp]);

  useEffect(() => {
    if (isOpen) {
      setActiveStep("flashcards");
      setCardIndex(0);
      setSelectedOption(null);
      setIsAnswered(false);
      setIsCorrect(false);
      fetchDrillsForLetter(letter);
    }
  }, [isOpen, letter, fetchDrillsForLetter]);

  useEffect(() => {
    if (modalTab === "league") {
      loadLeagueData(profile.league);
    }
  }, [modalTab, profile.league, loadLeagueData]);

  if (!isOpen) return null;

  const currentItem = drillItems[cardIndex] || {
    word: `${letter}xolotl`,
    category: "Animal",
    phonetic: `/${letter}/`,
    definition: "Loading educational vocabulary item...",
    sampleSentence: "Please wait while vocabulary flashcards are prepared.",
    quizQuestion: `Which category does this word belong to?`,
    options: ["Animal", "Food", "Place", "Thing"],
    correctIndex: 0
  };

  const handleNextCard = () => {
    if (cardIndex < drillItems.length - 1) {
      setCardIndex(cardIndex + 1);
    } else {
      setActiveStep("quiz");
      setCardIndex(0);
      setSelectedOption(null);
      setIsAnswered(false);
    }
  };

  const handleAnswerQuiz = (optionIdx: number) => {
    if (isAnswered) return;
    setSelectedOption(optionIdx);
    setIsAnswered(true);

    const correct = optionIdx === currentItem.correctIndex;
    setIsCorrect(correct);

    if (correct) {
      playBadgeFanfare();
    }
  };

  const handleFinishDrill = () => {
    const xpBonus = 35;
    const updated = addDuolingoXp(xpBonus);
    setProfile(updated);
    setEarnedXp(xpBonus);
    setActiveStep("completed");

    try {
      playBadgeFanfare();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleClaimQuest = (questId: string) => {
    const updated = claimQuestReward(questId);
    setProfile(updated);
    playBadgeFanfare();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-canvas text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-white/40 dark:border-slate-800">
        
        {/* Header - Glassmorphic Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">🦉</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-base text-slate-900 dark:text-white">
                  Vocab Academy
                </h3>
                <span className="bg-[#34A853]/15 text-[#34A853] border border-[#34A853]/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  Letter '{letter}'
                </span>
                {drillSource === "gemini" && (
                  <span className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={10} />
                    Gemini AI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Vocabulary Flashcards & League Standings
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Duolingo Nav Tabs */}
        <div className="px-6 py-2.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-around gap-1.5">
          <button
            type="button"
            onClick={() => setModalTab("drills")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-display font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              modalTab === "drills"
                ? "bg-[#34A853] text-white shadow-md"
                : "glass-pill text-slate-600 dark:text-slate-300"
            }`}
          >
            <span>📖 AI Drills</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab("quests")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-display font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              modalTab === "quests"
                ? "bg-[#34A853] text-white shadow-md"
                : "glass-pill text-slate-600 dark:text-slate-300"
            }`}
          >
            <Target size={14} />
            <span>Daily Quests</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab("league")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-display font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              modalTab === "league"
                ? "bg-[#34A853] text-white shadow-md"
                : "glass-pill text-slate-600 dark:text-slate-300"
            }`}
          >
            <Trophy size={14} />
            <span>Cloud League</span>
          </button>
        </div>

        {/* Stats Ribbon (Streak 🔥, XP ⚡, Gems 💎) */}
        <div className="px-6 py-2.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-around text-xs font-mono font-bold">
          <div className="flex items-center gap-1.5 text-[#EA4335] bg-[#EA4335]/10 px-3 py-1 rounded-full border border-[#EA4335]/30">
            <Flame size={14} className="text-[#EA4335] fill-[#EA4335] animate-pulse" />
            <span>{profile.streakDays}d Streak</span>
          </div>

          <div className="flex items-center gap-1.5 text-[#FBBC05] bg-[#FBBC05]/10 px-3 py-1 rounded-full border border-[#FBBC05]/30">
            <Zap size={14} className="text-[#FBBC05] fill-[#FBBC05]" />
            <span>{profile.totalXp} XP</span>
          </div>

          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/30">
            <span>💎 {profile.gems}</span>
          </div>
        </div>

        {/* Body Area */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* TAB 1: DRILLS */}
          {modalTab === "drills" && (
            <>
              {loadingDrills ? (
                <div className="py-16 text-center space-y-4">
                  <Loader2 size={36} className="animate-spin text-[#34A853] mx-auto" />
                  <div className="space-y-1">
                    <h4 className="font-display font-black text-slate-900 dark:text-white text-base">
                      Generating AI Flashcards for '{letter}'...
                    </h4>
                    <p className="text-xs text-slate-500">
                      Crafting educational definitions, phonetics, and quiz questions.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {activeStep === "flashcards" && (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                          <span>VOCABULARY DISCOVERY ({letter})</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fetchDrillsForLetter(letter)}
                              className="text-[#34A853] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                              title="Generate new words with Gemini"
                            >
                              <RefreshCw size={12} />
                              <span>New Words</span>
                            </button>
                            <span className="font-mono">CARD {cardIndex + 1} OF {drillItems.length}</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#34A853] transition-all duration-300 rounded-full"
                            style={{ width: `${((cardIndex + 1) / Math.max(1, drillItems.length)) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="glass-card p-6 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-xl space-y-4 text-center relative overflow-hidden">
                        <span className="absolute top-4 right-4 text-[10px] font-bold bg-[#34A853]/15 text-[#34A853] border border-[#34A853]/30 px-2.5 py-0.5 rounded-full">
                          {currentItem.category}
                        </span>

                        <div className="space-y-1 pt-2">
                          <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-wide">
                            {currentItem.word}
                          </h2>
                          <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#34A853]">
                            <span>{currentItem.phonetic}</span>
                            <button
                              type="button"
                              onClick={() => speakWord(currentItem.word)}
                              className="p-1.5 bg-[#34A853]/15 hover:bg-[#34A853]/30 border border-[#34A853]/30 rounded-full text-[#34A853] transition-all cursor-pointer"
                              title="Listen to Audio Pronunciation"
                            >
                              <Volume2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="p-3.5 glass-card rounded-2xl border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed text-left">
                          <span className="font-bold text-[#34A853] block mb-1">📖 Definition:</span>
                          {currentItem.definition}
                        </div>

                        <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 text-left font-sans font-medium">
                          💡 <b>Game Strategy:</b> {currentItem.sampleSentence}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleNextCard}
                        className="w-full py-3.5 bg-[#34A853] hover:bg-[#2d9247] text-white font-display font-black text-sm rounded-full shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>{cardIndex < drillItems.length - 1 ? "Next Word" : "Start Vocab Quiz"}</span>
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  )}

                  {activeStep === "quiz" && (
                    <div className="space-y-5 animate-fadeIn">
                      <div className="flex items-center gap-3 p-3.5 glass-card rounded-2xl border border-[#34A853]/30">
                        <span className="text-3xl">🦉</span>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                          "Test your knowledge! Pick the correct answer to complete your daily drill."
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-display font-extrabold text-slate-900 dark:text-white">
                          {currentItem.quizQuestion}
                        </h4>

                        <div className="grid grid-cols-1 gap-2.5 pt-2">
                          {currentItem.options.map((opt, idx) => {
                            let btnStyle = "glass-card border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-blue-500/50";
                            if (isAnswered) {
                              if (idx === currentItem.correctIndex) {
                                btnStyle = "bg-[#34A853] border-[#34A853] text-white font-bold ring-2 ring-[#34A853]/40";
                              } else if (idx === selectedOption) {
                                btnStyle = "bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-300";
                              }
                            } else if (idx === selectedOption) {
                              btnStyle = "bg-blue-500/20 border-blue-500 text-blue-600 dark:text-white";
                            }

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleAnswerQuiz(idx)}
                                disabled={isAnswered}
                                className={`p-4 rounded-2xl border text-left text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {isAnswered && idx === currentItem.correctIndex && (
                                  <CheckCircle2 size={16} className="text-white" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {isAnswered && (
                        <div className={`p-4 rounded-2xl border ${isCorrect ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"} animate-fadeIn space-y-3`}>
                          <div className="flex items-center gap-2 font-extrabold text-sm">
                            <span>{isCorrect ? "🎉 Excellent!" : "💡 Almost!"}</span>
                          </div>
                          <p className="text-xs">
                            {isCorrect
                              ? `Great job! You mastered the vocabulary card for letter '${letter}'.`
                              : `The correct answer was "${currentItem.options[currentItem.correctIndex]}".`}
                          </p>

                          <button
                            type="button"
                            onClick={handleFinishDrill}
                            className="w-full py-3 bg-[#34A853] hover:bg-[#2d9247] text-white font-display font-extrabold text-xs uppercase tracking-wider rounded-full cursor-pointer shadow-md"
                          >
                            Claim +35 XP & Sync Streak
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeStep === "completed" && (
                    <div className="py-6 text-center space-y-5 animate-fadeIn">
                      <div className="w-20 h-20 mx-auto rounded-3xl bg-[#34A853]/15 border-2 border-[#34A853]/40 flex items-center justify-center text-4xl shadow-inner animate-pulse">
                        🦉
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-mono text-[#34A853] uppercase font-bold tracking-widest">
                          DRILL COMPLETED
                        </span>
                        <h3 className="text-2xl font-display font-black text-slate-900 dark:text-white">
                          Streak Extended to {profile.streakDays} Days!
                        </h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          You earned <strong className="text-amber-500">+{earnedXp} XP</strong> and synced to the cloud <span className="text-[#34A853] font-bold">{profile.league}</span>!
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl glass-card border border-slate-200/70 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 glass-card rounded-xl flex items-center justify-center gap-2 text-[#EA4335] font-display font-bold">
                          <Flame size={18} />
                          <span>{profile.streakDays} Days</span>
                        </div>
                        <div className="p-3 glass-card rounded-xl flex items-center justify-center gap-2 text-amber-500 font-display font-bold">
                          <Zap size={18} />
                          <span>{profile.totalXp} Total XP</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3.5 google-fab-primary font-display font-black text-sm rounded-full shadow-lg transition-all cursor-pointer"
                      >
                        Return to Game
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* TAB 2: DAILY QUESTS */}
          {modalTab === "quests" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 glass-card border border-slate-200/70 dark:border-slate-800 rounded-2xl flex items-center gap-3">
                <Target size={28} className="text-[#34A853] shrink-0" />
                <div>
                  <h4 className="text-sm font-display font-black text-slate-900 dark:text-white">Daily Quests</h4>
                  <p className="text-[11px] text-slate-500">Complete quests every 24 hours to earn XP & Gems!</p>
                </div>
              </div>

              <div className="space-y-3">
                {profile.quests.map((q) => {
                  const isDone = q.current >= q.target;
                  return (
                    <div key={q.id} className="p-4 rounded-2xl glass-card border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-display font-bold text-slate-900 dark:text-white">{q.title}</h5>
                          <p className="text-[11px] text-slate-500">{q.description}</p>
                        </div>
                        {q.claimed ? (
                          <span className="text-[10px] font-mono glass-pill text-slate-500 px-2.5 py-1 rounded-full">
                            Claimed ✓
                          </span>
                        ) : isDone ? (
                          <button
                            type="button"
                            onClick={() => handleClaimQuest(q.id)}
                            className="px-3.5 py-1.5 bg-[#34A853] hover:bg-[#2d9247] text-white text-xs font-bold rounded-full animate-bounce shadow cursor-pointer"
                          >
                            Claim +{q.xpReward} XP
                          </button>
                        ) : (
                          <span className="text-xs font-mono font-bold text-slate-400">
                            {q.current}/{q.target}
                          </span>
                        )}
                      </div>

                      {/* Quest Progress Bar */}
                      <div className="w-full h-2 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#34A853] transition-all duration-300 rounded-full"
                          style={{ width: `${Math.min(100, (q.current / q.target) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: REAL CLOUD LEAGUE LEADERBOARD */}
          {modalTab === "league" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 glass-card border border-amber-500/30 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy size={28} className="text-amber-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-display font-black text-slate-900 dark:text-white">{profile.league}</h4>
                    <p className="text-[11px] text-slate-500">Real Cloud League Standings (Firestore Synced)</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30 block">
                    {profile.totalXp} XP
                  </span>
                </div>
              </div>

              {loadingLeague ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 size={24} className="animate-spin text-[#34A853] mx-auto" />
                  <p className="text-xs font-mono text-slate-400">Fetching live league standings from Firestore...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leagueMembers.map((member, idx) => {
                    const isTop3 = idx < 3;
                    const rankMedal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

                    return (
                      <div
                        key={member.uid || idx}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                          member.isUser
                            ? "bg-[#34A853]/15 border-[#34A853]/40 text-slate-900 dark:text-white font-bold ring-1 ring-[#34A853]/40"
                            : isTop3
                            ? "glass-card border-amber-500/30 text-slate-800 dark:text-slate-200"
                            : "glass-card border-slate-200/70 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-bold text-slate-400">{rankMedal}</span>
                          <span className="text-lg bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700">{member.avatar}</span>
                          <div className="flex flex-col">
                            <span className={member.isUser ? "text-[#34A853] font-display font-extrabold" : "font-display font-bold text-slate-900 dark:text-white"}>
                              {member.displayName}
                            </span>
                            {isTop3 && (
                              <span className="text-[9px] text-amber-500 font-sans font-bold">
                                🚀 Promotion Zone
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-amber-500 font-mono font-bold">
                          <Zap size={13} className="text-amber-500 fill-amber-500" />
                          <span>{member.totalXp} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200/70 dark:border-slate-800/80 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1.5 font-mono">
          <Sparkles size={12} className="text-[#34A853]" />
          <span>Gemini AI Vocabulary Drills • Firestore Cloud Synced League</span>
        </div>
      </div>
    </div>
  );
}

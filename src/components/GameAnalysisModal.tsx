import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  Trophy,
  Award,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Zap,
  RefreshCw,
  Search,
  BookOpen,
  ChevronRight,
  Shield,
  Lightbulb,
  Compass,
  MessageSquare
} from "lucide-react";
import { PlayerRoundResult, CategoryInfo, Player, Round } from "../types";
import { classifyWordMove } from "../utils/ratingSystem";
import WordLookupModal from "./WordLookupModal";

interface GeminiTacticalAnalysis {
  source?: "gemini" | "fallback";
  playerName?: string;
  playstyleTitle?: string;
  playstyleDescription?: string;
  accuracyRating?: number;
  tacticalRating?: string;
  coachAnalysis?: string;
  strengths?: string[];
  criticalMistakes?: string[];
  missedOpportunities?: Array<{
    letter: string;
    category: string;
    suggestedWord: string;
    whyItScores: string;
  }>;
  headToHeadCritique?: string;
  nextRoundTrainingTip?: string;
}

interface GameAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: PlayerRoundResult[];
  categories: CategoryInfo[];
  letter: string;
  players?: Player[];
  fullRounds?: Round[];
}

export default function GameAnalysisModal({
  isOpen,
  onClose,
  results,
  categories,
  letter,
  players = [],
  fullRounds
}: GameAnalysisModalProps) {
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiTacticalAnalysis | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<"coach" | "moves" | "tactics">("coach");

  // Word Lookup drill-down modal state
  const [selectedWordForLookup, setSelectedWordForLookup] = useState<string | null>(null);
  const [selectedCategoryForLookup, setSelectedCategoryForLookup] = useState<string>("General");

  // Find human player result
  const humanPlayer = players.find((p) => !p.isBot) || players[0];
  const humanResult = (humanPlayer ? results.find((r) => r.playerId === humanPlayer.id) : null) || results[0];

  useEffect(() => {
    if (!isOpen || !results || results.length === 0) return;

    const fetchGeminiTacticalAnalysis = async () => {
      setLoadingAI(true);
      try {
        // Construct rounds data
        const roundsToAnalyze = fullRounds && fullRounds.length > 0
          ? fullRounds
          : [
              {
                roundNumber: 1,
                letter: letter,
                results: results.reduce((acc, curr) => {
                  acc[curr.playerId] = curr;
                  return acc;
                }, {} as Record<string, PlayerRoundResult>),
                isCompleted: true
              }
            ];

        const res = await fetch("/api/game-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rounds: roundsToAnalyze,
            players,
            categories,
            difficulty: "medium"
          })
        });

        if (!res.ok) throw new Error("Game analysis request failed");
        const data = await res.json();
        setGeminiAnalysis(data);
      } catch (err) {
        console.warn("Failed to fetch Gemini tactical review:", err);
      } finally {
        setLoadingAI(false);
      }
    };

    fetchGeminiTacticalAnalysis();
  }, [isOpen, letter, results]);

  if (!isOpen || !results || results.length === 0) return null;

  // Calculate local stats & classifications
  let brilliantCount = 0;
  let greatCount = 0;
  let bookCount = 0;
  let blunderCount = 0;
  let totalValid = 0;

  const wordDetails: { category: string; categoryId: string; word: string; move: ReturnType<typeof classifyWordMove>; score: number }[] = [];

  if (humanResult) {
    categories.forEach((cat) => {
      const word = humanResult.answers[cat.id] || "";
      const valid = humanResult.validations?.[cat.id]?.isValid ?? false;
      const score = humanResult.scores?.[cat.id] || 0;
      const move = classifyWordMove(word, valid, score >= 15, word.trim().length);

      if (move.label === "BRILLIANT") brilliantCount++;
      else if (move.label === "GREAT FIND") greatCount++;
      else if (move.label === "BOOK WORD") bookCount++;
      else if (move.label === "BLUNDER") blunderCount++;

      if (valid) totalValid++;

      wordDetails.push({ category: cat.label, categoryId: cat.id, word, move, score });
    });
  }

  const accuracy = Math.round((totalValid / (categories.length || 1)) * 100);

  // Engine evaluation bar calculation
  const humanScore = humanResult?.totalRoundScore || 0;
  const topOpponentScore = Math.max(
    ...results.filter((r) => r.playerId !== humanResult?.playerId).map((r) => r.totalRoundScore || 0),
    0
  );
  const scoreDiff = humanScore - topOpponentScore;
  const evalBarPercent = Math.min(100, Math.max(0, 50 + scoreDiff * 3));

  const handleInspectWord = (word: string, category: string) => {
    if (!word || word.trim() === "") return;
    setSelectedWordForLookup(word);
    setSelectedCategoryForLookup(category);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
        <div className="glass-canvas text-slate-800 dark:text-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-white/60 dark:border-slate-800 my-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                <BarChart3 size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-tight">
                    Gemini Tactical Match Review
                  </h2>
                  <span className="text-[10px] font-mono bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    Letter '{letter}'
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Dynamic AI Coach Performance, Move Accuracy & Lexicon Analysis
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200/70 dark:border-slate-800 px-6 pt-2 gap-2 bg-slate-500/5">
            <button
              type="button"
              onClick={() => setActiveTab("coach")}
              className={`px-4 py-2.5 font-display font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "coach"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Sparkles size={14} />
              <span>AI Coach Breakdown</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("moves")}
              className={`px-4 py-2.5 font-display font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "moves"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <BarChart3 size={14} />
              <span>Move by Move Classification</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tactics")}
              className={`px-4 py-2.5 font-display font-bold text-xs border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "tactics"
                  ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Compass size={14} />
              <span>15-Pt Missed Opportunities</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {/* TAB 1: AI Coach Tactical Review */}
            {activeTab === "coach" && (
              <div className="space-y-4 animate-fadeIn">
                {/* Top Playstyle Archetype Card */}
                <div className="glass-card p-5 rounded-2xl border border-emerald-500/30 space-y-3 relative overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl p-2.5 bg-emerald-500/15 border border-emerald-400/30 rounded-2xl shadow-sm">
                        🧙‍♂️
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Playstyle Archetype
                          </span>
                          <span className="px-2 py-0.2 text-[9px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/30">
                            {geminiAnalysis?.tacticalRating || "Classroom Tactician"}
                          </span>
                        </div>
                        <h3 className="font-display font-black text-xl text-slate-900 dark:text-white">
                          {geminiAnalysis?.playstyleTitle || "The Agile Lexicographer"}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                          Gemini Precision
                        </span>
                        <span className="font-display font-black text-2xl text-emerald-600 dark:text-emerald-400">
                          {geminiAnalysis?.accuracyRating ?? accuracy}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans pt-1 border-t border-slate-200/50 dark:border-slate-800">
                    {geminiAnalysis?.playstyleDescription ||
                      "Demonstrated strong category breadth with rapid word retrieval and sharp adaptability."}
                  </p>
                </div>

                {/* Engine Eval Bar */}
                <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-display">
                      <TrendingUp size={14} /> Match Position Advantage
                    </span>
                    <span className="text-slate-500 font-mono">
                      {scoreDiff > 0 ? `+${scoreDiff} pts Lead` : scoreDiff < 0 ? `${scoreDiff} pts Deficit` : "Tied Position"}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC05] transition-all duration-700 rounded-full"
                      style={{ width: `${evalBarPercent}%` }}
                    />
                  </div>
                </div>

                {/* Gemini Dynamic Coach Assessment */}
                <div className="glass-card p-4.5 rounded-2xl border border-blue-500/30 space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-display font-bold text-xs uppercase tracking-wider">
                    <MessageSquare size={15} />
                    <span>Gemini Grandmaster Commentary</span>
                    {loadingAI && <RefreshCw size={12} className="animate-spin text-blue-500 ml-1" />}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                    {geminiAnalysis?.coachAnalysis ||
                      (brilliantCount > 0
                        ? `Brilliant play! You found ${brilliantCount} rare word(s) starting with '${letter}', out-maneuvering your opponents.`
                        : `Solid performance! Keep practicing high-tier nouns for less frequent letters to lock in 15-point turnouts.`)}
                  </p>
                </div>

                {/* Strengths & Critical Mistakes Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Strengths */}
                  <div className="glass-card p-4 rounded-2xl border border-emerald-500/25 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-display font-bold text-xs uppercase">
                      <CheckCircle2 size={14} />
                      <span>Tactical Strengths</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-sans">
                      {(geminiAnalysis?.strengths || [
                        "Consistent valid entries across common categories",
                        "Maintained high speed without sacrificing validity",
                        "Avoided duplicated answers in high-risk categories"
                      ]).map((str, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5">✦</span>
                          <span className="leading-tight">{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Critical Mistakes */}
                  <div className="glass-card p-4 rounded-2xl border border-amber-500/25 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-display font-bold text-xs uppercase">
                      <AlertTriangle size={14} />
                      <span>Areas for Improvement</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-sans">
                      {(geminiAnalysis?.criticalMistakes || [
                        "A few common words created scoring overlap",
                        "Missed rare 15-point opportunities in tricky categories"
                      ]).map((mistake, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">⚠️</span>
                          <span className="leading-tight">{mistake}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Head to Head & Next Round Strategy */}
                {geminiAnalysis?.headToHeadCritique && (
                  <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-display font-bold">
                      <Shield size={14} className="text-blue-500" />
                      <span>Opponent Dynamics & Head-to-Head</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {geminiAnalysis.headToHeadCritique}
                    </p>
                  </div>
                )}

                {geminiAnalysis?.nextRoundTrainingTip && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">Coach's Next Round Workout:</strong>
                      <span>{geminiAnalysis.nextRoundTrainingTip}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Move by Move Classification */}
            {activeTab === "moves" && (
              <div className="space-y-4 animate-fadeIn">
                {/* Move Classification Badges Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="glass-card p-3 rounded-2xl border border-cyan-500/30 text-center">
                    <div className="text-lg font-display font-black text-cyan-600 dark:text-cyan-300 flex items-center justify-center gap-1">
                      <span>‼</span> {brilliantCount}
                    </div>
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-200 uppercase">Brilliant</span>
                  </div>

                  <div className="glass-card p-3 rounded-2xl border border-emerald-500/30 text-center">
                    <div className="text-lg font-display font-black text-emerald-600 dark:text-emerald-300 flex items-center justify-center gap-1">
                      <span>⭐</span> {greatCount}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-200 uppercase">Great Finds</span>
                  </div>

                  <div className="glass-card p-3 rounded-2xl border border-blue-500/30 text-center">
                    <div className="text-lg font-display font-black text-blue-600 dark:text-blue-300 flex items-center justify-center gap-1">
                      <span>📖</span> {bookCount}
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-200 uppercase">Book Words</span>
                  </div>

                  <div className="glass-card p-3 rounded-2xl border border-rose-500/30 text-center">
                    <div className="text-lg font-display font-black text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1">
                      <span>‼️</span> {blunderCount}
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase">Blunders</span>
                  </div>
                </div>

                {/* Move by Move Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-display font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Submitted Words & Ref Analysis
                    </h4>
                    <span className="text-[10px] text-slate-400">Click any word to inspect dictionary</span>
                  </div>

                  <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800 overflow-hidden glass-card divide-y divide-slate-200/50 dark:divide-slate-800">
                    {wordDetails.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleInspectWord(item.word, item.category)}
                        className="p-3.5 flex items-center justify-between text-xs hover:bg-blue-500/5 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 font-mono text-slate-400 text-[11px]">{idx + 1}.</span>
                          <div>
                            <span className="font-display font-bold text-slate-900 dark:text-white block">
                              {item.category}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-700 dark:text-slate-200 font-bold">
                                {item.word ? `"${item.word}"` : <i className="text-rose-500 font-normal">No Submission</i>}
                              </span>
                              {item.word && (
                                <button
                                  type="button"
                                  className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                                >
                                  <Search size={10} /> Inspect
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${item.move.color}`}>
                            {item.move.badge} {item.move.label}
                          </span>
                          <span className="font-display font-black text-slate-800 dark:text-slate-200 w-14 text-right">
                            +{item.score} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 15-Pt Missed Opportunities */}
            {activeTab === "tactics" && (
              <div className="space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                      <Award size={18} />
                    </div>
                    <div>
                      <h4 className="font-display font-black text-sm text-slate-900 dark:text-white">
                        Gemini Master Lexicon Recommendations
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        High-scoring 15-point words you could have played for letter '{letter}'
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {(geminiAnalysis?.missedOpportunities || [
                    { letter, category: "Animal", suggestedWord: `${letter}xolotl`, whyItScores: "Rare biological creature worth 15 points" },
                    { letter, category: "Food", suggestedWord: `${letter}sparagus`, whyItScores: "Specific culinary term rarely shared by bots" },
                    { letter, category: "Place", suggestedWord: `${letter}thens`, whyItScores: "Historical landmark ensuring clean score" }
                  ]).map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleInspectWord(item.suggestedWord, item.category)}
                      className="p-4 rounded-2xl glass-card border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-blue-500/40 transition-all cursor-pointer group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {item.category}
                          </span>
                          <span className="font-display font-black text-base text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                            {item.suggestedWord}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-sans">
                          {item.whyItScores}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                          +15 Pts
                        </span>
                        <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-500" />
              <span>Powered by Gemini 2.5 Flash referee engine</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 google-fab-primary rounded-full font-display font-bold text-xs cursor-pointer shadow-sm"
            >
              Back to Game
            </button>
          </div>
        </div>
      </div>

      {/* Drill-down Word Lookup Modal */}
      {selectedWordForLookup && (
        <WordLookupModal
          isOpen={Boolean(selectedWordForLookup)}
          onClose={() => setSelectedWordForLookup(null)}
          initialWord={selectedWordForLookup}
          initialCategory={selectedCategoryForLookup}
          initialLetter={letter}
        />
      )}
    </>
  );
}

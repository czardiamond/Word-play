import React, { useState, useEffect, useMemo } from "react";
import { Player, Answers, PlayerRoundResult, Category, CategoryInfo } from "../types";
import NotebookPaper from "./NotebookPaper";
import SparkleBadge from "./SparkleBadge";
import { classifyWordMove } from "../utils/ratingSystem";
import { addDuolingoXp, speakWord } from "../utils/duolingoSystem";
import { playBadgeFanfare } from "../utils/soundEffects";
import GameAnalysisModal from "./GameAnalysisModal";
import WordLookupModal from "./WordLookupModal";
import {
  Check,
  X,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Trophy,
  ArrowRight,
  ThumbsUp,
  AlertCircle,
  Award,
  BarChart3,
  Volume2,
  MessageSquareQuote,
  BookOpen,
  Search
} from "lucide-react";
import { generateLocalBotAnswers, fetchDynamicBotMoves, getBotPersonalityTaunt } from "../utils/aiBotGenerator";
import { submitRoundScores } from "../utils/roomService";

interface ScoringScreenProps {
  letter: string;
  players: Player[];
  playerAnswers: Record<string, Answers>;
  playerTimes?: Record<string, number>;
  categories: CategoryInfo[];
  difficulty?: "easy" | "medium" | "hard";
  onNextRound: (roundResults: Record<string, PlayerRoundResult>) => void;
  isOnlineMultiplayer?: boolean;
  isHost?: boolean;
  roomCode?: string;
  roundIndex?: number;
  id?: string;
}

export default function ScoringScreen({
  letter,
  players,
  playerAnswers,
  playerTimes,
  categories,
  difficulty = "medium",
  onNextRound,
  isOnlineMultiplayer = false,
  isHost = false,
  roomCode,
  roundIndex,
  id
}: ScoringScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [inspectWord, setInspectWord] = useState<{ word: string; category: string } | null>(null);

  // Results containing words, validations, scores
  const [results, setResults] = useState<Record<string, PlayerRoundResult>>({});

  // Dynamic achievement calculations based on current valid validations and scores
  const roundAchievements = useMemo(() => {
    if (!results || Object.keys(results).length === 0) return {};

    const achievements: Record<
      string,
      { id: string; label: string; icon: string; desc: string; color: string }[]
    > = {};

    players.forEach((p) => {
      achievements[p.id] = [];
    });

    const times: Record<string, number> = {};
    players.forEach((p) => {
      if (p.isBot) {
        const seed = p.id.charCodeAt(0) || 10;
        if (p.botPersonality === "harry") {
          times[p.id] = 16 + (seed % 6);
        } else if (p.botPersonality === "susie") {
          times[p.id] = 30 + (seed % 10);
        } else if (p.botPersonality === "sam") {
          times[p.id] = 45 + (seed % 15);
        } else {
          times[p.id] = 35 + (seed % 10);
        }
      } else {
        times[p.id] = playerTimes?.[p.id] || 60;
      }
    });

    // 1. SPEEDSTER ⚡
    let minTime = Infinity;
    players.forEach((p) => {
      if (times[p.id] < minTime) minTime = times[p.id];
    });
    players.forEach((p) => {
      if (times[p.id] === minTime) {
        achievements[p.id].push({
          id: "speedster",
          label: "Speedster",
          icon: "⚡",
          desc: `Finished in a blistering ${times[p.id]}s!`,
          color: "chip-google-yellow"
        });
      }
    });

    // 2. VOCABULARY MASTER 📖
    let maxLength = 0;
    const longestWordInfo: { playerId: string; word: string; category: string }[] = [];

    players.forEach((p) => {
      const res = results[p.id];
      if (!res) return;
      categories.forEach((cat) => {
        const word = res.answers[cat.id]?.trim() || "";
        const isValid = res.validations?.[cat.id]?.isValid ?? false;
        if (isValid && word.length > maxLength) {
          maxLength = word.length;
        }
      });
    });

    if (maxLength > 0) {
      players.forEach((p) => {
        const res = results[p.id];
        if (!res) return;
        categories.forEach((cat) => {
          const word = res.answers[cat.id]?.trim() || "";
          const isValid = res.validations?.[cat.id]?.isValid ?? false;
          if (isValid && word.length === maxLength) {
            longestWordInfo.push({ playerId: p.id, word, category: cat.label });
          }
        });
      });

      const awardedPlayers = new Set<string>();
      longestWordInfo.forEach((info) => {
        if (!awardedPlayers.has(info.playerId)) {
          awardedPlayers.add(info.playerId);
          achievements[info.playerId].push({
            id: "vocab_master",
            label: "Vocabulary Master",
            icon: "📖",
            desc: `Used the longest valid word: "${info.word}" (${maxLength} letters) for ${info.category}!`,
            color: "chip-google-blue"
          });
        }
      });
    }

    // 3. UNIQUE THINKER 🧠
    let maxUniqueScores = 0;
    const uniqueCounts: Record<string, number> = {};
    players.forEach((p) => {
      uniqueCounts[p.id] = 0;
      const res = results[p.id];
      if (!res || !res.scores) return;
      categories.forEach((cat) => {
        const score = res.scores?.[cat.id] || 0;
        if (score === 15) {
          uniqueCounts[p.id]++;
        }
      });
      if (uniqueCounts[p.id] > maxUniqueScores) {
        maxUniqueScores = uniqueCounts[p.id];
      }
    });

    if (maxUniqueScores > 0) {
      players.forEach((p) => {
        if (uniqueCounts[p.id] === maxUniqueScores) {
          achievements[p.id].push({
            id: "unique_thinker",
            label: "Unique Thinker",
            icon: "🧠",
            desc: `Had ${maxUniqueScores} unique answer(s) that nobody else guessed!`,
            color: "chip-google-green"
          });
        }
      });
    }

    // 4. ALL-ROUND SCHOLAR 🌟
    players.forEach((p) => {
      const res = results[p.id];
      if (!res) return;
      const allValid = categories.every((cat) => {
        const isValid = res.validations?.[cat.id]?.isValid ?? false;
        const word = res.answers[cat.id]?.trim() || "";
        return isValid && word !== "";
      });

      if (allValid) {
        achievements[p.id].push({
          id: "perfect_score",
          label: "All-Round Scholar",
          icon: "🌟",
          desc: `Every single answer starting with "${letter.toUpperCase()}" was approved!`,
          color: "chip-google-blue"
        });
      }
    });

    return achievements;
  }, [results, playerTimes, players, categories, letter]);

  const answersKey = useMemo(() => JSON.stringify(playerAnswers), [playerAnswers]);
  const playersKey = useMemo(() => players.map((p) => p.id).join(","), [players]);
  const categoriesKey = useMemo(() => categories.map((c) => c.id).join(","), [categories]);

  // Fetch AI validations from our server
  useEffect(() => {
    let active = true;

    async function fetchValidations() {
      try {
        setLoading(true);
        setError(null);

        const bots = players.filter((p) => p.isBot);
        const finalAnswers: Record<string, Answers> = { ...playerAnswers };
        const botMetaMap: Record<string, { taunt?: string; estimatedScore?: number; speedSeconds?: number }> = {};

        // Immediately guarantee bot answers from playerAnswers or local dictionary
        bots.forEach((bot) => {
          const existing = finalAnswers[bot.id];
          if (!existing || Object.values(existing).every((v) => !v || v.trim() === "")) {
            finalAnswers[bot.id] = generateLocalBotAnswers(letter, bot, categories, difficulty);
          }
          const pers = (bot.botPersonality || "joe") as "susie" | "harry" | "sam" | "joe";
          botMetaMap[bot.id] = {
            taunt: getBotPersonalityTaunt(pers, letter, difficulty),
            estimatedScore: pers === "susie" ? 75 : pers === "harry" ? 55 : pers === "sam" ? 50 : 65,
            speedSeconds: pers === "harry" ? 14 : pers === "susie" ? 22 : pers === "sam" ? 38 : 28
          };
        });

        const playersPayload = players.map((p) => {
          const answers: Answers = {};
          categories.forEach((cat) => {
            answers[cat.id] = finalAnswers[p.id]?.[cat.id] || "";
          });
          return {
            id: p.id,
            name: p.name,
            answers
          };
        });

        // Fast 5.5-second timeout for validation request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5500);

        const response = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ letter, players: playersPayload, categories, difficulty }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Validation server error");
        }

        const data = await response.json();

        if (active) {
          const validationsMap: Record<string, any> = {};
          data.validations.forEach((val: any) => {
            validationsMap[val.playerId] = val.answers;
          });

          const rawResults: Record<string, PlayerRoundResult> = {};
          players.forEach((p) => {
            const emptyValidations: Record<string, { isValid: boolean; feedback: string }> = {};
            categories.forEach((cat) => {
              emptyValidations[cat.id] = { isValid: false, feedback: "Missing validation" };
            });

            const botMeta = botMetaMap[p.id] || {};

            rawResults[p.id] = {
              playerId: p.id,
              answers: finalAnswers[p.id] || {},
              validations: validationsMap[p.id] || emptyValidations,
              taunt: botMeta.taunt,
              estimatedScore: botMeta.estimatedScore,
              speedSeconds: botMeta.speedSeconds
            };
          });

          const scoredResults = calculateScores(rawResults);
          setResults(scoredResults);
          if (isOnlineMultiplayer && isHost && roomCode && typeof roundIndex === "number") {
            const scoresByPlayer: Record<string, { scores: Record<string, number>; totalRoundScore: number }> = {};
            Object.entries(scoredResults).forEach(([playerId, res]) => {
              if (res.scores) {
                scoresByPlayer[playerId] = {
                  scores: res.scores,
                  totalRoundScore: res.totalRoundScore || 0
                };
              }
            });
            submitRoundScores(roomCode, roundIndex, scoresByPlayer).catch(console.error);
          }
          setLoading(false);
          playBadgeFanfare();
        }
      } catch (err: any) {
        console.error("Grading failed:", err);
        if (active) {
          setError(null);
          setLoading(false);

          const bots = players.filter((p) => p.isBot);
          const fallbackAnswers: Record<string, Answers> = { ...playerAnswers };
          bots.forEach((bot) => {
            if (!fallbackAnswers[bot.id]) {
              fallbackAnswers[bot.id] = generateLocalBotAnswers(letter, bot, categories, difficulty);
            }
          });

          generateLocalFallbackResults(fallbackAnswers);
        }
      }
    }

    fetchValidations();

    return () => {
      active = false;
    };
  }, [letter, playersKey, answersKey, categoriesKey, difficulty]);

  const generateLocalFallbackResults = (answersSource: Record<string, Answers> = playerAnswers) => {
    const rawResults: Record<string, PlayerRoundResult> = {};
    const upperLetter = letter.toUpperCase();

    players.forEach((p) => {
      const answers = answersSource[p.id] || (p.isBot ? generateLocalBotAnswers(letter, p, categories, difficulty) : {});
      const validations: any = {};

      categories.forEach((cat) => {
        const val = answers[cat.id]?.trim() || "";
        if (val === "") {
          validations[cat.id] = { isValid: false, feedback: "Left empty" };
        } else if (val[0].toUpperCase() !== upperLetter) {
          validations[cat.id] = { isValid: false, feedback: `Must start with "${upperLetter}"` };
        } else {
          validations[cat.id] = { isValid: true, feedback: p.isBot ? "AI verified answer" : "Passed letter check" };
        }
      });

      rawResults[p.id] = {
        playerId: p.id,
        answers,
        validations
      };
    });

    const scored = calculateScores(rawResults);
    setResults(scored);
    if (isOnlineMultiplayer && isHost && roomCode && typeof roundIndex === "number") {
      const scoresByPlayer: Record<string, { scores: Record<string, number>; totalRoundScore: number }> = {};
      Object.entries(scored).forEach(([playerId, res]) => {
        if (res.scores) {
          scoresByPlayer[playerId] = {
            scores: res.scores,
            totalRoundScore: res.totalRoundScore || 0
          };
        }
      });
      submitRoundScores(roomCode, roundIndex, scoresByPlayer).catch(console.error);
    }
  };

  const calculateScores = (currentResults: Record<string, PlayerRoundResult>): Record<string, PlayerRoundResult> => {
    const updated = { ...currentResults };

    categories.forEach((cat) => {
      const validSubmissions: { playerId: string; word: string }[] = [];
      players.forEach((p) => {
        const res = updated[p.id];
        const word = res.answers[cat.id]?.trim().toLowerCase() || "";
        const isValid = res.validations?.[cat.id]?.isValid ?? false;

        if (isValid && word !== "") {
          validSubmissions.push({ playerId: p.id, word });
        }
      });

      players.forEach((p) => {
        const res = updated[p.id];
        if (!res.scores) res.scores = {};

        const word = res.answers[cat.id]?.trim().toLowerCase() || "";
        const isValid = res.validations?.[cat.id]?.isValid ?? false;

        if (!isValid || word === "") {
          res.scores[cat.id] = 0;
        } else {
          const matches = validSubmissions.filter((s) => s.word === word);
          const totalValidCountForCat = validSubmissions.length;

          if (totalValidCountForCat === 1) {
            res.scores[cat.id] = 15;
          } else if (matches.length > 1) {
            res.scores[cat.id] = 5;
          } else {
            res.scores[cat.id] = 10;
          }
        }
      });
    });

    players.forEach((p) => {
      const res = updated[p.id];
      if (res.scores) {
        res.totalRoundScore = Object.values(res.scores).reduce((sum, current) => sum + current, 0);
      }
    });

    return updated;
  };

  const toggleValidation = (playerId: string, categoryId: string) => {
    setResults((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const val = copy[playerId].validations[categoryId];

      val.isValid = !val.isValid;
      val.feedback = val.isValid ? "Manually approved by player! ✅" : "Disputed/Rejected! ❌";

      return calculateScores(copy);
    });
  };

  const handleNextRound = () => {
    try {
      addDuolingoXp(25);
    } catch (e) {
      console.error("Duolingo XP error:", e);
    }

    const resultsWithBadges = { ...results };
    players.forEach((p) => {
      if (resultsWithBadges[p.id]) {
        (resultsWithBadges[p.id] as any).badges = roundAchievements[p.id] || [];
      }
    });
    onNextRound(resultsWithBadges);
  };

  if (loading) {
    return (
      <div id={id || "scoring-loading-root"} className="max-w-2xl mx-auto my-8 px-4">
        <NotebookPaper>
          <div className="flex-1 flex flex-col justify-center items-center text-center py-16 space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-blue-500 border-r-[#EA4335] border-b-[#FBBC05] border-l-[#34A853] animate-spin" />
              <span className="absolute font-display font-black text-2xl text-slate-900 dark:text-white">
                {letter}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                Gemini AI is Grading...
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Analyzing word accuracy, dictionary roots, and assigning round scores for letter <strong className="text-blue-600 font-black">"{letter}"</strong>.
              </p>
            </div>

            <div className="w-full max-w-sm h-1.5 google-gradient-bar rounded-full animate-pulse" />
          </div>
        </NotebookPaper>
      </div>
    );
  }

  return (
    <div id={id || "scoring-screen-root"} className="max-w-6xl mx-auto my-6 px-4 space-y-6">
      {/* Dispute info pill */}
      <div className="glass-pill p-3.5 rounded-2xl text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between gap-3 shadow-md border border-slate-200/70 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <ShieldAlert size={18} className="text-amber-500 shrink-0" />
          <span>
            <strong>Interactive Dispute System:</strong> Disagree with an AI decision? Click any word cell to instantly toggle approval and recalculate total scores!
          </span>
        </div>
      </div>

      <NotebookPaper className="overflow-x-auto min-h-[480px]">
        {/* Header of grading page */}
        <div className="flex flex-wrap justify-between items-center border-b border-slate-200/70 dark:border-slate-800/70 pb-4 mb-6 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-black text-slate-900 dark:text-white">
                Round Results: Letter "{letter}"
              </h2>
              <span className="text-xs text-slate-500 font-sans">
                Official scores with move analysis & badge awards
              </span>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Tap cell to override
          </span>
        </div>

        {/* Nostalgic Glass Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                <th className="py-3 px-3">Player</th>
                {categories.map((cat) => (
                  <th key={cat.id} className="py-3 px-3">{cat.label}</th>
                ))}
                <th className="py-3 px-3 text-right">Round Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const res = results[p.id];
                if (!res) return null;

                return (
                  <tr
                    key={p.id}
                    className="border-b border-slate-200/50 dark:border-slate-800/50 hover:bg-slate-500/5 transition-colors"
                  >
                    {/* Player Info */}
                    <td className="py-4 px-3">
                      <div className="flex flex-col gap-1 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <span className="text-lg" role="img" aria-label={p.name}>
                            {p.avatar || "👤"}
                          </span>
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white block leading-tight">
                              {p.name}
                            </span>
                            {p.isBot && (
                              <span className="text-[9px] font-mono text-slate-400">AI BOT</span>
                            )}
                          </div>
                        </div>

                        {/* Badges */}
                        {roundAchievements[p.id] && roundAchievements[p.id].length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {roundAchievements[p.id].map((ach) => (
                              <SparkleBadge
                                key={ach.id}
                                icon={ach.icon}
                                label={ach.label}
                                desc={ach.desc}
                                color={ach.color}
                                size="sm"
                              />
                            ))}
                          </div>
                        )}

                        {/* Bot in-character Taunt Bubble */}
                        {res.taunt && (
                          <div className="mt-1.5 p-1.5 bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/25 rounded-lg text-[10px] text-slate-700 dark:text-slate-200 flex items-start justify-between gap-1 max-w-[220px] animate-fadeIn">
                            <div className="flex items-start gap-1">
                              <MessageSquareQuote size={11} className="text-blue-500 shrink-0 mt-0.5" />
                              <span className="italic leading-tight">"{res.taunt}"</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakWord(res.taunt || "");
                              }}
                              className="p-0.5 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 cursor-pointer"
                              title="Listen to taunt"
                            >
                              <Volume2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Categories Cells */}
                    {categories.map((cat) => {
                      const word = res.answers[cat.id] || "";
                      const validation = res.validations?.[cat.id];
                      const score = res.scores?.[cat.id] ?? 0;
                      const isValid = validation?.isValid ?? false;
                      const moveEval = classifyWordMove(word, isValid, score >= 15, word.trim().length);

                      return (
                        <td key={cat.id} className="py-2.5 px-1.5">
                          <button
                            type="button"
                            onClick={() => toggleValidation(p.id, cat.id)}
                            title={validation?.feedback || "Click to dispute"}
                            className="w-full text-left p-2.5 glass-card rounded-xl transition-all group relative cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Word */}
                              <div className="flex items-center gap-1 min-w-0">
                                <span
                                  className={`text-sm font-bold truncate pr-1 text-slate-900 dark:text-white ${
                                    !isValid ? "line-through opacity-40 text-rose-500" : ""
                                  }`}
                                >
                                  {word === "" ? "-" : word}
                                </span>
                                {word !== "" && (
                                  <div className="flex items-center gap-0.5">
                                    {isValid && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          speakWord(word);
                                        }}
                                        className="p-1 hover:bg-lime-500/20 rounded-full text-lime-600 transition-colors shrink-0 cursor-pointer"
                                        title="Listen to native pronunciation"
                                      >
                                        <Volume2 size={12} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setInspectWord({ word, category: cat.label });
                                      }}
                                      className="p-1 hover:bg-blue-500/20 rounded-full text-blue-600 dark:text-blue-400 transition-colors shrink-0 cursor-pointer opacity-70 group-hover:opacity-100"
                                      title="Inspect word in Gemini Dictionary"
                                    >
                                      <Search size={11} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Validity indicator */}
                              {word !== "" && (
                                <span
                                  className={`shrink-0 text-xs font-bold rounded-full p-1 ${
                                    isValid
                                      ? "text-emerald-600 bg-emerald-500/15"
                                      : "text-rose-500 bg-rose-500/15"
                                  }`}
                                >
                                  {isValid ? <Check size={11} /> : <X size={11} />}
                                </span>
                              )}
                            </div>

                            {/* Score, Move Evaluation Badge */}
                            {word !== "" ? (
                              <div className="flex justify-between items-center mt-1.5 text-[10px] gap-1">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${moveEval.color}`}>
                                  {moveEval.badge} {moveEval.label}
                                </span>
                                <span className="font-bold text-slate-600 dark:text-slate-300">
                                  +{score}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-1 text-[9px] font-mono text-rose-500 font-bold">
                                ‼️ 0 pts
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Total Round Score */}
                    <td className="py-4 px-3 text-right font-display text-lg font-black text-slate-900 dark:text-white">
                      +{res.totalRoundScore} pts
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Dynamic Achievements Showcase Section */}
        <div className="mt-10 pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
          <h3 className="font-display text-base font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="text-amber-500 shrink-0" size={18} />
            <span>Round {letter.toUpperCase()} Achievement Badges</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {players.map((p) => {
              const playerAchs = roundAchievements[p.id] || [];
              if (playerAchs.length === 0) return null;

              return (
                <div
                  key={p.id}
                  className="glass-card p-3.5 rounded-2xl space-y-2.5 flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <span className="text-base">{p.avatar || "👤"}</span>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-white">
                      {p.name}'s Badges
                    </h4>
                  </div>

                  <div className="space-y-2 flex-1">
                    {playerAchs.map((ach) => (
                      <div
                        key={ach.id}
                        className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 shadow-sm ${ach.color}`}
                      >
                        <SparkleBadge
                          icon={ach.icon}
                          label={ach.label}
                          desc={ach.desc}
                          color={ach.color}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] opacity-90 leading-tight mt-0.5">{ach.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 pt-5 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsReviewOpen(true)}
            className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-mono font-bold rounded-2xl transition-all cursor-pointer shadow-md border border-emerald-500/40 flex items-center gap-2 text-xs"
          >
            <BarChart3 size={16} />
            <span>Chess Game Review</span>
          </button>

          {isOnlineMultiplayer && !isHost ? (
            <div className="px-5 py-3.5 glass-pill rounded-2xl text-xs flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <RefreshCw size={14} className="animate-spin text-blue-500" />
              <span>Waiting for host to proceed to leaderboard…</span>
            </div>
          ) : (
            <button
              type="button"
              id="next-round-btn"
              onClick={handleNextRound}
              className="px-7 py-3.5 google-fab-primary font-display font-extrabold text-sm rounded-full shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <span>Advance to Leaderboard</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </NotebookPaper>

      {/* Chess Game Review Modal */}
      <GameAnalysisModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        results={Object.values(results)}
        categories={categories}
        letter={letter}
        players={players}
      />

      {/* Word Inspection & Definition Referee Modal */}
      {inspectWord && (
        <WordLookupModal
          isOpen={Boolean(inspectWord)}
          onClose={() => setInspectWord(null)}
          initialWord={inspectWord.word}
          initialCategory={inspectWord.category}
          initialLetter={letter}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Player, Answers, Category, CategoryInfo } from "../types";
import NotebookPaper from "./NotebookPaper";
import { playSubmitChime } from "../utils/soundEffects";
import {
  Play,
  Hourglass,
  ShieldAlert,
  Sparkles,
  Send,
  AlertCircle,
  Lightbulb,
  Globe,
  Check,
  Clock,
  Square,
  Crown,
  Bot,
  MessageSquareQuote,
  Zap,
  Users,
  Flame
} from "lucide-react";
import {
  submitRoundAnswers,
  advanceToGrading,
  requestStopRound,
  updateHeartbeat,
  updateLiveBoardProgress,
  callStopRound,
  RoomData,
  LivePlayerProgress
} from "../utils/roomService";
import { auth } from "../firebase";
import { fetchDynamicBotMoves, DynamicBotResponse, generateLocalBotAnswers, getBotPersonalityTaunt } from "../utils/aiBotGenerator";

interface GameplayScreenProps {
  letter: string;
  players: Player[];
  timeLimit: number;
  categories: CategoryInfo[];
  difficulty?: "easy" | "medium" | "hard";
  onRoundFinished: (playerAnswers: Record<string, Answers>, playerTimes: Record<string, number>) => void;
  roomCode?: string;
  isOnlineMultiplayer?: boolean;
  localPlayerId?: string;
  onlineRoomData?: RoomData | null;
  isHost?: boolean;
  isRoundController?: boolean;
  roundIndex?: number;
  id?: string;
}

export default function GameplayScreen({
  letter,
  players,
  timeLimit,
  categories,
  difficulty = "medium",
  onRoundFinished,
  roomCode,
  isOnlineMultiplayer = false,
  localPlayerId,
  onlineRoomData,
  isHost = false,
  isRoundController = false,
  roundIndex = 0,
  id
}: GameplayScreenProps) {
  const currentUid = localPlayerId || auth.currentUser?.uid || "";
  const humanPlayers = useMemo(() => players.filter((p) => !p.isBot), [players]);
  const botPlayers = useMemo(() => players.filter((p) => p.isBot), [players]);

  // In online multiplayer, active player is this local device's player
  const myPlayer = isOnlineMultiplayer
    ? humanPlayers.find((p) => p.id === currentUid) || humanPlayers[0] || players[0]
    : humanPlayers[0] || players[0];

  // Pass & Play human index (for offline local games)
  const [currentHumanIndex, setCurrentHumanIndex] = useState(0);
  const activeHuman = isOnlineMultiplayer ? myPlayer : humanPlayers[currentHumanIndex] || humanPlayers[0];

  // Online multiplayer starts revealed immediately
  const [isRevealed, setIsRevealed] = useState(isOnlineMultiplayer);

  // Track seconds elapsed for each player
  const [revealTime, setRevealTime] = useState<number>(() => Date.now());
  const [timesTaken, setTimesTaken] = useState<Record<string, number>>({});
  const [hasSubmittedLocally, setHasSubmittedLocally] = useState(false);

  const hasAdvancedGradingRef = useRef(false);
  const liveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Ref to always have latest onRoundFinished without triggering useEffect loops
  const onRoundFinishedRef = useRef(onRoundFinished);
  useEffect(() => {
    onRoundFinishedRef.current = onRoundFinished;
  }, [onRoundFinished]);

  useEffect(() => {
    if (isRevealed) {
      setRevealTime(Date.now());
    }
  }, [isRevealed, currentHumanIndex]);

  // Heartbeat for online multiplayer
  useEffect(() => {
    if (!isOnlineMultiplayer || !roomCode || !currentUid) return;

    updateHeartbeat(roomCode, currentUid);
    const hbInterval = setInterval(() => {
      updateHeartbeat(roomCode, currentUid);
    }, 10000);

    return () => clearInterval(hbInterval);
  }, [isOnlineMultiplayer, roomCode, currentUid]);

  // Inputs for all players
  const [submissions, setSubmissions] = useState<Record<string, Answers>>(() => {
    const initial: Record<string, Answers> = {};
    players.forEach((p) => {
      const playerAnswers: Answers = {};
      categories.forEach((cat) => {
        playerAnswers[cat.id] = "";
      });
      initial[p.id] = playerAnswers;
    });
    return initial;
  });

  // Track shown hints
  const [shownHints, setShownHints] = useState<Record<string, boolean>>({});
  const toggleHint = (catId: string) => {
    setShownHints((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Current inputs for the active player
  const currentAnswers = submissions[activeHuman?.id || ""] || {};

  // Global round timer
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-uppercase warning helpers
  const [warnings, setWarnings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    categories.forEach((cat) => {
      initial[cat.id] = "";
    });
    return initial;
  });

  const [botStatuses, setBotStatuses] = useState<Record<string, { status: string; progress: number }>>({});
  const [aiBotResponses, setAiBotResponses] = useState<Record<string, DynamicBotResponse>>(() => {
    const initial: Record<string, DynamicBotResponse> = {};
    botPlayers.forEach((b) => {
      const answers = generateLocalBotAnswers(letter, b, categories, difficulty);
      const pers = (b.botPersonality || "joe") as "susie" | "harry" | "sam" | "joe";
      initial[b.id] = {
        id: b.id,
        answers,
        taunt: getBotPersonalityTaunt(pers, letter, difficulty),
        estimatedScore: pers === "susie" ? 75 : pers === "harry" ? 55 : pers === "sam" ? 50 : 65,
        speedSeconds: pers === "harry" ? 14 : pers === "susie" ? 22 : pers === "sam" ? 38 : 28,
        source: "local-fallback"
      };
    });
    return initial;
  });
  const [displayedTaunts, setDisplayedTaunts] = useState<Record<string, string>>({});

  // Stable ref storage for latest state when callbacks fire
  const submissionsRef = useRef(submissions);
  submissionsRef.current = submissions;

  const timesTakenRef = useRef(timesTaken);
  timesTakenRef.current = timesTaken;

  const aiBotResponsesRef = useRef(aiBotResponses);
  aiBotResponsesRef.current = aiBotResponses;

  const handleAutoSubmit = useCallback(async () => {
    playSubmitChime();
    const elapsed = revealTime > 0 ? Math.max(1, Math.round((Date.now() - revealTime) / 1000)) : timeLimit;
    const activeId = activeHuman?.id;
    if (!activeId) return;

    const currentSubmissions = submissionsRef.current;
    const nextTimes = {
      ...timesTakenRef.current,
      [activeId]: elapsed
    };
    setTimesTaken(nextTimes);
    setHasSubmittedLocally(true);

    if (isOnlineMultiplayer && roomCode) {
      try {
        await submitRoundAnswers(roomCode, roundIndex, activeId, currentSubmissions[activeId] || {});
        // Also update live progress as submitted
        updateLiveBoardProgress(roomCode, activeId, {
          filledCount: Object.values(currentSubmissions[activeId] || {}).filter((v) => typeof v === "string" && v.trim().length > 0).length,
          totalCount: categories.length,
          isSubmitted: true
        });
      } catch (err) {
        console.error("Error submitting round answers to Firestore:", err);
      }
    } else {
      // Local Pass & Play flow
      if (currentHumanIndex < humanPlayers.length - 1) {
        setCurrentHumanIndex((prev) => prev + 1);
        setIsRevealed(false);
        setHasSubmittedLocally(false);
        setTimeLeft(timeLimit);
      } else {
        const finalPayload: Record<string, Answers> = { ...currentSubmissions };
        botPlayers.forEach((bot) => {
          const botAns = aiBotResponsesRef.current[bot.id]?.answers;
          if (botAns && Object.keys(botAns).length > 0) {
            finalPayload[bot.id] = botAns;
          } else {
            finalPayload[bot.id] = generateLocalBotAnswers(letter, bot, categories, difficulty);
          }
        });
        onRoundFinishedRef.current(finalPayload, nextTimes);
      }
    }
  }, [
    revealTime,
    timeLimit,
    activeHuman?.id,
    isOnlineMultiplayer,
    roomCode,
    roundIndex,
    categories.length,
    currentHumanIndex,
    humanPlayers.length,
    botPlayers
  ]);

  // React when matchPhase flips to GRADING or stop was called
  useEffect(() => {
    if (isOnlineMultiplayer && onlineRoomData?.matchPhase === "GRADING" && !hasSubmittedLocally) {
      handleAutoSubmit();
    }
  }, [onlineRoomData?.matchPhase, isOnlineMultiplayer, hasSubmittedLocally, handleAutoSubmit]);

  // Host-only effect: check when all human players have submitted in Firestore
  useEffect(() => {
    if (!isOnlineMultiplayer || !isHost || !roomCode || hasAdvancedGradingRef.current) return;

    const roundKey = String(roundIndex);
    const roundSubs = onlineRoomData?.roundSubmissions?.[roundKey] || {};

    const allSubmitted =
      humanPlayers.length > 0 &&
      humanPlayers.every((hp) => Boolean(roundSubs[hp.id]));

    if (allSubmitted) {
      hasAdvancedGradingRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);

      const assembledAnswers: Record<string, Answers> = { ...submissionsRef.current };
      const assembledTimes: Record<string, number> = { ...timesTakenRef.current };

      humanPlayers.forEach((hp) => {
        if (roundSubs[hp.id]) {
          assembledAnswers[hp.id] = roundSubs[hp.id];
          if (!assembledTimes[hp.id]) assembledTimes[hp.id] = Math.round(timeLimit * 0.5) || 25;
        }
      });

      botPlayers.forEach((bot) => {
        const botAns = aiBotResponsesRef.current[bot.id]?.answers;
        if (botAns && Object.keys(botAns).length > 0) {
          assembledAnswers[bot.id] = botAns;
        } else {
          assembledAnswers[bot.id] = generateLocalBotAnswers(letter, bot, categories, difficulty);
        }
        if (!assembledTimes[bot.id]) {
          assembledTimes[bot.id] = aiBotResponsesRef.current[bot.id]?.speedSeconds || Math.round(timeLimit * 0.6) || 30;
        }
      });

      advanceToGrading(roomCode).catch((err) => console.error("advanceToGrading error:", err));

      const timer = setTimeout(() => {
        onRoundFinishedRef.current(assembledAnswers, assembledTimes);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [
    isOnlineMultiplayer,
    isHost,
    roomCode,
    roundIndex,
    onlineRoomData?.roundSubmissions,
    humanPlayers,
    botPlayers,
    timeLimit
  ]);

  // Prefetch dynamic bot moves
  useEffect(() => {
    if (!isRevealed || botPlayers.length === 0) return;

    let active = true;
    async function loadAiMoves() {
      try {
        const dynamicMoves = await fetchDynamicBotMoves(letter, botPlayers, categories, difficulty);
        if (active && dynamicMoves) {
          setAiBotResponses(dynamicMoves);
          
          const initialTaunts: Record<string, string> = {};
          botPlayers.forEach((b) => {
            if (dynamicMoves[b.id]?.taunt) {
              initialTaunts[b.id] = dynamicMoves[b.id].taunt;
            }
          });
          setDisplayedTaunts(initialTaunts);
        }
      } catch (err) {
        console.warn("AI moves prefetch notice:", err);
      }
    }

    loadAiMoves();

    return () => {
      active = false;
    };
  }, [isRevealed, letter, botPlayers, categories, difficulty]);

  // Initialize bot status simulation
  useEffect(() => {
    if (!isRevealed || botPlayers.length === 0) return;

    const initialStatuses: Record<string, { status: string; progress: number }> = {};
    botPlayers.forEach((bot) => {
      initialStatuses[bot.id] = { status: "Preparing answers...", progress: 0 };
    });
    setBotStatuses(initialStatuses);

    const intervals = botPlayers.map((bot) => {
      let progress = 0;
      const totalSteps = categories.length;
      const speedMultiplier = difficulty === "easy" ? 1.5 : difficulty === "hard" ? 0.7 : 1.0;
      const baseSpeed =
        bot.botPersonality === "harry" ? 2200 : bot.botPersonality === "susie" ? 4200 : bot.botPersonality === "joe" ? 5500 : 6500;

      const speed = Math.round(baseSpeed * speedMultiplier);

      const interval = setInterval(() => {
        progress += 1;
        if (progress <= totalSteps) {
          const currentCatLabel = categories[progress - 1]?.label || "Next";
          let statusStr = `Formulating ${currentCatLabel}...`;
          if (progress === totalSteps) {
            statusStr = bot.botPersonality === "harry" ? "Lightning speed finish! ⚡" : bot.botPersonality === "susie" ? "Precision dictionary verified! 🤓" : "All answers locked in! ✍️";
          }
          setBotStatuses((prev) => ({
            ...prev,
            [bot.id]: { status: statusStr, progress }
          }));
        } else {
          clearInterval(interval);
        }
      }, speed + Math.random() * 1200);

      return interval;
    });

    return () => {
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, [isRevealed, botPlayers, categories, difficulty]);

  // Synchronized Firestore countdown timer effect
  useEffect(() => {
    if (!isRevealed || timeLimit === 0 || hasSubmittedLocally) return;

    const computeSynchronizedTime = () => {
      if (isOnlineMultiplayer && onlineRoomData?.roundStartedAt) {
        const elapsed = Math.max(0, Math.floor((Date.now() - onlineRoomData.roundStartedAt) / 1000));
        return Math.max(0, timeLimit - elapsed);
      }
      return null;
    };

    const interval = setInterval(() => {
      const synced = computeSynchronizedTime();
      if (synced !== null) {
        setTimeLeft(synced);
        if (synced <= 0) {
          clearInterval(interval);
          handleAutoSubmit();
        }
      } else {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isRevealed, timeLimit, hasSubmittedLocally, isOnlineMultiplayer, onlineRoomData?.roundStartedAt, handleAutoSubmit]);

  const handleInputChange = (category: Category, value: string) => {
    let formattedVal = value;
    if (formattedVal.length > 0 && formattedVal[0].toUpperCase() !== letter.toUpperCase()) {
      setWarnings((prev) => ({
        ...prev,
        [category]: `Must start with "${letter.toUpperCase()}"`
      }));
    } else {
      setWarnings((prev) => ({
        ...prev,
        [category]: ""
      }));
    }

    const nextAnswers = {
      ...submissions[activeHuman.id],
      [category]: formattedVal
    };

    setSubmissions((prev) => ({
      ...prev,
      [activeHuman.id]: nextAnswers
    }));

    // Calculate completed categories and push live board update to Firestore
    if (isOnlineMultiplayer && roomCode && activeHuman?.id) {
      const validCompletedCats = Object.entries(nextAnswers)
        .filter(([_, val]) => typeof val === "string" && val.trim().length > 0 && val.trim()[0].toUpperCase() === letter.toUpperCase())
        .map(([cId]) => cId);

      if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
      liveDebounceRef.current = setTimeout(() => {
        updateLiveBoardProgress(roomCode, activeHuman.id, {
          filledCount: validCompletedCats.length,
          totalCount: categories.length,
          activeCategory: category,
          completedCategories: validCompletedCats,
          isSubmitted: false
        });
      }, 250);
    }
  };

  const handleManualSubmit = () => {
    playSubmitChime();
    if (timerRef.current) clearInterval(timerRef.current);

    if (isOnlineMultiplayer && roomCode && isSheetComplete) {
      callStopRound(roomCode, activeHuman.id, activeHuman.name);
    }
    handleAutoSubmit();
  };

  const isSheetComplete = Object.values(currentAnswers).every((val) => typeof val === "string" && val.trim() !== "");

  const roundKey = String(roundIndex);
  const liveRoundSubs = onlineRoomData?.roundSubmissions?.[roundKey] || {};
  const liveProgressMap = onlineRoomData?.liveBoardProgress || {};
  const stopCalledBy = onlineRoomData?.stopCalledBy;

  return (
    <div id={id || "gameplay-screen-root"} className="max-w-5xl mx-auto my-6 px-4">
      {/* Emergency Stop Called Alert Banner */}
      {stopCalledBy && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-800 dark:text-rose-200 flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛑</span>
            <div>
              <div className="font-display font-extrabold text-sm sm:text-base">
                {stopCalledBy.name} filled all categories and called STOP!
              </div>
              <div className="text-xs opacity-80">
                Locking in all answers across all devices and calculating scores...
              </div>
            </div>
          </div>
          <span className="px-3 py-1 bg-rose-500 text-white rounded-full text-xs font-mono font-bold animate-pulse">
            ROUND STOPPED
          </span>
        </div>
      )}

      {!isRevealed ? (
        /* PASS & PLAY SCREEN */
        <NotebookPaper>
          <div className="flex-1 flex flex-col justify-center items-center text-center py-12 max-w-xl mx-auto space-y-6">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-400 animate-float shadow-lg">
              <ShieldAlert size={36} />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tracking-wider uppercase block">
                Local Pass & Play
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
                It's {activeHuman?.name}'s Turn!
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                Pass the device to <strong className="text-slate-900 dark:text-white">{activeHuman?.name}</strong>. Keep your answers secret from other players! 🤫
              </p>
            </div>

            <div className="glass-card p-4 rounded-2xl text-left text-xs text-slate-700 dark:text-slate-200 flex items-start gap-3 border border-slate-200/70 dark:border-slate-700/70">
              <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>Active Letter Locked</strong>: You will have {timeLimit === 0 ? "unlimited time" : `${timeLimit} seconds`} to complete words starting with <strong className="text-lg font-black text-blue-600 dark:text-blue-400">"{letter}"</strong>.
              </div>
            </div>

            <button
              type="button"
              id="reveal-sheet-btn"
              onClick={() => setIsRevealed(true)}
              className="px-8 py-4 google-fab-primary font-display font-extrabold text-sm rounded-full shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Play size={16} /> I'm Ready, Reveal Card!
            </button>
          </div>
        </NotebookPaper>
      ) : (
        /* ACTIVE GAMEPLAY SHEET */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Card Sheet */}
          <div className="lg:col-span-8">
            <NotebookPaper>
              {/* Header inside notebook */}
              <div className="flex flex-wrap justify-between items-center border-b border-slate-200/70 dark:border-slate-800/70 pb-4 mb-6 gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#EA4335]" />
                    <h3 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{activeHuman?.name}'s Card</span>
                    </h3>
                    {isOnlineMultiplayer && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold rounded-full flex items-center gap-1">
                        <Globe size={11} /> #{roomCode}
                      </span>
                    )}
                    {isOnlineMultiplayer && isRoundController && (
                      <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full flex items-center gap-1">
                        <Crown size={11} className="text-amber-500" /> Controller
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-500 font-sans">
                      Target letter:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-display font-black text-sm border border-blue-500/30">
                      {letter}
                    </span>
                  </div>
                </div>

                {/* Right controls: Controller Early-Stop & Synchronized Timer */}
                <div className="flex items-center gap-2">
                  {isOnlineMultiplayer && isRoundController && (
                    <button
                      type="button"
                      id="controller-stop-round-btn"
                      onClick={() => {
                        if (roomCode && currentUid) {
                          requestStopRound(roomCode, roundIndex, currentUid).catch(console.error);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      title="Stop round early for all players"
                    >
                      <Square size={11} className="fill-rose-500 text-rose-500" /> Stop Round 🛑
                    </button>
                  )}

                  {/* Timer Display */}
                  {timeLimit > 0 && (
                    <div
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-mono text-sm border font-bold shadow-sm ${
                        timeLeft <= 10
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      }`}
                    >
                      <Hourglass size={14} />
                      <span>{timeLeft}s</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Category Entry Rows */}
              <div className="space-y-4 flex-1">
                {categories.map((cat) => {
                  // Find if opponents have placed a tile in this category
                  const opponentsWithTile = isOnlineMultiplayer
                    ? humanPlayers.filter((p) => {
                        if (p.id === activeHuman?.id) return false;
                        const oppProgress = liveProgressMap[p.id];
                        return oppProgress?.completedCategories?.includes(cat.id);
                      })
                    : [];

                  return (
                    <div
                      key={cat.id}
                      className="glass-card p-3 sm:p-4 rounded-2xl relative transition-all border border-slate-200/70 dark:border-slate-800"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {/* Category Label with live tile indicators */}
                        <div className="w-40 shrink-0 flex items-center justify-between sm:justify-start gap-1.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="font-display text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={cat.label}>
                              {cat.label}
                            </span>
                          </div>

                          {/* Live Opponent Placement Indicator Badge */}
                          {opponentsWithTile.length > 0 && (
                            <div className="flex -space-x-1 sm:ml-2">
                              {opponentsWithTile.map((opp) => (
                                <span
                                  key={opp.id}
                                  title={`${opp.name} placed a tile here!`}
                                  className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] flex items-center justify-center animate-bounce shadow-sm"
                                >
                                  {opp.avatar || "👤"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Glass Input Field */}
                        <div className="flex-1 relative flex items-center gap-2">
                          <input
                            type="text"
                            disabled={hasSubmittedLocally}
                            value={currentAnswers[cat.id] || ""}
                            onChange={(e) => handleInputChange(cat.id, e.target.value)}
                            placeholder={`Enter word starting with "${letter}"`}
                            className={`w-full glass-input rounded-xl py-2.5 px-3.5 text-sm sm:text-base font-bold transition-all text-slate-900 dark:text-white placeholder:text-slate-400 ${
                              hasSubmittedLocally ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                          />

                          {/* Clue Button */}
                          <button
                            type="button"
                            disabled={hasSubmittedLocally}
                            onClick={() => toggleHint(cat.id)}
                            className="p-2.5 glass-pill rounded-xl text-amber-600 dark:text-amber-400 text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-30"
                            title="View clue"
                          >
                            <Lightbulb size={14} />
                          </button>
                        </div>
                      </div>

                      {warnings[cat.id] && (
                        <div className="mt-2 text-xs text-rose-500 font-sans flex items-center gap-1">
                          <AlertCircle size={12} /> {warnings[cat.id]}
                        </div>
                      )}

                      {/* Hint Box */}
                      {shownHints[cat.id] && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between animate-fadeIn">
                          <span>
                            💡 <b>Idea Clue:</b> Vocabulary matching <b>{cat.label}</b> starting with <b>'{letter.toUpperCase()}'</b>
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleHint(cat.id)}
                            className="text-amber-700 dark:text-amber-400 text-xs font-bold underline ml-2 cursor-pointer"
                          >
                            Hide
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-5 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-xs text-slate-500 italic">
                  {hasSubmittedLocally
                    ? "Your sheet is locked in! Waiting for other players..."
                    : isSheetComplete
                    ? "All categories filled! Press Stop to freeze opponents!"
                    : `Fill all ${categories.length} categories to stop the round immediately!`}
                </span>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    id="submit-sheet-btn"
                    disabled={hasSubmittedLocally}
                    onClick={handleManualSubmit}
                    className={`w-full sm:w-auto px-8 py-3.5 font-display font-extrabold text-sm rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-60 disabled:cursor-not-allowed ${
                      hasSubmittedLocally
                        ? "bg-emerald-600 text-white"
                        : isSheetComplete
                        ? "bg-[#EA4335] hover:bg-[#d93025] text-white shadow-rose-500/20 animate-pulse"
                        : "google-fab-primary"
                    }`}
                  >
                    {hasSubmittedLocally ? (
                      <>
                        <Check size={16} /> Submitted!
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>{isSheetComplete ? "STOP THE ROUND! 🛑" : "Submit Answers ✍️"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </NotebookPaper>
          </div>

          {/* Sidebar - Real-Time Duel Opponents & AI Bot Sync */}
          <div className="lg:col-span-4 space-y-4">
            {/* Live Online Match Status */}
            {isOnlineMultiplayer && (
              <div className="glass-canvas rounded-3xl p-5 shadow-lg space-y-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="border-b border-slate-200/60 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users size={15} className="text-blue-500" /> Live Match Duel
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Real-Time Sync
                  </span>
                </div>

                <div className="space-y-2.5">
                  {humanPlayers.map((p) => {
                    const isMe = p.id === activeHuman?.id;
                    const hasSubmitted = Boolean(liveRoundSubs[p.id]) || (isMe && hasSubmittedLocally);
                    const isController = p.id === onlineRoomData?.roundControllerId;
                    const liveProg = liveProgressMap[p.id];
                    const filledCount = isMe
                      ? Object.values(currentAnswers).filter((v) => typeof v === "string" && v.trim().length > 0 && v.trim()[0].toUpperCase() === letter.toUpperCase()).length
                      : liveProg?.filledCount || 0;

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl border space-y-2 transition-all ${
                          hasSubmitted
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                            : "glass-card border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{p.avatar || "👤"}</span>
                            <div>
                              <div className="font-bold text-xs flex items-center gap-1.5">
                                <span>{p.name} {isMe ? "(You)" : ""}</span>
                                {isController && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 rounded-full font-bold">
                                    👑 Turn
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="text-[11px] font-mono font-bold text-slate-500">
                            {filledCount}/{categories.length} Tiles
                          </span>
                        </div>

                        {/* Live Tile Placement Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              hasSubmitted || filledCount === categories.length
                                ? "bg-emerald-500"
                                : "bg-gradient-to-r from-blue-500 to-indigo-600"
                            }`}
                            style={{ width: `${(filledCount / categories.length) * 100}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 flex items-center gap-1">
                            {hasSubmitted ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Check size={12} /> Answers Locked In
                              </span>
                            ) : liveProg?.activeCategory ? (
                              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Zap size={11} className="animate-pulse" /> Writing in {liveProg.activeCategory}...
                              </span>
                            ) : (
                              <span>Writing answers...</span>
                            )}
                          </span>

                          {hasSubmitted ? (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-bold">
                              Ready
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-semibold">
                              Live
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AI Opponents Sidebar */}
            {botPlayers.length > 0 && (
              <div className="glass-canvas rounded-3xl p-5 shadow-lg space-y-4 border border-slate-200/70 dark:border-slate-800">
                <div className="border-b border-slate-200/60 dark:border-slate-800 pb-3 flex items-center justify-between">
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Bot size={16} className="text-blue-500" /> AI Opponents
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">Live Progress</span>
                </div>

                <div className="space-y-3.5">
                  {botPlayers.map((bot) => {
                    const status = botStatuses[bot.id] || { status: "Thinking...", progress: 0 };
                    const isDone = status.progress >= categories.length;

                    return (
                      <div key={bot.id} className="glass-card p-3 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{bot.avatar}</span>
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {bot.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {status.progress}/{categories.length}
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDone ? "bg-[#34A853]" : "google-gradient-bar animate-pulse"
                            }`}
                            style={{ width: `${(status.progress / categories.length) * 100}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] block font-medium ${isDone ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-500"}`}>
                            {status.status}
                          </span>
                          {aiBotResponses[bot.id]?.estimatedScore && (
                            <span className="text-[10px] font-mono font-bold text-amber-500">
                              ~{aiBotResponses[bot.id].estimatedScore} pts
                            </span>
                          )}
                        </div>

                        {/* Live In-Character Taunt / Speech Bubble */}
                        {displayedTaunts[bot.id] && (
                          <div className="mt-2 p-2 bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/25 rounded-xl text-[10px] text-slate-700 dark:text-slate-200 flex items-start gap-1.5 animate-fadeIn">
                            <MessageSquareQuote size={12} className="text-blue-500 shrink-0 mt-0.5" />
                            <span className="italic leading-snug">"{displayedTaunts[bot.id]}"</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

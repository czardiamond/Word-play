import React, { useState, useEffect, useMemo } from "react";
import { GameState, Player, Round, Answers, PlayerRoundResult, CategoryInfo } from "./types";
import SetupScreen from "./components/SetupScreen";
import WheelSpinner from "./components/WheelSpinner";
import GameplayScreen from "./components/GameplayScreen";
import ScoringScreen from "./components/ScoringScreen";
import NotebookPaper from "./components/NotebookPaper";
import MasterToolbar from "./components/MasterToolbar";
import SparkleBadge from "./components/SparkleBadge";
import WinnerCelebrationOverlay from "./components/WinnerCelebrationOverlay";
import GameAnalysisModal from "./components/GameAnalysisModal";
import { saveHighScore } from "./utils/highScores";
import { recordCompletedMatch } from "./utils/duolingoSystem";
import { recordUserMatchHistory, syncUserProfile } from "./utils/userProfileService";
import {
  getUserRatingLocal,
  calculateEloDelta,
  updateUserRatingCloud,
  getRankTitle,
  BOT_RATINGS
} from "./utils/ratingSystem";
import {
  RoomData,
  subscribeToRoom,
  initMatchConfig,
  enterSpinPhase,
  spinLetter,
  getRoundController,
  endMatch
} from "./utils/roomService";
import { auth, onAuthStateChanged } from "./firebase";
import { Trophy, RefreshCw, RotateCcw, Download, Crown, Sparkles, BarChart3 } from "lucide-react";

const ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "V", "W", "Y"
];

function CountdownDisplay({ to }: { to?: number | null }) {
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    if (!to) {
      setSeconds(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((to - Date.now()) / 1000));
      setSeconds((prev) => (prev === remaining ? prev : remaining));
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [to]);

  return <span className="font-mono font-bold text-amber-600">{seconds}s</span>;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    rounds: [],
    currentRoundIndex: 0,
    gamePhase: "SETUP",
    categories: [
      { id: "name", label: "Name" },
      { id: "animal", label: "Animal" },
      { id: "food", label: "Food" },
      { id: "place", label: "Place" },
      { id: "thing", label: "Thing" }
    ],
    roundTimeLimit: 60
  });

  const [activeLetter, setActiveLetter] = useState<string>("");
  const [activeHumanAnswers, setActiveHumanAnswers] = useState<Record<string, Answers>>({});
  const [activeHumanTimes, setActiveHumanTimes] = useState<Record<string, number>>({});
  const [activeOnlineRoomCode, setActiveOnlineRoomCode] = useState<string | null>(null);
  const [onlineRoomData, setOnlineRoomData] = useState<RoomData | null>(null);
  const [isSummaryAnalysisOpen, setIsSummaryAnalysisOpen] = useState<boolean>(false);

  const currentUid = auth.currentUser?.uid || "";

  // Continuous user profile and cloud memory sync on auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        syncUserProfile(user).catch(console.warn);
      }
    });
    return () => unsub();
  }, []);

  const humanPlayers = useMemo(() => gameState.players.filter((p) => !p.isBot), [gameState.players]);
  const isOnlineMultiplayer = Boolean(activeOnlineRoomCode) && humanPlayers.length >= 2;
  const localPlayerId = currentUid || humanPlayers[0]?.id || "";

  // Controller of the current round
  const roomPlayers = onlineRoomData?.players || [];
  const calculatedController = roomPlayers.length > 0
    ? getRoundController(roomPlayers, gameState.currentRoundIndex)
    : null;

  const roundControllerId = onlineRoomData?.roundControllerId || calculatedController?.id || gameState.players[0]?.id;
  const isRoundController = !isOnlineMultiplayer || (localPlayerId === roundControllerId);

  const controllerPlayer = gameState.players.find((p) => p.id === roundControllerId) ||
    roomPlayers.find((p) => p.id === roundControllerId);
  const controllerName = controllerPlayer?.name || "Round Controller";

  const isHost = Boolean(
    onlineRoomData?.players?.[0]?.id === localPlayerId ||
    onlineRoomData?.players?.find((p) => p.isHost)?.id === localPlayerId ||
    (gameState.players[0]?.id === localPlayerId)
  );

  // Firestore live sync listener for online multiplayer rooms (only depends on activeOnlineRoomCode)
  useEffect(() => {
    if (!activeOnlineRoomCode) {
      setOnlineRoomData(null);
      return;
    }

    const unsub = subscribeToRoom(activeOnlineRoomCode, (room) => {
      if (!room) return;

      setOnlineRoomData((prev) => {
        if (
          prev &&
          prev.matchPhase === room.matchPhase &&
          prev.currentLetter === room.currentLetter &&
          prev.currentRoundIndex === room.currentRoundIndex &&
          prev.roundControllerId === room.roundControllerId &&
          prev.spinDeadlineAt === room.spinDeadlineAt &&
          JSON.stringify(prev.roundSubmissions) === JSON.stringify(room.roundSubmissions) &&
          JSON.stringify(prev.players) === JSON.stringify(room.players)
        ) {
          return prev;
        }
        return room;
      });

      // Mirror the room's phase and round into local gameState
      if (room.matchPhase) {
        setGameState((prev) => {
          const needsPhaseUpdate = room.matchPhase && room.matchPhase !== prev.gamePhase;
          const needsRoundUpdate = typeof room.currentRoundIndex === "number" && room.currentRoundIndex !== prev.currentRoundIndex;
          if (!needsPhaseUpdate && !needsRoundUpdate) return prev;
          return {
            ...prev,
            gamePhase: room.matchPhase || prev.gamePhase,
            currentRoundIndex: typeof room.currentRoundIndex === "number" ? room.currentRoundIndex : prev.currentRoundIndex
          };
        });
      }

      if (room.currentLetter) {
        setActiveLetter((prev) => (prev === room.currentLetter ? prev : room.currentLetter!));
      }

      // If in GRADING and submissions arrive from Firestore, populate activeHumanAnswers
      if (room.matchPhase === "GRADING" && room.roundSubmissions) {
        const roundKey = String(room.currentRoundIndex ?? 0);
        const submissionsForRound = room.roundSubmissions[roundKey];
        if (submissionsForRound && Object.keys(submissionsForRound).length > 0) {
          setActiveHumanAnswers((prev) => {
            const hasChange = Object.entries(submissionsForRound).some(([pId, ans]) => {
              return JSON.stringify(prev[pId]) !== JSON.stringify(ans);
            });
            if (!hasChange) return prev;
            return {
              ...prev,
              ...submissionsForRound
            };
          });
        }
      }
    });

    return () => unsub();
  }, [activeOnlineRoomCode]);

  // Auto-spin watchdog (runs on every client, not just the controller)
  useEffect(() => {
    if (
      !isOnlineMultiplayer ||
      !activeOnlineRoomCode ||
      gameState.gamePhase !== "SPIN" ||
      !onlineRoomData?.spinDeadlineAt ||
      onlineRoomData.currentLetter
    ) {
      return;
    }

    const msRemaining = onlineRoomData.spinDeadlineAt - Date.now();
    if (msRemaining <= 0) {
      const fallbackLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      spinLetter(activeOnlineRoomCode, gameState.currentRoundIndex, fallbackLetter, localPlayerId).catch(console.error);
      return;
    }

    const timeout = setTimeout(() => {
      const fallbackLetter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      spinLetter(activeOnlineRoomCode, gameState.currentRoundIndex, fallbackLetter, localPlayerId).catch(console.error);
    }, msRemaining);

    return () => clearTimeout(timeout);
  }, [
    isOnlineMultiplayer,
    activeOnlineRoomCode,
    gameState.gamePhase,
    gameState.currentRoundIndex,
    onlineRoomData?.spinDeadlineAt,
    onlineRoomData?.currentLetter,
    localPlayerId
  ]);

  // 1. Initialize Game
  const handleStartGame = (
    players: Player[],
    roundTimeLimit: number,
    categories: CategoryInfo[],
    difficulty: "easy" | "medium" | "hard" = "medium"
  ) => {
    setActiveOnlineRoomCode(null);
    setOnlineRoomData(null);
    setGameState((prev) => ({
      ...prev,
      players,
      roundTimeLimit,
      categories,
      difficulty,
      rounds: [],
      currentRoundIndex: 0,
      gamePhase: "SPIN"
    }));
  };

  // Start Online Game Room
  const handleStartOnlineGame = async (players: Player[], roomCode: string, roomData?: RoomData) => {
    setActiveOnlineRoomCode(roomCode);
    if (roomData) setOnlineRoomData(roomData);

    const chosenCategories = roomData?.categories && roomData.categories.length > 0 ? roomData.categories : gameState.categories;
    const timeLimit = roomData?.timeLimit || 60;

    const realHumanCount = players.filter((p) => !p.isBot).length;
    const isHostPlayer = Boolean(
      roomData?.players?.[0]?.isHost &&
      (roomData.players[0].id === currentUid || roomData.players[0].id === players[0]?.id)
    );

    // If host in real multiplayer (2+ humans), initialize room match config in Firestore
    if (realHumanCount >= 2 && isHostPlayer) {
      try {
        await initMatchConfig(roomCode, chosenCategories, timeLimit, roomData?.players);
      } catch (e) {
        console.warn("initMatchConfig error:", e);
      }
    }

    if (roomData?.currentLetter) {
      setActiveLetter(roomData.currentLetter);
      setGameState((prev) => ({
        ...prev,
        players,
        categories: chosenCategories,
        roundTimeLimit: timeLimit,
        rounds: [],
        currentRoundIndex: roomData?.currentRoundIndex || 0,
        gamePhase: "PLAYING"
      }));
    } else {
      setGameState((prev) => ({
        ...prev,
        players,
        categories: chosenCategories,
        roundTimeLimit: timeLimit,
        rounds: [],
        currentRoundIndex: 0,
        gamePhase: "SPIN"
      }));
    }
  };

  // 2. Start Round (Letter chosen)
  const handleLetterSelected = (letter: string) => {
    setActiveLetter(letter);
    setGameState((prev) => ({
      ...prev,
      gamePhase: "PLAYING"
    }));
  };

  // 3. Collect active human answers and transition to grading
  const handleRoundFinished = (humanAnswers: Record<string, Answers>, humanTimes: Record<string, number>) => {
    setActiveHumanAnswers(humanAnswers);
    setActiveHumanTimes(humanTimes);
    setGameState((prev) => ({
      ...prev,
      gamePhase: "GRADING"
    }));
  };

  // 4. Conclude grading, save round results, show round summary
  const handleNextRound = (roundResults: Record<string, PlayerRoundResult>) => {
    const newRound: Round = {
      roundNumber: gameState.currentRoundIndex + 1,
      letter: activeLetter,
      results: roundResults,
      isCompleted: true
    };

    const updatedRounds = [...gameState.rounds, newRound];

    // Compute updated scores
    const updatedScores: Record<string, number> = {};
    gameState.players.forEach((p) => {
      updatedScores[p.id] = 0;
    });

    updatedRounds.forEach((round) => {
      Object.keys(round.results).forEach((playerId) => {
        const score = round.results[playerId]?.totalRoundScore || 0;
        updatedScores[playerId] = (updatedScores[playerId] || 0) + score;
      });
    });

    // Find highest scoring player for winner tag
    let topScore = -1;
    let topPlayerId = "";
    Object.entries(updatedScores).forEach(([pId, score]) => {
      if (score > topScore) {
        topScore = score;
        topPlayerId = pId;
      }
    });

    // Save to local storage high scores and update user Elo rating
    const humanPlayer = gameState.players.find((p) => !p.isBot);
    const bots = gameState.players.filter((p) => p.isBot);

    if (humanPlayer) {
      const humanScore = updatedScores[humanPlayer.id] || 0;
      const isHumanWinner = humanPlayer.id === topPlayerId;
      const isTie = Object.values(updatedScores).filter((s) => s === topScore).length > 1;

      // Estimate average opponent Elo
      let avgOpponentElo = 1200;
      if (bots.length > 0) {
        const totalBotElo = bots.reduce((sum, b) => {
          const bElo = b.botPersonality ? BOT_RATINGS[b.botPersonality]?.rating || 1200 : 1200;
          return sum + bElo;
        }, 0);
        avgOpponentElo = Math.round(totalBotElo / bots.length);
      }

      const currentProfile = getUserRatingLocal();
      const eloDelta = calculateEloDelta(currentProfile.rating, avgOpponentElo, isHumanWinner && !isTie, isTie);
      const newRating = Math.max(100, currentProfile.rating + eloDelta);
      const newPeak = Math.max(currentProfile.peakRating, newRating);

      const updatedProfile = {
        ...currentProfile,
        rating: newRating,
        peakRating: newPeak,
        wins: currentProfile.wins + (isHumanWinner && !isTie ? 1 : 0),
        losses: currentProfile.losses + (!isHumanWinner && !isTie ? 1 : 0),
        draws: currentProfile.draws + (isTie ? 1 : 0),
        totalMatches: currentProfile.totalMatches + 1,
        title: getRankTitle(newRating)
      };

      updateUserRatingCloud(updatedProfile);

      // Record personal match history for user profile
      try {
        const lettersList = updatedRounds.map((r) => r.letter);
        const sortedPlayers = [...gameState.players].sort((a, b) => (updatedScores[b.id] || 0) - (updatedScores[a.id] || 0));
        const userRank = sortedPlayers.findIndex((p) => p.id === humanPlayer.id) + 1;

        recordUserMatchHistory({
          userId: auth.currentUser?.uid || "guest",
          timestamp: Date.now(),
          formattedDate: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
          score: humanScore,
          rank: userRank > 0 ? userRank : 1,
          isWinner: isHumanWinner,
          lettersPlayed: lettersList,
          roundsCount: updatedRounds.length,
          categoriesCount: gameState.categories.length,
          opponentCount: gameState.players.length - 1,
          gameMode: isOnlineMultiplayer ? "multiplayer" : "singleplayer",
          eloDelta,
          accuracy: Math.min(100, Math.max(50, Math.round((humanScore / (updatedRounds.length * gameState.categories.length * 15)) * 100))),
          summary: `${isHumanWinner ? "Victory" : `Finished #${userRank}`} in ${isOnlineMultiplayer ? "Multiplayer Room" : "Classroom"}`
        });
      } catch (err) {
        console.warn("Could not save match history:", err);
      }
    }

    // Record daily match streak upon completing a full match!
    try {
      recordCompletedMatch();
    } catch (e) {
      console.error("Streak tracking error:", e);
    }

    gameState.players.forEach((p) => {
      const pScore = updatedScores[p.id] || 0;
      if (pScore > 0) {
        saveHighScore({
          playerName: p.name,
          avatar: p.avatar || (p.isBot ? (p.botPersonality === "susie" ? "🤓" : p.botPersonality === "harry" ? "⚡" : p.botPersonality === "sam" ? "🤪" : "🤠") : "👤"),
          score: pScore,
          roundsPlayed: updatedRounds.length,
          categoriesCount: gameState.categories.length,
          isBot: p.isBot,
          isWinner: p.id === topPlayerId
        });
      }
    });

    setGameState((prev) => ({
      ...prev,
      rounds: updatedRounds,
      currentRoundIndex: prev.currentRoundIndex + 1,
      gamePhase: "SUMMARY"
    }));
  };

  // 5. Calculate cumulative scores
  const getCumulativeScores = (): Record<string, number> => {
    const cumulative: Record<string, number> = {};
    gameState.players.forEach((p) => {
      cumulative[p.id] = 0;
    });

    gameState.rounds.forEach((round) => {
      Object.keys(round.results).forEach((playerId) => {
        const score = round.results[playerId]?.totalRoundScore || 0;
        cumulative[playerId] = (cumulative[playerId] || 0) + score;
      });
    });

    return cumulative;
  };

  // 6. Reset Game
  const resetGame = async () => {
    if (isOnlineMultiplayer && activeOnlineRoomCode && isHost) {
      try {
        await endMatch(activeOnlineRoomCode);
      } catch (err) {
        console.error("endMatch error:", err);
      }
    }
    setActiveOnlineRoomCode(null);
    setOnlineRoomData(null);
    setGameState((prev) => ({
      ...prev,
      players: [],
      rounds: [],
      currentRoundIndex: 0,
      gamePhase: "SETUP"
    }));
  };

  // 7. Spin again (Add another round)
  const handlePlayAnotherRound = async () => {
    if (isOnlineMultiplayer && activeOnlineRoomCode) {
      try {
        const nextIdx = gameState.currentRoundIndex;
        await enterSpinPhase(activeOnlineRoomCode, onlineRoomData?.players || [], nextIdx);
      } catch (err) {
        console.error("enterSpinPhase error:", err);
      }
    }
    setGameState((prev) => ({
      ...prev,
      gamePhase: "SPIN"
    }));
  };

  const getPlayerAllBadges = (playerId: string) => {
    const badges = gameState.rounds.flatMap((r) => (r.results[playerId] as any)?.badges || []);
    const counts: Record<string, { label: string; icon: string; count: number; color: string; desc: string }> = {};
    badges.forEach((b: any) => {
      if (!counts[b.id]) {
        counts[b.id] = { label: b.label, icon: b.icon, count: 1, color: b.color, desc: b.desc };
      } else {
        counts[b.id].count += 1;
      }
    });
    return Object.values(counts);
  };

  const cumulativeScores = getCumulativeScores();

  // Sort players by cumulative score descending
  const rankedPlayers = [...gameState.players].sort((a, b) => {
    const scoreA = cumulativeScores[a.id] || 0;
    const scoreB = cumulativeScores[b.id] || 0;
    return scoreB - scoreA;
  });

  // Download printable summary of completed match
  const handleDownloadSummary = () => {
    if (gameState.rounds.length === 0) return;

    let content = `========================================\n`;
    content += `   CLASSROOM SCATTERGORIES MATCH SUMMARY \n`;
    content += `========================================\n\n`;
    content += `Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
    content += `Rounds Played: ${gameState.rounds.length}\n`;
    content += `Categories: ${gameState.categories.map((c) => c.label).join(", ")}\n\n`;

    content += `--- FINAL LEADERBOARD ---\n`;
    rankedPlayers.forEach((p, idx) => {
      const score = cumulativeScores[p.id] || 0;
      content += `${idx + 1}. ${p.name} ${p.isBot ? "(AI)" : ""} - ${score} pts\n`;
    });
    content += `\n`;

    gameState.rounds.forEach((round) => {
      content += `========================================\n`;
      content += `ROUND ${round.roundNumber} - LETTER [ ${round.letter} ]\n`;
      content += `========================================\n`;

      gameState.players.forEach((p) => {
        const res = round.results[p.id];
        if (!res) return;
        content += `\n${p.name} (Total: ${res.totalRoundScore || 0} pts):\n`;
        gameState.categories.forEach((cat) => {
          const ans = res.answers[cat.id] || "(no answer)";
          const val = res.validations?.[cat.id];
          const score = res.scores?.[cat.id] || 0;
          content += `  - ${cat.label}: "${ans}" [${score} pts] ${val?.isValid ? "✓" : "✗"} ${val?.feedback ? `(${val.feedback})` : ""}\n`;
        });
      });
      content += `\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Scattergories_Match_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="app-root" className="min-h-screen google-mesh-bg text-slate-900 dark:text-slate-100 pb-12 font-sans selection:bg-blue-500/20 selection:text-blue-700">
      {/* Global Master Toolbar (Sticky Top) */}
      <MasterToolbar
        currentLetter={activeLetter}
        hasGameData={gameState.rounds.length > 0}
        onDownloadSummary={handleDownloadSummary}
        onStartOnlineGame={handleStartOnlineGame}
        activeOnlineRoomCode={activeOnlineRoomCode}
      />

      {/* Winner Celebration Confetti Overlay when Final Round Concludes */}
      {gameState.gamePhase === "SUMMARY" && rankedPlayers.length > 0 && (
        <WinnerCelebrationOverlay
          winner={rankedPlayers[0]}
          winnerScore={cumulativeScores[rankedPlayers[0].id] || 0}
          players={gameState.players}
          scores={cumulativeScores}
        />
      )}

      {/* Main Game Phase Routing */}
      <main className="mt-4">
        {gameState.gamePhase === "SETUP" && (
          <SetupScreen onStartGame={handleStartGame} />
        )}

        {gameState.gamePhase === "SPIN" && (
          isOnlineMultiplayer && !isRoundController ? (
            <div className="max-w-xl mx-auto my-12 px-4">
              <NotebookPaper>
                <div className="text-center py-12 px-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 mx-auto animate-bounce">
                    <RefreshCw size={28} className="animate-spin" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold">
                    <Crown size={12} className="text-amber-500" />
                    <span>Round {gameState.currentRoundIndex + 1} Controller: {controllerName}</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    {controllerName} is spinning the wheel…
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-sans max-w-md mx-auto">
                    Hang tight! Once {controllerName} spins, all devices will synchronize and begin writing together.
                  </p>
                  <div className="p-3 glass-card rounded-2xl text-xs text-amber-800 dark:text-amber-300 inline-block font-sans border border-amber-500/30">
                    Auto-spin countdown: <CountdownDisplay to={onlineRoomData?.spinDeadlineAt} />
                  </div>
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 glass-pill rounded-full text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                      Room #{activeOnlineRoomCode} • Round {gameState.currentRoundIndex + 1}
                    </span>
                  </div>
                </div>
              </NotebookPaper>
            </div>
          ) : (
            <div className="space-y-4">
              {isOnlineMultiplayer && (
                <div className="max-w-md mx-auto text-center px-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 glass-card rounded-full text-amber-800 dark:text-amber-300 text-xs font-bold shadow-sm border border-amber-500/30">
                    <Crown size={14} className="text-amber-500" />
                    <span>You are Round {gameState.currentRoundIndex + 1} Controller!</span>
                    <span>•</span>
                    <span>Auto-spin in <CountdownDisplay to={onlineRoomData?.spinDeadlineAt} /></span>
                  </div>
                </div>
              )}
              <WheelSpinner
                onLetterSelected={(letter) => {
                  handleLetterSelected(letter);
                  if (isOnlineMultiplayer && activeOnlineRoomCode) {
                    spinLetter(activeOnlineRoomCode, gameState.currentRoundIndex, letter, localPlayerId).catch(console.error);
                  }
                }}
              />
            </div>
          )
        )}

        {gameState.gamePhase === "PLAYING" && (
          <GameplayScreen
            letter={activeLetter}
            players={gameState.players}
            timeLimit={gameState.roundTimeLimit}
            categories={gameState.categories}
            difficulty={gameState.difficulty || "medium"}
            onRoundFinished={handleRoundFinished}
            roomCode={activeOnlineRoomCode || undefined}
            isOnlineMultiplayer={isOnlineMultiplayer}
            localPlayerId={localPlayerId}
            onlineRoomData={onlineRoomData}
            isHost={isHost}
            isRoundController={isRoundController}
            roundIndex={gameState.currentRoundIndex}
          />
        )}

        {gameState.gamePhase === "GRADING" && (
          <ScoringScreen
            letter={activeLetter}
            players={gameState.players}
            playerAnswers={activeHumanAnswers}
            playerTimes={activeHumanTimes}
            categories={gameState.categories}
            difficulty={gameState.difficulty || "medium"}
            onNextRound={handleNextRound}
            isOnlineMultiplayer={isOnlineMultiplayer}
            isHost={isHost}
          />
        )}

        {gameState.gamePhase === "SUMMARY" && (
          <div className="max-w-4xl mx-auto my-6 px-4">
            <NotebookPaper>
              <div className="flex-1 flex flex-col justify-between py-4">
                {/* Header */}
                <div className="border-b border-slate-200/70 dark:border-slate-800/70 pb-5 mb-6 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 animate-bounce">
                      <Trophy size={32} />
                    </div>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                    Grand Leaderboard
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Cumulative standings after {gameState.currentRoundIndex} round(s)
                  </p>
                </div>

                {/* Leaderboard Table / Rankings */}
                <div className="space-y-3.5 my-6 flex-1 max-w-xl mx-auto w-full">
                  {rankedPlayers.map((p, index) => {
                    const score = cumulativeScores[p.id] || 0;
                    const isWinner = index === 0;

                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                          isWinner
                            ? "glass-card border-amber-500/40 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/30"
                            : "glass-card border-slate-200/70 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Rank badge */}
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-display font-black text-sm ${
                              index === 0
                                ? "bg-amber-400 text-amber-950 shadow-md shadow-amber-400/20"
                                : index === 1
                                ? "bg-slate-300 text-slate-900"
                                : index === 2
                                ? "bg-amber-700/30 text-amber-900 dark:text-amber-200"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                            }`}
                          >
                            {index + 1}
                          </div>

                          {/* Avatar & Name */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl" role="img" aria-label={p.name}>
                              {p.avatar || "👤"}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {p.name}
                                </span>
                                {p.isBot && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-mono">
                                    AI
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-sans block">
                                {isWinner ? "Match Champion! 👑" : "Contender"}
                              </span>

                              {/* Cumulative Badge Pills */}
                              {(() => {
                                const badges = getPlayerAllBadges(p.id);
                                if (badges.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-1 mt-2 max-w-[260px]">
                                    {badges.map((b) => (
                                      <SparkleBadge
                                        key={b.label}
                                        icon={b.icon}
                                        label={b.label}
                                        desc={b.desc}
                                        count={b.count}
                                        color={b.color}
                                        size="sm"
                                      />
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Total Score */}
                        <div className="text-right">
                          <span className="font-display text-2xl font-black text-slate-900 dark:text-white block">
                            {score}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                            Points
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Tactical Review Callout Banner */}
                <div className="my-4 p-4 rounded-2xl glass-card border border-emerald-500/40 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <h4 className="font-display font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>Gemini Tactical Match Review</span>
                        <span className="px-2 py-0.2 text-[9px] font-mono bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-full font-bold">
                          AI Coach
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        View playstyle archetype, blunders, and 15-pt missed opportunities
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSummaryAnalysisOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 font-mono font-bold text-xs rounded-xl border border-emerald-500/40 shadow cursor-pointer transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Sparkles size={14} />
                    <span>Analyze Match</span>
                  </button>
                </div>

                {/* Bottom Actions */}
                <div className="mt-6 pt-5 border-t border-slate-200/70 dark:border-slate-800/70 flex flex-col sm:flex-row gap-3 justify-center items-center">
                  {isOnlineMultiplayer && !isHost ? (
                    <div className="p-3.5 glass-card rounded-2xl text-center text-xs text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-amber-500" />
                      <span>Waiting for host's decision…</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        id="play-another-btn"
                        onClick={handlePlayAnotherRound}
                        className="w-full sm:w-auto px-6 py-3.5 google-fab-primary font-display font-extrabold text-sm rounded-full shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw size={15} /> Spin Next Letter!
                      </button>
                      <button
                        type="button"
                        id="end-match-btn"
                        onClick={resetGame}
                        className="w-full sm:w-auto px-6 py-3.5 glass-pill hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-display font-bold text-sm rounded-full transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={15} /> New Match Setup
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    id="download-summary-btn"
                    onClick={handleDownloadSummary}
                    className="w-full sm:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-display font-bold text-sm rounded-full transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                  >
                    <Download size={15} /> Download Summary (.txt)
                  </button>
                </div>
              </div>
            </NotebookPaper>
          </div>
        )}
      </main>

      {/* Post-Game Summary Gemini Tactical Review Modal */}
      {isSummaryAnalysisOpen && gameState.rounds.length > 0 && (
        <GameAnalysisModal
          isOpen={isSummaryAnalysisOpen}
          onClose={() => setIsSummaryAnalysisOpen(false)}
          results={Object.values(gameState.rounds[gameState.rounds.length - 1]?.results || {})}
          categories={gameState.categories}
          letter={gameState.rounds[gameState.rounds.length - 1]?.letter || activeLetter}
          players={gameState.players}
          fullRounds={gameState.rounds}
        />
      )}
    </div>
  );
}

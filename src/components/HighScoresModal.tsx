import React, { useState, useEffect } from "react";
import { Trophy, Award, Calendar, Trash2, X, Sparkles, Filter, ShieldCheck, Cloud, RefreshCw, UserCheck, Globe } from "lucide-react";
import { getHighScores, fetchHighScoresCloud, clearHighScores, HighScoreRecord } from "../utils/highScores";

interface HighScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HighScoresModal({ isOpen, onClose }: HighScoresModalProps) {
  const [scores, setScores] = useState<HighScoreRecord[]>([]);
  const [filterMode, setFilterMode] = useState<"ALL" | "HUMANS" | "MY_SCORES">("ALL");
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const loadScores = (mode = filterMode) => {
    setIsCloudSyncing(true);
    fetchHighScoresCloud(mode)
      .then((cloudRecords) => {
        setScores(cloudRecords);
      })
      .catch((err) => {
        console.warn("Cloud high scores fetch error:", err);
        setScores(getHighScores());
      })
      .finally(() => {
        setIsCloudSyncing(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      setScores(getHighScores());
      loadScores(filterMode);
    }
  }, [isOpen, filterMode]);

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to reset all locally saved high scores?")) {
      clearHighScores();
      setScores([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-canvas text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-white/40 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy size={20} />
            </div>
            <div>
              <h2 className="font-display font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Global Leaderboards</span>
                <span className="px-2 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-sans font-bold flex items-center gap-1">
                  <Cloud size={10} /> Live Firestore
                </span>
              </h2>
              <p className="text-xs text-slate-500">Hall of Fame & All-Time Tournament High Scores</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-3 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between text-xs gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold">
            <button
              onClick={() => setFilterMode("ALL")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === "ALL"
                  ? "google-fab-primary text-white"
                  : "glass-pill text-slate-600 dark:text-slate-300"
              }`}
            >
              <Globe size={11} /> Global
            </button>
            <button
              onClick={() => setFilterMode("HUMANS")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === "HUMANS"
                  ? "google-fab-primary text-white"
                  : "glass-pill text-slate-600 dark:text-slate-300"
              }`}
            >
              <UserCheck size={11} /> Humans
            </button>
            <button
              onClick={() => setFilterMode("MY_SCORES")}
              className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                filterMode === "MY_SCORES"
                  ? "google-fab-primary text-white"
                  : "glass-pill text-slate-600 dark:text-slate-300"
              }`}
            >
              <Award size={11} /> My Bests
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadScores(filterMode)}
              className="p-1.5 glass-pill text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              title="Refresh from cloud"
            >
              <RefreshCw size={11} className={isCloudSyncing ? "animate-spin text-blue-500" : ""} />
              <span>Refresh</span>
            </button>

            {scores.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-rose-500 hover:text-rose-600 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Score List */}
        <div className="p-6 space-y-2.5 overflow-y-auto flex-1">
          {scores.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Award className="mx-auto text-slate-400" size={36} />
              <p className="text-sm font-display font-extrabold text-slate-800 dark:text-slate-200">
                No high scores logged in this view
              </p>
              <p className="text-xs text-slate-500">
                Complete a round or match to log your scores to the global leaderboard!
              </p>
            </div>
          ) : (
            scores.map((record, index) => {
              const isTop3 = index < 3;
              const medalStyles = [
                "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                "border-slate-400/50 bg-slate-300/10 text-slate-700 dark:text-slate-300",
                "border-amber-700/40 bg-amber-700/10 text-amber-800 dark:text-amber-500"
              ];

              return (
                <div
                  key={record.id || index}
                  className={`glass-card p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isTop3
                      ? medalStyles[index]
                      : "border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display font-black text-xs w-6 text-center text-slate-400">
                      #{index + 1}
                    </span>
                    <span className="text-xl bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700">
                      {record.avatar || "👤"}
                    </span>
                    <div>
                      <div className="text-xs font-display font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{record.playerName}</span>
                        {record.isBot && (
                          <span className="text-[9px] glass-pill px-1.5 py-0.2 rounded-full font-mono text-slate-500">
                            AI
                          </span>
                        )}
                        {record.isWinner && (
                          <span className="text-[10px] text-amber-500 font-bold">👑 Champion</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5 font-medium flex-wrap">
                        <span>🗓️ {record.date}</span>
                        <span>•</span>
                        <span>{record.roundsPlayed} Rnd{record.roundsPlayed > 1 ? "s" : ""}</span>
                        <span>•</span>
                        <span>{record.categoriesCount} Cats</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-display font-black text-base text-blue-600 dark:text-blue-400">
                      {record.score} <span className="text-xs font-normal text-slate-500">pts</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-slate-800/80 text-center text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Cloud size={13} className="text-blue-500" />
            <span>Synced with Firestore Leaderboards</span>
          </div>
          {isCloudSyncing ? (
            <span className="text-blue-600 animate-pulse font-bold">(Syncing...)</span>
          ) : (
            <span className="text-emerald-500 font-bold">● Live</span>
          )}
        </div>
      </div>
    </div>
  );
}

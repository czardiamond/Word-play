import React, { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy, Crown, Sparkles, RefreshCw, X, Award, Shield } from "lucide-react";
import { playCelebrationVictory } from "../utils/soundEffects";
import { getUserRatingLocal, getRankBadgeColor } from "../utils/ratingSystem";
import { Player } from "../types";

interface WinnerCelebrationProps {
  winner: Player | null;
  winnerScore: number;
  players: Player[];
  scores: Record<string, number>;
  onClose?: () => void;
}

export default function WinnerCelebrationOverlay({
  winner,
  winnerScore,
  players,
  scores,
  onClose
}: WinnerCelebrationProps) {
  const [visible, setVisible] = useState(true);

  const fireConfettiSequence = () => {
    playCelebrationVictory();
    // Left cannon
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#8b5cf6"]
    });

    // Right cannon
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 70,
      origin: { x: 0.9, y: 0.6 },
      colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#8b5cf6"]
    });

    // Middle Burst
    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.4 },
        colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#ffffff"]
      });
    }, 400);
  };

  useEffect(() => {
    fireConfettiSequence();
  }, []);

  if (!visible || !winner) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-canvas border border-white/40 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center text-slate-900 dark:text-white relative overflow-hidden animate-sparkle-pop">
        {/* Floating Star Particles */}
        <span className="absolute top-4 left-6 text-amber-500 text-xl star-p1">✨</span>
        <span className="absolute top-8 right-8 text-[#FBBC05] text-lg star-p2">⭐</span>
        <span className="absolute bottom-6 left-10 text-[#4285F4] text-xl star-p3">✦</span>

        {/* Close Button */}
        <button
          onClick={() => {
            setVisible(false);
            if (onClose) onClose();
          }}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full glass-pill cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Crown & Trophy Visual */}
        <div className="relative inline-block my-2">
          <div className="w-20 h-20 bg-amber-500/15 rounded-3xl border-2 border-amber-400/40 flex items-center justify-center mx-auto shadow-inner animate-sparkle-glow">
            <Trophy className="text-amber-500 animate-bounce" size={40} />
          </div>
          <Crown className="text-amber-400 absolute -top-3 right-1/2 translate-x-1/2 drop-shadow-md" size={30} />
        </div>

        {/* Winner Title & Elo Badge */}
        <div className="space-y-1 mt-3">
          <div className="text-amber-600 dark:text-amber-400 font-display font-black text-xs uppercase tracking-widest flex items-center justify-center gap-1.5">
            <Sparkles size={14} /> MATCH CHAMPION CROWNED <Sparkles size={14} />
          </div>
          <h2 className="font-display text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {winner.name} {winner.isBot ? "🤖" : "👑"}
          </h2>
          <div className="flex items-center justify-center gap-2 flex-wrap pt-1.5">
            <span className="inline-block px-3.5 py-1 bg-amber-500/15 border border-amber-500/30 rounded-full text-amber-700 dark:text-amber-300 font-display font-extrabold text-xs">
              {winnerScore} Grand Points!
            </span>

            {(() => {
              const profile = getUserRatingLocal();
              const badge = getRankBadgeColor(profile.rating);
              return (
                <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1 ${badge.bg} ${badge.text} ${badge.border}`}>
                  <Shield size={12} className="text-emerald-500" />
                  <span>{profile.title} {profile.rating} Elo</span>
                </span>
              );
            })()}
          </div>
        </div>

        {/* Podium Standings */}
        <div className="mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Final Standings</div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto px-1">
            {players
              .slice()
              .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
              .map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2.5 rounded-2xl text-xs ${
                    p.id === winner.id
                      ? "bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 font-bold"
                      : "glass-card border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400 font-bold text-[11px]">#{idx + 1}</span>
                    <span className="font-display font-bold">{p.name} {p.isBot ? "(AI)" : ""}</span>
                  </div>
                  <span className="font-display font-black text-blue-600 dark:text-blue-400">{scores[p.id] || 0} pts</span>
                </div>
              ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-4 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={fireConfettiSequence}
            className="px-5 py-2.5 google-fab-primary text-white font-display font-extrabold rounded-full text-xs transition-transform hover:scale-105 cursor-pointer shadow-md flex items-center gap-1.5"
          >
            <Sparkles size={14} />
            <span>Celebrate Again! 🎉</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              if (onClose) onClose();
            }}
            className="px-4 py-2.5 glass-pill text-slate-700 dark:text-slate-300 font-bold rounded-full text-xs transition-colors cursor-pointer"
          >
            Scorecard
          </button>
        </div>
      </div>
    </div>
  );
}

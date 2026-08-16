import React, { useState, useEffect } from "react";
import { X, Trophy, Shield, Zap, TrendingUp, Award, Flame, Target, ChevronRight, Activity, BarChart3, User, Sparkles } from "lucide-react";
import {
  getUserRatingLocal,
  fetchUserRatingCloud,
  getRankBadgeColor,
  UserRatingProfile,
  BOT_RATINGS
} from "../utils/ratingSystem";

interface RatingDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBotOpponent?: (botId: string) => void;
}

export default function RatingDashboardModal({ isOpen, onClose, onSelectBotOpponent }: RatingDashboardModalProps) {
  const [profile, setProfile] = useState<UserRatingProfile>(getUserRatingLocal());
  const [loadingCloud, setLoadingCloud] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingCloud(true);
      fetchUserRatingCloud()
        .then((updated) => setProfile(updated))
        .catch(() => {})
        .finally(() => setLoadingCloud(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const badge = getRankBadgeColor(profile.rating);
  const winRate = profile.totalMatches > 0 ? Math.round((profile.wins / profile.totalMatches) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-canvas text-slate-800 dark:text-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-white/40 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Trophy size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-lg tracking-tight text-slate-900 dark:text-white">
                  Competitive Elo Rating
                </h2>
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                  {profile.title} • {profile.rating}
                </span>
              </div>
              <p className="text-xs text-slate-500">Competitive Word Rating & Performance Statistics</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Main Elo Card */}
          <div className="glass-card p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 relative overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center relative z-10">
              <div className="p-3 glass-card rounded-xl">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  CURRENT ELO
                </span>
                <span className="font-display font-black text-2xl text-emerald-600 dark:text-emerald-400">{profile.rating}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Rating</span>
              </div>

              <div className="p-3 glass-card rounded-xl">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  PEAK RATING
                </span>
                <span className="font-display font-black text-2xl text-amber-500">{profile.peakRating}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">All-Time Best</span>
              </div>

              <div className="p-3 glass-card rounded-xl">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  WIN RATE
                </span>
                <span className="font-display font-black text-2xl text-blue-600 dark:text-blue-400">{winRate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{profile.wins}W / {profile.losses}L</span>
              </div>

              <div className="p-3 glass-card rounded-xl">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                  ACCURACY
                </span>
                <span className="font-display font-black text-2xl text-purple-600 dark:text-purple-400">{profile.avgAccuracy}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Average</span>
              </div>
            </div>

            {/* Rank Tier Progress Bar */}
            <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Shield size={14} className="text-emerald-500" /> Rank Tier: <strong className="text-slate-900 dark:text-white">{badge.label}</strong>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">{profile.rating} / 2200 Elo</span>
              </div>
              <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC05] h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(5, (profile.rating / 2200) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bot Opponents Tier List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
              <span className="flex items-center gap-1.5 font-display text-sm font-extrabold text-slate-900 dark:text-white">
                <Target size={16} className="text-blue-500" /> Rated Bot Opponents
              </span>
              <span className="text-slate-400 font-normal text-[11px]">Select your skill match</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(BOT_RATINGS).map(([botKey, info]) => (
                <div
                  key={botKey}
                  className="glass-card p-3.5 rounded-2xl flex items-center justify-between group border border-slate-200/70 dark:border-slate-800 hover:border-blue-500/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700">{info.avatar}</span>
                    <div>
                      <div className="text-sm font-display font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="capitalize">{botKey}</span>
                        <span className="text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-bold">
                          {info.rating} Elo
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-bold">{info.title} Tier</span>
                    </div>
                  </div>

                  {onSelectBotOpponent && (
                    <button
                      onClick={() => {
                        onSelectBotOpponent(botKey);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 google-fab-primary text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1 opacity-90 group-hover:opacity-100 shadow-sm"
                    >
                      <span>Play</span>
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-slate-800/80 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Activity size={14} className="text-emerald-500" />
          <span>Elo dynamically updates after every match based on precision and wins.</span>
        </div>
      </div>
    </div>
  );
}

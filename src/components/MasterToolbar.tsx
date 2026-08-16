import React, { useState, useEffect } from "react";
import WordOfTheDayToolbar from "./WordOfTheDayToolbar";
import OnlineLobbyModal from "./OnlineLobbyModal";
import HighScoresModal from "./HighScoresModal";
import RatingDashboardModal from "./RatingDashboardModal";
import DuolingoLearnModal from "./DuolingoLearnModal";
import UserProfileModal from "./UserProfileModal";
import WordLookupModal from "./WordLookupModal";
import { isSoundMuted, toggleSoundMute } from "../utils/soundEffects";
import { getUserRatingLocal, getRankBadgeColor, UserRatingProfile } from "../utils/ratingSystem";
import { getDuolingoProfile, DuolingoProfile } from "../utils/duolingoSystem";
import { auth, googleProvider, onAuthStateChanged } from "../firebase";
import { User, signInWithPopup } from "firebase/auth";
import {
  Globe,
  Download,
  Volume2,
  VolumeX,
  HelpCircle,
  Trophy,
  Sparkles,
  X,
  Shield,
  Flame,
  Zap,
  User as UserIcon,
  Play,
  BookOpen
} from "lucide-react";
import { Player } from "../types";

interface MasterToolbarProps {
  currentLetter?: string;
  hasGameData?: boolean;
  onDownloadSummary?: () => void;
  onStartOnlineGame?: (players: Player[], roomCode: string) => void;
  activeOnlineRoomCode?: string | null;
}

export default function MasterToolbar({
  currentLetter,
  hasGameData,
  onDownloadSummary,
  onStartOnlineGame,
  activeOnlineRoomCode
}: MasterToolbarProps) {
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isHighScoresOpen, setIsHighScoresOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isDuolingoModalOpen, setIsDuolingoModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isWordLookupOpen, setIsWordLookupOpen] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);
  const [userRating, setUserRating] = useState<UserRatingProfile>(getUserRatingLocal());
  const [duoProfile, setDuoProfile] = useState<DuolingoProfile>(getDuolingoProfile());
  const [soundMuted, setSoundMuted] = useState(isSoundMuted());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const syncProfile = () => {
      setUserRating(getUserRatingLocal());
      setDuoProfile(getDuolingoProfile());
    };
    syncProfile();
    window.addEventListener("focus", syncProfile);
    return () => window.removeEventListener("focus", syncProfile);
  }, [isRatingModalOpen, isHighScoresOpen, isDuolingoModalOpen, isProfileModalOpen]);

  const badge = getRankBadgeColor(userRating.rating);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        console.error("Google sign in error:", err);
      }
    }
  };

  const handleToggleSound = () => {
    const isNowMuted = !toggleSoundMute();
    setSoundMuted(isNowMuted);
  };

  return (
    <div className="w-full sticky top-0 z-40 bg-white/75 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-white/60 dark:border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
      {/* Google Expressive Color Stripe */}
      <div className="h-1 w-full google-gradient-bar" />

      {/* Primary Navigation & Tools Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Left Section: Logo & Google Cluster Accent */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            {/* Google 4-Dot Cluster Icon */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200/60 dark:border-slate-700/60">
              <span className="w-2 h-2 rounded-full bg-[#4285F4] animate-pulse" />
              <span className="w-2 h-2 rounded-full bg-[#EA4335]" />
              <span className="w-2 h-2 rounded-full bg-[#FBBC04]" />
              <span className="w-2 h-2 rounded-full bg-[#34A853]" />
            </div>

            <span className="font-display font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Scattergories</span>
              <span className="text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Studio
              </span>
            </span>
          </div>

          {/* Active Online Room Badge */}
          {activeOnlineRoomCode ? (
            <div className="px-2.5 py-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-full font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>ROOM #{activeOnlineRoomCode}</span>
            </div>
          ) : (
            <span className="hidden lg:inline-block px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-medium border border-slate-200 dark:border-slate-700">
              Gemini AI Powered
            </span>
          )}
        </div>

        {/* Right Section: Action Tool Buttons (Google Material You Pills) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Duolingo Streak Flame Button */}
          <button
            type="button"
            onClick={() => setIsDuolingoModalOpen(true)}
            title="Duolingo Daily Streak - Tap to open Duo Academy"
            className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/15 hover:bg-amber-100 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 rounded-full transition-all flex items-center gap-1.5 text-xs cursor-pointer font-bold font-mono shadow-sm"
          >
            <Flame size={14} className="text-amber-500 fill-amber-500 animate-bounce" />
            <span>{duoProfile.streakDays}</span>
          </button>

          {/* Duolingo XP Counter */}
          <button
            type="button"
            onClick={() => setIsDuolingoModalOpen(true)}
            title="Duolingo XP Points"
            className="hidden sm:flex px-3 py-1.5 bg-yellow-50 dark:bg-yellow-500/10 hover:bg-yellow-100 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/30 rounded-full transition-all items-center gap-1.5 text-xs cursor-pointer font-bold font-mono shadow-sm"
          >
            <Zap size={13} className="text-yellow-500 fill-yellow-500" />
            <span>{duoProfile.totalXp} XP</span>
          </button>

          {/* Duolingo Learn Button */}
          <button
            type="button"
            onClick={() => setIsDuolingoModalOpen(true)}
            title="Open Duolingo Vocab Academy & Drills"
            className="px-3 py-1.5 bg-[#58CC02] hover:bg-[#46A302] text-white font-sans font-bold rounded-full transition-all flex items-center gap-1.5 text-xs shadow-sm hover:shadow-md cursor-pointer border border-[#46A302]"
          >
            <span>🦉</span>
            <span>Duo Learn</span>
          </button>

          {/* Chess Rating Elo Button */}
          <button
            type="button"
            onClick={() => setIsRatingModalOpen(true)}
            title="View Chess.com Elo Rating & Game Review"
            className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 text-xs cursor-pointer font-bold font-mono shadow-sm ${badge.bg} ${badge.text} ${badge.border} hover:brightness-110`}
          >
            <Shield size={13} className="text-emerald-500" />
            <span>{userRating.title} {userRating.rating}</span>
          </button>

          {/* AI Word Lookup Referee Button */}
          <button
            type="button"
            onClick={() => setIsWordLookupOpen(true)}
            title="Gemini Word & Definition Referee"
            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-full transition-all flex items-center gap-1.5 text-xs cursor-pointer font-bold shadow-sm"
          >
            <BookOpen size={13} className="text-blue-500" />
            <span className="hidden md:inline">Word Lookup</span>
          </button>

          {/* Play Online / Matchmaking Button */}
          <button
            type="button"
            onClick={() => setIsOnlineModalOpen(true)}
            className="px-3.5 py-1.5 google-fab-primary rounded-full transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Globe size={13} />
            <span>Multiplayer</span>
          </button>

          {/* High Scores */}
          <button
            type="button"
            onClick={() => setIsHighScoresOpen(true)}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full transition-colors flex items-center gap-1.5 text-xs cursor-pointer font-medium shadow-sm"
          >
            <Trophy size={13} className="text-amber-500" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>

          {/* Download Summary */}
          {hasGameData && onDownloadSummary && (
            <button
              type="button"
              onClick={onDownloadSummary}
              title="Download match summary (.txt)"
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full transition-colors flex items-center gap-1.5 text-xs cursor-pointer shadow-sm"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            title={soundMuted ? "Enable sound effects" : "Mute sound effects"}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
          >
            {!soundMuted ? <Volume2 size={14} className="text-emerald-500" /> : <VolumeX size={14} className="text-slate-400" />}
          </button>

          {/* Google Sign In / Profile Button */}
          {authUser && !authUser.isAnonymous ? (
            <button
              type="button"
              id="user-profile-btn"
              onClick={() => setIsProfileModalOpen(true)}
              title="Player Profile, Google Account & Match History"
              className="px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 text-xs cursor-pointer font-medium shadow-sm bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30"
            >
              {authUser?.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt="Avatar"
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full border border-blue-400 object-cover"
                />
              ) : (
                <UserIcon size={13} className="text-blue-500" />
              )}
              <span className="hidden sm:inline font-semibold">
                {authUser.displayName?.split(" ")[0] || "Profile"}
              </span>
            </button>
          ) : (
            <button
              type="button"
              id="toolbar-google-signin-btn"
              onClick={handleGoogleSignIn}
              title="Sign in with Google"
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-sans font-bold rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-2 text-xs cursor-pointer hover:shadow-md active:scale-95"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}

          {/* Quick Rules */}
          <button
            type="button"
            onClick={() => setIsRulesModalOpen(true)}
            title="Game Rules"
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shadow-sm"
          >
            <HelpCircle size={14} className="text-blue-500" />
          </button>
        </div>
      </div>

      {/* Embedded Word of the Day Ticker Toolbar */}
      <WordOfTheDayToolbar currentLetter={currentLetter} />

      {/* User Profile, Google Auth & Match History Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={() => {
          setUserRating(getUserRatingLocal());
          setDuoProfile(getDuolingoProfile());
        }}
      />

      {/* Online Matchmaking Modal */}
      <OnlineLobbyModal
        isOpen={isOnlineModalOpen}
        onClose={() => setIsOnlineModalOpen(false)}
        onStartOnlineGame={(players, code) => {
          if (onStartOnlineGame) {
            onStartOnlineGame(players, code);
          }
        }}
      />

      {/* High Scores Modal */}
      <HighScoresModal
        isOpen={isHighScoresOpen}
        onClose={() => setIsHighScoresOpen(false)}
      />

      {/* Chess Rating Dashboard */}
      <RatingDashboardModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
      />

      {/* Duolingo Academy */}
      <DuolingoLearnModal
        isOpen={isDuolingoModalOpen}
        onClose={() => setIsDuolingoModalOpen(false)}
        currentLetter={currentLetter}
      />

      {/* Gemini Word Lookup Modal */}
      <WordLookupModal
        isOpen={isWordLookupOpen}
        onClose={() => setIsWordLookupOpen(false)}
        initialLetter={currentLetter}
      />

      {/* Quick Rules Guide Modal */}
      {isRulesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-canvas max-w-md w-full rounded-3xl p-6 shadow-2xl relative space-y-4 border border-white/80 dark:border-white/20">
            <button
              onClick={() => setIsRulesModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-display font-bold text-lg border-b border-slate-200/60 pb-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Trophy size={18} />
              </div>
              <span>Scattergories Rules</span>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
              <p>
                <strong>Goal:</strong> Fill in an original word starting with the round's chosen letter for each category before the timer expires!
              </p>

              <div className="glass-card p-4 rounded-2xl space-y-2 border border-slate-200/60">
                <div className="font-bold text-slate-900 dark:text-white text-xs">Official Scoring Breakdown:</div>
                <div className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-1.5">
                  <span>🌟 Unique valid answer</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-500/10">+15 Pts</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-1.5">
                  <span>🤝 Shared answer with another player</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-full bg-blue-500/10">+10 Pts</span>
                </div>
                <div className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-1.5">
                  <span>✏️ Minor typo or partial match</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full bg-amber-500/10">+5 Pts</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>❌ Blank or incorrect initial letter</span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-full bg-rose-500/10">0 Pts</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Gemini AI verifies spelling, vocabulary accuracy, and issues instant round badges!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

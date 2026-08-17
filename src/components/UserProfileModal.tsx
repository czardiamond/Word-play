import React, { useState, useEffect } from "react";
import { auth, googleProvider, signOutUser, onAuthStateChanged } from "../firebase";
import { User, signInWithPopup } from "firebase/auth";
import {
  UserProfile,
  MatchHistoryEntry,
  getUserProfile,
  getUserMatchHistory,
  syncUserProfile,
  updateUserProfileCustomization,
  unlockItem,
  CATALOG_UNLOCKABLES,
  UnlockableItem
} from "../utils/userProfileService";
import { getRankBadgeColor } from "../utils/ratingSystem";
import {
  X,
  User as UserIcon,
  LogIn,
  LogOut,
  Trophy,
  Shield,
  Flame,
  Zap,
  Clock,
  Award,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Gem,
  ShoppingBag,
  Check,
  Lock,
  Palette,
  Share2
} from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  onProfileUpdated
}: UserProfileModalProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "inventory" | "history">("profile");
  const [historyFilter, setHistoryFilter] = useState<"all" | "wins" | "multiplayer">("all");
  const [inventoryCategory, setInventoryCategory] = useState<"all" | "avatar" | "ink" | "title">("all");

  // Subscribe to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        loadData(user);
      } else {
        setProfile(null);
        setHistory([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      loadData(auth.currentUser);
    }
  }, [isOpen]);

  const loadData = async (user: User) => {
    setLoading(true);
    setError(null);
    try {
      const p = await syncUserProfile(user);
      setProfile(p);
      const h = await getUserMatchHistory(user.uid);
      setHistory(h);
    } catch (err: any) {
      console.warn("Failed to load user data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      setSuccessMsg(`Welcome, ${user.displayName || "Scholar"}! Google account & Firestore memory synced.`);
      await loadData(user);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completing.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked by browser. Please allow popups for this site.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setAuthLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await signOutUser();
      setSuccessMsg("Signed out. Switched to anonymous guest session.");
      if (auth.currentUser) {
        await loadData(auth.currentUser);
      }
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to sign out.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEquipItem = async (item: UnlockableItem) => {
    if (!profile) return;
    setError(null);
    const updates: Partial<UserProfile> = {};
    if (item.category === "avatar") updates.selectedAvatar = item.value;
    if (item.category === "ink") updates.selectedInk = item.value;
    if (item.category === "title") updates.selectedTitle = item.value;

    const updated = await updateUserProfileCustomization(updates);
    setProfile(updated);
    setSuccessMsg(`Equipped ${item.name}!`);
    if (onProfileUpdated) onProfileUpdated();
  };

  const handleUnlockItem = async (item: UnlockableItem) => {
    setError(null);
    setSuccessMsg(null);
    const res = await unlockItem(item.id);
    if (res.success) {
      setProfile(res.profile);
      setSuccessMsg(res.message);
      if (onProfileUpdated) onProfileUpdated();
    } else {
      setError(res.message);
    }
  };

  const handleShareHistoryEntry = async (item: MatchHistoryEntry) => {
    const shareTitle = item.isWinner
      ? `🏆 Victory in Scattergories (${item.score} pts)!`
      : `📝 Scattergories Match Result: Finished #${item.rank || 1} (${item.score} pts)`;

    const shareText = `🎮 Scattergories Match History:
👤 Player: ${profile?.displayName || "Player"}
${item.isWinner ? "🏆 Result: Victory!" : `🏅 Rank: #${item.rank || 1}`}
⭐ Score: ${item.score} pts
🎯 Accuracy: ${item.accuracy || 80}%
🔤 Letters: ${item.lettersPlayed?.join(", ") || "—"} (${item.roundsCount} rounds)
🏷️ Categories: ${item.categoriesCount}
🌐 Mode: ${item.gameMode === "multiplayer" ? "Multiplayer Room" : "Classroom Singleplayer"}
📅 Date: ${item.formattedDate}

Play Scattergories with me!`;

    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        setSuccessMsg("Shared match performance!");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          try {
            await navigator.clipboard.writeText(`${shareTitle}\n\n${shareText}\n\n${shareUrl}`);
            setSuccessMsg("Summary copied to clipboard!");
          } catch (clipErr) {
            console.warn("Clipboard fallback error:", clipErr);
          }
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareTitle}\n\n${shareText}\n\n${shareUrl}`);
        setSuccessMsg("Summary copied to clipboard!");
      } catch (clipErr) {
        console.warn("Clipboard fallback error:", clipErr);
      }
    }
  };

  if (!isOpen) return null;

  const isGoogleUser = currentUser && !currentUser.isAnonymous && currentUser.email;
  const badge = getRankBadgeColor(profile?.rating || 1200);

  const filteredHistory = history.filter((m) => {
    if (historyFilter === "wins") return m.isWinner;
    if (historyFilter === "multiplayer") return m.gameMode === "multiplayer";
    return true;
  });

  const filteredItems = CATALOG_UNLOCKABLES.filter((i) => {
    if (inventoryCategory === "all") return true;
    return i.category === inventoryCategory;
  });

  const winRate =
    profile && profile.totalMatches > 0
      ? Math.round((profile.totalWins / profile.totalMatches) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
      <div
        className="glass-canvas w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/40 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
              {profile?.selectedAvatar || "👤"}
            </div>
            <div>
              <h2 className="font-display text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Player Profile & Inventory</span>
                {isGoogleUser && (
                  <span className="px-2.5 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-sans font-bold">
                    Cloud Synced
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 font-sans">
                {isGoogleUser ? currentUser?.email : "Playing in guest mode (Sign in to link permanently)"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200/70 dark:border-slate-800/80 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2.5 text-xs font-display font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === "profile"
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-500/10"
                : "text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Profile & Stats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2.5 text-xs font-display font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "inventory"
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-500/10"
                : "text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <ShoppingBag size={13} />
            <span>Unlocked Items ({profile?.unlockedItems?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2.5 text-xs font-display font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === "history"
                ? "text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400 bg-blue-500/10"
                : "text-slate-500 border-transparent hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Clock size={13} />
            <span>Match History ({history.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: PROFILE & STATS */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Account Card / Google Auth Banner */}
              <div className="glass-card p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  {currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="User Avatar"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full border-2 border-blue-500 shadow-md object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-blue-500/15 border-2 border-blue-500/30 flex items-center justify-center text-3xl font-display font-black text-blue-600">
                      {profile?.selectedAvatar || "🎓"}
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-display font-extrabold text-slate-900 dark:text-white">
                      {currentUser?.displayName || (isGoogleUser ? "Google User" : "Guest Scholar")}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap justify-center sm:justify-start">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {profile?.selectedTitle || profile?.title || "Novice Speller"} • {profile?.rating || 1200} Elo
                      </span>
                      <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full text-[11px] font-bold flex items-center gap-1">
                        <Gem size={11} className="fill-amber-500 text-amber-500" /> {profile?.gems ?? 50} Gems
                      </span>
                    </div>
                  </div>
                </div>

                {/* Google Sign In / Sign Out Button */}
                <div>
                  {!isGoogleUser ? (
                    <button
                      type="button"
                      id="google-signin-btn"
                      disabled={authLoading}
                      onClick={handleGoogleSignIn}
                      className="px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-display font-bold rounded-2xl text-xs flex items-center gap-2.5 shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{authLoading ? "Connecting..." : "Sign in with Google"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="google-signout-btn"
                      disabled={authLoading}
                      onClick={handleSignOut}
                      className="px-4 py-2.5 glass-pill rounded-2xl text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Bento Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-card p-4 rounded-2xl">
                  <div className="text-slate-500 text-[11px] font-sans flex items-center gap-1.5 mb-1">
                    <Trophy size={13} className="text-amber-500" />
                    <span>Total Matches</span>
                  </div>
                  <div className="text-2xl font-black font-display text-slate-900 dark:text-white">
                    {profile?.totalMatches || 0}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                    {profile?.totalWins || 0} Wins ({winRate}%)
                  </div>
                </div>

                <div className="glass-card p-4 rounded-2xl">
                  <div className="text-slate-500 text-[11px] font-sans flex items-center gap-1.5 mb-1">
                    <Shield size={13} className="text-emerald-500" />
                    <span>Elo Rating</span>
                  </div>
                  <div className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400">
                    {profile?.rating || 1200}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Peak: {profile?.peakRating || 1200}
                  </div>
                </div>

                <div className="glass-card p-4 rounded-2xl">
                  <div className="text-slate-500 text-[11px] font-sans flex items-center gap-1.5 mb-1">
                    <Flame size={13} className="text-[#EA4335] fill-[#EA4335]" />
                    <span>Daily Streak</span>
                  </div>
                  <div className="text-2xl font-black font-display text-[#EA4335]">
                    {profile?.streakDays || 1} Days
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                    {profile?.league || "Bronze League 🥉"}
                  </div>
                </div>

                <div className="glass-card p-4 rounded-2xl">
                  <div className="text-slate-500 text-[11px] font-sans flex items-center gap-1.5 mb-1">
                    <Zap size={13} className="text-[#FBBC05] fill-[#FBBC05]" />
                    <span>Duo Total XP</span>
                  </div>
                  <div className="text-2xl font-black font-display text-amber-500">
                    {profile?.totalXp || 0}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Lifetime points
                  </div>
                </div>
              </div>

              {/* Sync Details Banner */}
              <div className="glass-card p-4 rounded-2xl text-xs space-y-2 text-slate-500">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Firestore Cloud Memory:</span>
                  <span className="text-emerald-500 font-mono font-bold">● Active & Synced</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Equipped Title & Ink:</span>
                  <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                    {profile?.selectedTitle || "Novice Speller"} • {profile?.selectedInk?.split(" ")[0] || "Classic Blue"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Firebase User ID (UID):</span>
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-[220px]">
                    {currentUser?.uid || "Anonymous Session"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY & UNLOCKED ITEMS */}
          {activeTab === "inventory" && (
            <div className="space-y-4">
              {/* Category Filter & Gems Counter */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/70 dark:border-slate-800">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInventoryCategory("all")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      inventoryCategory === "all" ? "google-fab-primary" : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    All Items
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryCategory("avatar")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      inventoryCategory === "avatar" ? "google-fab-primary" : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Avatars
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryCategory("ink")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      inventoryCategory === "ink" ? "google-fab-primary" : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Inks
                  </button>
                  <button
                    type="button"
                    onClick={() => setInventoryCategory("title")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      inventoryCategory === "title" ? "google-fab-primary" : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Titles
                  </button>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-bold">
                  <Gem size={13} className="fill-amber-500 text-amber-500" />
                  <span>{profile?.gems ?? 50} Gems</span>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto p-1">
                {filteredItems.map((item) => {
                  const isUnlocked = profile?.unlockedItems?.includes(item.id);
                  const isEquipped =
                    (item.category === "avatar" && profile?.selectedAvatar === item.value) ||
                    (item.category === "ink" && profile?.selectedInk === item.value) ||
                    (item.category === "title" && profile?.selectedTitle === item.value);

                  return (
                    <div
                      key={item.id}
                      className={`glass-card p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                        isEquipped
                          ? "border-blue-500/70 bg-blue-500/10 shadow-sm"
                          : isUnlocked
                          ? "border-emerald-500/40 hover:border-emerald-500/80"
                          : "border-slate-200/70 dark:border-slate-800 opacity-90"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-2xl shadow-sm shrink-0">
                          {item.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-display font-black text-xs text-slate-900 dark:text-white truncate">
                              {item.name}
                            </h4>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full font-mono uppercase font-bold glass-pill text-slate-500">
                              {item.rarity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-sans mt-0.5 line-clamp-2">
                            {item.description}
                          </p>

                          {/* Requirements notice if locked */}
                          {!isUnlocked && (
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              {item.requiredXp && <span>Req: {item.requiredXp} XP</span>}
                              {item.requiredElo && <span>Req: {item.requiredElo} Elo</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
                        {isEquipped ? (
                          <span className="px-3 py-1 bg-blue-600 text-white rounded-xl text-[11px] font-bold flex items-center gap-1">
                            <Check size={12} /> Equipped
                          </span>
                        ) : isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => handleEquipItem(item)}
                            className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold cursor-pointer transition-all shadow-sm"
                          >
                            Equip
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUnlockItem(item)}
                            className="px-3.5 py-1 google-fab-primary rounded-xl text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Lock size={11} />
                            <span>Unlock ({item.costGems === 0 ? "Free" : `${item.costGems} 💎`})</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MATCH HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4">
              {/* History Filters */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/70 dark:border-slate-800">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryFilter("all")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      historyFilter === "all"
                        ? "google-fab-primary"
                        : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    All ({history.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter("wins")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      historyFilter === "wins"
                        ? "bg-[#34A853] text-white"
                        : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Victories ({history.filter((m) => m.isWinner).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryFilter("multiplayer")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      historyFilter === "multiplayer"
                        ? "bg-[#4285F4] text-white"
                        : "glass-pill text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    Multiplayer ({history.filter((m) => m.gameMode === "multiplayer").length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => currentUser && loadData(currentUser)}
                  className="p-2 glass-pill text-slate-600 dark:text-slate-300 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                  <span>Refresh Cloud</span>
                </button>
              </div>

              {/* History Entries */}
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-sans space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 mx-auto flex items-center justify-center">
                    <Clock size={22} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No match history logged yet</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Finish a round or multiplayer match and your detailed score card will appear here!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="glass-card p-4 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200/70 dark:border-slate-800"
                    >
                      {/* Left: Placement & Date */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-display font-black text-sm shrink-0 ${
                            item.isWinner
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {item.isWinner ? "🏆" : `#${item.rank || 2}`}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                              {item.isWinner ? "Match Victory" : `Finished #${item.rank || 2}`}
                            </span>
                            <span className="px-2 py-0.5 glass-pill rounded-full text-[10px] font-mono text-slate-500">
                              {item.gameMode === "multiplayer" ? "🌐 Multiplayer Room" : "🏫 Classroom Match"}
                            </span>
                            {item.eloDelta !== 0 && (
                              <span
                                className={`text-[11px] font-mono font-bold ${
                                  item.eloDelta > 0 ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {item.eloDelta > 0 ? `+${item.eloDelta}` : item.eloDelta} Elo
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 font-sans mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{item.formattedDate}</span>
                            <span>•</span>
                            <span>{item.roundsCount} Round{item.roundsCount > 1 ? "s" : ""}</span>
                            <span>•</span>
                            <span>Letters: {item.lettersPlayed?.join(", ") || "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Score, Accuracy, and Share */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {item.accuracy > 0 && (
                          <div className="text-right hidden md:block">
                            <div className="text-[10px] text-slate-400">Accuracy</div>
                            <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                              {item.accuracy}%
                            </div>
                          </div>
                        )}
                        <div className="px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-600 dark:text-blue-400 font-display font-black text-sm">
                          {item.score} pts
                        </div>
                        <button
                          type="button"
                          onClick={() => handleShareHistoryEntry(item)}
                          title="Share match performance"
                          className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer border border-slate-200/60 dark:border-slate-800"
                        >
                          <Share2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/70 dark:border-slate-800/80 flex justify-between items-center text-xs text-slate-500">
          <span>Name Animal Food Place • Permanent Firestore Memory</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 glass-pill rounded-full text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

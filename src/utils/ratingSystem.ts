// Chess.com style ELO Rating & Move Evaluation Engine for Word Trivia
import { db, ensureAuth, doc, setDoc, getDoc } from "../firebase";

export interface UserRatingProfile {
  rating: number;
  peakRating: number;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  avgAccuracy: number;
  title: string;
}

export const BOT_RATINGS: Record<string, { rating: number; title: string; avatar: string }> = {
  sam: { rating: 750, title: "NOVICE", avatar: "🤠" },
  joe: { rating: 1050, title: "INTERMEDIATE", avatar: "🤪" },
  harry: { rating: 1400, title: "EXPERT", avatar: "⚡" },
  susie: { rating: 1850, title: "MASTER", avatar: "🤓" }
};

const RATING_STORAGE_KEY = "classroom_archives_user_rating_v1";

export function getRankTitle(rating: number): string {
  if (rating >= 2200) return "GM"; // Grandmaster
  if (rating >= 1900) return "IM"; // International Master
  if (rating >= 1600) return "FM"; // FIDE Master
  if (rating >= 1300) return "CM"; // Candidate Master
  if (rating >= 1000) return "CLASS A";
  return "NOVICE";
}

export function getRankBadgeColor(rating: number): { bg: string; text: string; border: string; label: string } {
  if (rating >= 2200) return { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-400/50", label: "Grandmaster" };
  if (rating >= 1900) return { bg: "bg-purple-500/20", text: "text-purple-300", border: "border-purple-400/50", label: "Master" };
  if (rating >= 1600) return { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-400/50", label: "Expert" };
  if (rating >= 1300) return { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-400/50", label: "Candidate Master" };
  if (rating >= 1000) return { bg: "bg-slate-700/50", text: "text-slate-300", border: "border-slate-600", label: "Intermediate" };
  return { bg: "bg-stone-800/50", text: "text-stone-400", border: "border-stone-700", label: "Novice" };
}

export function getUserRatingLocal(): UserRatingProfile {
  try {
    const raw = localStorage.getItem(RATING_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        rating: parsed.rating || 1200,
        peakRating: parsed.peakRating || parsed.rating || 1200,
        wins: parsed.wins || 0,
        losses: parsed.losses || 0,
        draws: parsed.draws || 0,
        totalMatches: parsed.totalMatches || 0,
        avgAccuracy: parsed.avgAccuracy || 88.5,
        title: getRankTitle(parsed.rating || 1200)
      };
    }
  } catch (e) {
    console.error("Error reading user rating:", e);
  }

  return {
    rating: 1200,
    peakRating: 1200,
    wins: 0,
    losses: 0,
    draws: 0,
    totalMatches: 0,
    avgAccuracy: 88.5,
    title: "CM"
  };
}

export function saveUserRatingLocal(profile: UserRatingProfile): void {
  try {
    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("Error saving rating:", e);
  }
}

export async function fetchUserRatingCloud(): Promise<UserRatingProfile> {
  const local = getUserRatingLocal();
  try {
    const user = await ensureAuth();
    if (user) {
      const userRef = doc(db, "user_ratings", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        const cloudProfile: UserRatingProfile = {
          rating: Number(data.rating) || 1200,
          peakRating: Number(data.peakRating) || 1200,
          wins: Number(data.wins) || 0,
          losses: Number(data.losses) || 0,
          draws: Number(data.draws) || 0,
          totalMatches: Number(data.totalMatches) || 0,
          avgAccuracy: Number(data.avgAccuracy) || 88.5,
          title: getRankTitle(Number(data.rating) || 1200)
        };
        saveUserRatingLocal(cloudProfile);
        return cloudProfile;
      }
    }
  } catch (err) {
    console.warn("Cloud rating sync warning:", err);
  }
  return local;
}

export async function updateUserRatingCloud(newProfile: UserRatingProfile): Promise<void> {
  saveUserRatingLocal(newProfile);
  try {
    const user = await ensureAuth();
    if (user) {
      const userRef = doc(db, "user_ratings", user.uid);
      await setDoc(userRef, {
        rating: newProfile.rating,
        peakRating: newProfile.peakRating,
        wins: newProfile.wins,
        losses: newProfile.losses,
        draws: newProfile.draws,
        totalMatches: newProfile.totalMatches,
        avgAccuracy: newProfile.avgAccuracy,
        title: newProfile.title,
        updatedAt: Date.now()
      });
    }
  } catch (err) {
    console.warn("Firestore rating save warning:", err);
  }
}

// Chess.com Elo Calculation Formula
export function calculateEloDelta(userRating: number, opponentRating: number, isWin: boolean, isDraw: boolean, K = 32): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - userRating) / 400));
  const actualScore = isWin ? 1 : isDraw ? 0.5 : 0;
  return Math.round(K * (actualScore - expectedScore));
}

// Chess.com style word move classification
export function classifyWordMove(
  word: string,
  isValid: boolean,
  isUnique: boolean,
  wordLength: number
): { badge: string; label: string; color: string; desc: string } {
  if (!isValid || !word || word.trim() === "") {
    return { badge: "‼️", label: "BLUNDER", color: "bg-red-500/20 text-red-400 border-red-500/40", desc: "Left blank or invalid word" };
  }
  if (isUnique && wordLength >= 8) {
    return { badge: "‼", label: "BRILLIANT", color: "bg-cyan-500/20 text-cyan-300 border-cyan-400/50", desc: "Rare & unique long word!" };
  }
  if (isUnique) {
    return { badge: "⭐", label: "GREAT FIND", color: "bg-emerald-500/20 text-emerald-300 border-emerald-400/50", desc: "Unique non-duplicated answer" };
  }
  if (isValid) {
    return { badge: "📖", label: "BOOK WORD", color: "bg-blue-500/20 text-blue-300 border-blue-400/50", desc: "Standard valid answer" };
  }
  return { badge: "⚠️", label: "INACCURACY", color: "bg-amber-500/20 text-amber-300 border-amber-400/50", desc: "Weak or generic submission" };
}

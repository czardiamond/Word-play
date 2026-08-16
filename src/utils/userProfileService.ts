import {
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from "../firebase";
import { User } from "firebase/auth";
import { getUserRatingLocal, saveUserRatingLocal, UserRatingProfile } from "./ratingSystem";
import { getDuolingoProfile, saveDuolingoProfile, DuolingoProfile, getLeagueForXP } from "./duolingoSystem";

export interface UnlockableItem {
  id: string;
  name: string;
  category: "avatar" | "ink" | "title";
  value: string;
  icon: string;
  description: string;
  costGems: number;
  requiredXp?: number;
  requiredElo?: number;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const CATALOG_UNLOCKABLES: UnlockableItem[] = [
  // Avatars
  { id: "av_grad", name: "Graduate Cap", category: "avatar", value: "🎓", icon: "🎓", description: "Default classroom scholar avatar", costGems: 0, rarity: "common" },
  { id: "av_backpack", name: "Explorer Backpack", category: "avatar", value: "🎒", icon: "🎒", description: "Ready for vocabulary adventures", costGems: 0, rarity: "common" },
  { id: "av_pencil", name: "Golden Pencil", category: "avatar", value: "✏️", icon: "✏️", description: "Classic rapid writing avatar", costGems: 0, rarity: "common" },
  { id: "av_fox", name: "Clever Fox", category: "avatar", value: "🦊", icon: "🦊", description: "Quick wit and sharp answers", costGems: 15, requiredXp: 100, rarity: "rare" },
  { id: "av_owl", name: "Wise Owl", category: "avatar", value: "🦉", icon: "🦉", description: "Master of deep dictionary knowledge", costGems: 25, requiredXp: 200, rarity: "rare" },
  { id: "av_brain", name: "Mastermind", category: "avatar", value: "🧠", icon: "🧠", description: "High IQ vocabulary memory", costGems: 35, requiredElo: 1300, rarity: "rare" },
  { id: "av_lightning", name: "Speed Demon", category: "avatar", value: "⚡", icon: "⚡", description: "Lightning reflexes in fast rounds", costGems: 40, requiredXp: 350, rarity: "epic" },
  { id: "av_rocket", name: "Cosmic Rocket", category: "avatar", value: "🚀", icon: "🚀", description: "Skyrocketing leaderboard climber", costGems: 50, requiredXp: 500, rarity: "epic" },
  { id: "av_bot", name: "Cyber AI Bot", category: "avatar", value: "🤖", icon: "🤖", description: "Neural network word processor", costGems: 60, requiredElo: 1400, rarity: "epic" },
  { id: "av_unicorn", name: "Mythic Unicorn", category: "avatar", value: "🦄", icon: "🦄", description: "Rare & magical 15-point entries", costGems: 80, requiredXp: 800, rarity: "legendary" },
  { id: "av_crown", name: "Classroom King", category: "avatar", value: "👑", icon: "👑", description: "Royalty of the Word Arena", costGems: 100, requiredElo: 1500, rarity: "legendary" },
  { id: "av_trophy", name: "Grand Champion", category: "avatar", value: "🏆", icon: "🏆", description: "Hall of Fame tournament legend", costGems: 120, requiredXp: 1200, rarity: "legendary" },

  // Ink Colors
  { id: "ink_blue", name: "Classic Indigo", category: "ink", value: "text-blue-600 dark:text-blue-400", icon: "🟦", description: "Standard crisp classroom blue ink", costGems: 0, rarity: "common" },
  { id: "ink_emerald", name: "Emerald Mint", category: "ink", value: "text-emerald-600 dark:text-emerald-400", icon: "🟩", description: "Lush green botanical ink styling", costGems: 20, requiredXp: 150, rarity: "rare" },
  { id: "ink_purple", name: "Royal Violet", category: "ink", value: "text-purple-600 dark:text-purple-400", icon: "🟪", description: "Regal violet glow for your words", costGems: 35, requiredXp: 300, rarity: "epic" },
  { id: "ink_rose", name: "Crimson Flame", category: "ink", value: "text-rose-600 dark:text-rose-400", icon: "🟥", description: "Fiery passion for competitive rounds", costGems: 50, requiredElo: 1350, rarity: "epic" },
  { id: "ink_amber", name: "Gilded Gold", category: "ink", value: "text-amber-500 dark:text-amber-400", icon: "🟨", description: "Pure 24k gold lettering shine", costGems: 75, requiredXp: 700, rarity: "legendary" },

  // Titles
  { id: "title_novice", name: "Novice Speller", category: "title", value: "Novice Speller", icon: "🌱", description: "Starting journey in word games", costGems: 0, rarity: "common" },
  { id: "title_scholar", name: "Vocabulary Scholar", category: "title", value: "Vocabulary Scholar", icon: "📖", description: "Consistently discovers unique nouns", costGems: 20, requiredXp: 150, rarity: "rare" },
  { id: "title_virtuoso", name: "Grammar Virtuoso", category: "title", value: "Grammar Virtuoso", icon: "✨", description: "Flawless category associations", costGems: 40, requiredXp: 400, rarity: "epic" },
  { id: "title_master", name: "Dictionary Grandmaster", category: "title", value: "Dictionary Grandmaster", icon: "🎖️", description: "1400+ Elo strategic word wizard", costGems: 60, requiredElo: 1400, rarity: "epic" },
  { id: "title_legend", name: "Lexicon Legend", category: "title", value: "Lexicon Legend", icon: "🌟", description: "Ultimate master of Name Animal Food Place", costGems: 100, requiredElo: 1600, rarity: "legendary" }
];

export const DEFAULT_UNLOCKED_ITEMS = [
  "av_grad",
  "av_backpack",
  "av_pencil",
  "ink_blue",
  "title_novice"
];

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  isAnonymous: boolean;
  createdAt: string;
  lastLoginAt: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  totalScore: number;
  highestScore: number;
  avgAccuracy: number;
  rating: number;
  peakRating: number;
  title: string;
  streakDays: number;
  totalXp: number;
  gems: number;
  league: string;
  selectedAvatar: string;
  selectedInk: string;
  selectedTitle: string;
  unlockedItems: string[];
}

export interface MatchHistoryEntry {
  id?: string;
  userId: string;
  timestamp: number;
  formattedDate: string;
  score: number;
  rank: number;
  isWinner: boolean;
  lettersPlayed: string[];
  roundsCount: number;
  categoriesCount: number;
  opponentCount: number;
  gameMode: "singleplayer" | "multiplayer";
  eloDelta: number;
  accuracy: number;
  summary: string;
}

const LOCAL_HISTORY_KEY = "nameanimal_match_history_v1";
const LOCAL_PROFILE_KEY = "nameanimal_user_profile_cache_v1";

export function getLocalUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Local profile read error:", e);
  }
  return null;
}

export function saveLocalUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("Local profile save error:", e);
  }
}

/**
 * Synchronizes user profile with Firestore upon login or match completion.
 */
export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userDocRef = doc(db, "users", user.uid);
  const rating = getUserRatingLocal();
  const duo = getDuolingoProfile();
  const cachedLocal = getLocalUserProfile();

  try {
    const snap = await getDoc(userDocRef);
    const now = Date.now();

    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      const mergedUnlocked = Array.from(new Set([
        ...DEFAULT_UNLOCKED_ITEMS,
        ...(existing.unlockedItems || []),
        ...(cachedLocal?.unlockedItems || [])
      ]));

      const updated: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || existing.displayName || (user.isAnonymous ? "Guest Scholar" : "Classroom Player"),
        email: user.email || existing.email || "",
        photoURL: user.photoURL || existing.photoURL || "",
        isAnonymous: user.isAnonymous,
        createdAt: existing.createdAt || new Date().toISOString(),
        lastLoginAt: now,
        totalMatches: Math.max(existing.totalMatches || 0, rating.totalMatches || 0),
        totalWins: Math.max(existing.totalWins || 0, rating.wins || 0),
        totalLosses: existing.totalLosses || rating.losses || 0,
        totalDraws: existing.totalDraws || rating.draws || 0,
        totalScore: existing.totalScore || 0,
        highestScore: Math.max(existing.highestScore || 0, cachedLocal?.highestScore || 0),
        avgAccuracy: existing.avgAccuracy || 85,
        rating: Math.max(existing.rating || 1200, rating.rating),
        peakRating: Math.max(existing.peakRating || 1200, rating.peakRating),
        title: existing.selectedTitle || existing.title || rating.title || "Novice Speller",
        streakDays: Math.max(existing.streakDays || 1, duo.streakDays),
        totalXp: Math.max(existing.totalXp || 0, duo.totalXp),
        gems: Math.max(existing.gems ?? 50, duo.gems ?? 50),
        league: existing.league || duo.league || getLeagueForXP(duo.totalXp),
        selectedAvatar: existing.selectedAvatar || cachedLocal?.selectedAvatar || localStorage.getItem("last_player_avatar") || "🎓",
        selectedInk: existing.selectedInk || cachedLocal?.selectedInk || "text-blue-600 dark:text-blue-400",
        selectedTitle: existing.selectedTitle || existing.title || "Novice Speller",
        unlockedItems: mergedUnlocked
      };

      await setDoc(userDocRef, updated, { merge: true });
      saveLocalUserProfile(updated);
      return updated;
    } else {
      const initialProfile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || (user.isAnonymous ? "Guest Scholar" : "Classroom Player"),
        email: user.email || "",
        photoURL: user.photoURL || "",
        isAnonymous: user.isAnonymous,
        createdAt: new Date().toISOString(),
        lastLoginAt: now,
        totalMatches: rating.totalMatches || 0,
        totalWins: rating.wins || 0,
        totalLosses: rating.losses || 0,
        totalDraws: rating.draws || 0,
        totalScore: 0,
        highestScore: 0,
        avgAccuracy: 85,
        rating: rating.rating || 1200,
        peakRating: rating.peakRating || 1200,
        title: rating.title || "Novice Speller",
        streakDays: duo.streakDays || 1,
        totalXp: duo.totalXp || 0,
        gems: duo.gems ?? 50,
        league: duo.league || "Bronze League 🥉",
        selectedAvatar: localStorage.getItem("last_player_avatar") || "🎓",
        selectedInk: "text-blue-600 dark:text-blue-400",
        selectedTitle: "Novice Speller",
        unlockedItems: [...DEFAULT_UNLOCKED_ITEMS]
      };

      await setDoc(userDocRef, initialProfile);
      saveLocalUserProfile(initialProfile);
      return initialProfile;
    }
  } catch (error) {
    console.warn("Could not sync user profile to cloud:", error);
    const fallbackProfile: UserProfile = cachedLocal || {
      uid: user.uid,
      displayName: user.displayName || "Guest Scholar",
      email: user.email || "",
      photoURL: user.photoURL || "",
      isAnonymous: user.isAnonymous,
      createdAt: new Date().toISOString(),
      lastLoginAt: Date.now(),
      totalMatches: rating.totalMatches || 0,
      totalWins: rating.wins || 0,
      totalLosses: rating.losses || 0,
      totalDraws: rating.draws || 0,
      totalScore: 0,
      highestScore: 0,
      avgAccuracy: 85,
      rating: rating.rating || 1200,
      peakRating: rating.peakRating || 1200,
      title: rating.title || "Novice Speller",
      streakDays: duo.streakDays || 1,
      totalXp: duo.totalXp || 0,
      gems: duo.gems ?? 50,
      league: duo.league || "Bronze League 🥉",
      selectedAvatar: localStorage.getItem("last_player_avatar") || "🎓",
      selectedInk: "text-blue-600 dark:text-blue-400",
      selectedTitle: "Novice Speller",
      unlockedItems: [...DEFAULT_UNLOCKED_ITEMS]
    };
    saveLocalUserProfile(fallbackProfile);
    return fallbackProfile;
  }
}

/**
 * Updates customization (avatar, ink color, title, etc.) and pushes directly to Firestore.
 */
export async function updateUserProfileCustomization(
  updates: Partial<UserProfile>
): Promise<UserProfile> {
  const current = getLocalUserProfile();
  const merged: UserProfile = {
    ...(current || {
      uid: auth.currentUser?.uid || "guest",
      displayName: auth.currentUser?.displayName || "Player",
      email: auth.currentUser?.email || "",
      photoURL: auth.currentUser?.photoURL || "",
      isAnonymous: auth.currentUser?.isAnonymous ?? true,
      createdAt: new Date().toISOString(),
      lastLoginAt: Date.now(),
      totalMatches: 0,
      totalWins: 0,
      totalLosses: 0,
      totalDraws: 0,
      totalScore: 0,
      highestScore: 0,
      avgAccuracy: 85,
      rating: 1200,
      peakRating: 1200,
      title: "Novice Speller",
      streakDays: 1,
      totalXp: 0,
      gems: 50,
      league: "Bronze League 🥉",
      selectedAvatar: "🎓",
      selectedInk: "text-blue-600 dark:text-blue-400",
      selectedTitle: "Novice Speller",
      unlockedItems: [...DEFAULT_UNLOCKED_ITEMS]
    }),
    ...updates,
    lastLoginAt: Date.now()
  };

  saveLocalUserProfile(merged);

  // Sync avatar to localStorage helper
  if (merged.selectedAvatar) {
    localStorage.setItem("last_player_avatar", merged.selectedAvatar);
  }

  // Push to cloud if user is authenticated
  if (auth.currentUser) {
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await setDoc(userRef, merged, { merge: true });
    } catch (e) {
      console.warn("Could not save profile customization to cloud:", e);
    }
  }

  return merged;
}

/**
 * Unlock an item using gems or achievement milestones
 */
export async function unlockItem(
  itemId: string
): Promise<{ success: boolean; message: string; profile: UserProfile }> {
  const item = CATALOG_UNLOCKABLES.find((i) => i.id === itemId);
  const profile = getLocalUserProfile() || (auth.currentUser ? await syncUserProfile(auth.currentUser) : null);

  if (!item || !profile) {
    return {
      success: false,
      message: "Item or profile not found",
      profile: profile!
    };
  }

  if (profile.unlockedItems.includes(itemId)) {
    return {
      success: true,
      message: "Item already unlocked!",
      profile
    };
  }

  // Check requirements
  if (item.requiredXp && profile.totalXp < item.requiredXp) {
    return {
      success: false,
      message: `Requires ${item.requiredXp} XP (You have ${profile.totalXp} XP)`,
      profile
    };
  }

  if (item.requiredElo && profile.rating < item.requiredElo) {
    return {
      success: false,
      message: `Requires ${item.requiredElo} Elo Rating (You have ${profile.rating} Elo)`,
      profile
    };
  }

  if (item.costGems > 0 && profile.gems < item.costGems) {
    return {
      success: false,
      message: `Not enough gems! Cost: ${item.costGems} 💎 (You have ${profile.gems} 💎)`,
      profile
    };
  }

  // Deduct gems and unlock item
  const newGems = Math.max(0, profile.gems - item.costGems);
  const newUnlocked = [...profile.unlockedItems, itemId];

  // If item is avatar or title or ink, auto equip optionally
  const updates: Partial<UserProfile> = {
    gems: newGems,
    unlockedItems: newUnlocked
  };

  if (item.category === "avatar") updates.selectedAvatar = item.value;
  if (item.category === "ink") updates.selectedInk = item.value;
  if (item.category === "title") updates.selectedTitle = item.value;

  const updatedProfile = await updateUserProfileCustomization(updates);

  // Sync to Duolingo gems storage as well
  const duo = getDuolingoProfile();
  duo.gems = newGems;
  saveDuolingoProfile(duo);

  return {
    success: true,
    message: `Unlocked ${item.name} successfully!`,
    profile: updatedProfile
  };
}

/**
 * Fetch cloud profile for a user
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      saveLocalUserProfile(data);
      return data;
    }
    return getLocalUserProfile();
  } catch (error) {
    console.warn("Error fetching user profile:", error);
    return getLocalUserProfile();
  }
}

/**
 * Record a completed match into the user's personal match history and sync aggregates
 */
export async function recordUserMatchHistory(
  matchData: Omit<MatchHistoryEntry, "id">
): Promise<void> {
  // 1. Save locally for instant access
  try {
    const local = getLocalMatchHistory();
    const withId: MatchHistoryEntry = {
      ...matchData,
      id: `local_${Date.now()}`
    };
    const updated = [withId, ...local].slice(0, 50);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Local match history error:", e);
  }

  // 2. Persist to Firestore if user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  try {
    const userMatchesCol = collection(db, "users", currentUser.uid, "matches");
    await addDoc(userMatchesCol, {
      ...matchData,
      userId: currentUser.uid
    });

    // Update aggregate stats on user profile document
    const userDocRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userDocRef);

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const updatedTotalMatches = (data.totalMatches || 0) + 1;
      const updatedTotalWins = (data.totalWins || 0) + (matchData.isWinner ? 1 : 0);
      const updatedLosses = (data.totalLosses || 0) + (!matchData.isWinner ? 1 : 0);
      const updatedTotalScore = (data.totalScore || 0) + matchData.score;
      const updatedHighScore = Math.max(data.highestScore || 0, matchData.score);
      const updatedAccuracy = Math.round(
        (((data.avgAccuracy || 80) * (updatedTotalMatches - 1)) + (matchData.accuracy || 85)) / updatedTotalMatches
      );

      const rating = getUserRatingLocal();
      const duo = getDuolingoProfile();

      await updateDoc(userDocRef, {
        totalMatches: updatedTotalMatches,
        totalWins: updatedTotalWins,
        totalLosses: updatedLosses,
        totalScore: updatedTotalScore,
        highestScore: updatedHighScore,
        avgAccuracy: updatedAccuracy,
        rating: rating.rating,
        peakRating: Math.max(data.peakRating || 1200, rating.peakRating),
        title: rating.title,
        streakDays: duo.streakDays,
        totalXp: duo.totalXp,
        gems: duo.gems,
        lastLoginAt: Date.now()
      });
    } else {
      await syncUserProfile(currentUser);
    }
  } catch (error) {
    console.warn("Cloud match history error:", error);
  }
}

/**
 * Fetch match history for a user
 */
export async function getUserMatchHistory(
  uid: string,
  limitCount = 30
): Promise<MatchHistoryEntry[]> {
  try {
    const matchesCol = collection(db, "users", uid, "matches");
    const q = query(matchesCol, orderBy("timestamp", "desc"), limit(limitCount));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const cloudMatches: MatchHistoryEntry[] = [];
      snapshot.forEach((docSnap) => {
        cloudMatches.push({
          id: docSnap.id,
          ...(docSnap.data() as Omit<MatchHistoryEntry, "id">)
        });
      });
      return cloudMatches;
    }
  } catch (error) {
    console.warn("Could not load cloud match history, reading local:", error);
  }

  // Fallback to local history
  return getLocalMatchHistory();
}

/**
 * Helper to get local match history
 */
export function getLocalMatchHistory(): MatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Error reading local match history:", e);
  }
  return [];
}

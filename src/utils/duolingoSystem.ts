// Duolingo-style Educational Progress, Streak, and XP System
import { db, auth } from "../firebase";
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  xpReward: number;
  gemReward: number;
  claimed: boolean;
}

export interface DuolingoProfile {
  streakDays: number;
  lastPracticeDate: string; // YYYY-MM-DD
  totalXp: number;
  dailyXpGoal: number; // e.g. 50
  todayXp: number;
  gems: number;
  hearts: number;
  league: string; // "Bronze", "Silver", "Gold", "Sapphire", "Ruby", "Diamond"
  quests: DailyQuest[];
  displayName?: string;
  avatar?: string;
}

export interface LeagueMember {
  uid: string;
  displayName: string;
  avatar: string;
  league: string;
  totalXp: number;
  isUser?: boolean;
  updatedAt?: number;
}

const DUOLINGO_STORAGE_KEY = "duolingo_educational_profile_v1";

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

const DEFAULT_QUESTS: DailyQuest[] = [
  {
    id: "match",
    title: "Complete 1 Full Game Match",
    description: "Finish a complete game round to maintain your streak",
    target: 1,
    current: 0,
    xpReward: 40,
    gemReward: 10,
    claimed: false
  },
  {
    id: "drill",
    title: "Complete Duo Vocab Drill",
    description: "Learn new vocabulary words & pass the quiz",
    target: 1,
    current: 0,
    xpReward: 35,
    gemReward: 10,
    claimed: false
  },
  {
    id: "listen",
    title: "Audio Pronunciation Practice",
    description: "Listen to word pronunciations",
    target: 3,
    current: 0,
    xpReward: 25,
    gemReward: 5,
    claimed: false
  }
];

export function getDuolingoProfile(): DuolingoProfile {
  try {
    const raw = localStorage.getItem(DUOLINGO_STORAGE_KEY);
    const today = getTodayDateString();

    if (raw) {
      const parsed = JSON.parse(raw);
      const lastPractice = parsed.lastPracticeDate || "";
      let streak = parsed.streakDays ?? 1;

      if (lastPractice) {
        const lastDate = new Date(lastPractice);
        const currDate = new Date(today);
        const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays > 1) {
          streak = 0; // Missed a full day, streak reset
        }
      }

      // Check if quests need daily reset
      const quests = (lastPractice === today && parsed.quests) ? parsed.quests : DEFAULT_QUESTS;

      return {
        streakDays: streak,
        lastPracticeDate: lastPractice || today,
        totalXp: parsed.totalXp ?? 180,
        dailyXpGoal: 50,
        todayXp: lastPractice === today ? (parsed.todayXp || 0) : 0,
        gems: parsed.gems ?? 40,
        hearts: 5,
        league: getLeagueForXP(parsed.totalXp ?? 180),
        quests,
        displayName: parsed.displayName,
        avatar: parsed.avatar
      };
    }
  } catch (e) {
    console.error("Error loading Duolingo profile:", e);
  }

  // Default initial profile for a new user
  return {
    streakDays: 1,
    lastPracticeDate: getTodayDateString(),
    totalXp: 180,
    dailyXpGoal: 50,
    todayXp: 20,
    gems: 40,
    hearts: 5,
    league: "Gold League 🟡",
    quests: DEFAULT_QUESTS
  };
}

export function saveDuolingoProfile(profile: DuolingoProfile): void {
  try {
    localStorage.setItem(DUOLINGO_STORAGE_KEY, JSON.stringify(profile));
    // Trigger background cloud sync
    syncDuolingoProfileToCloud(profile).catch((err) => {
      console.warn("Background Duolingo profile cloud sync deferred:", err.message);
    });
  } catch (e) {
    console.error("Error saving Duolingo profile:", e);
  }
}

// Clean league name for Firestore collection path (e.g. "Gold League 🟡" -> "gold")
export function getCleanLeagueId(league: string): string {
  const lower = league.toLowerCase();
  if (lower.includes("diamond")) return "diamond";
  if (lower.includes("ruby")) return "ruby";
  if (lower.includes("sapphire")) return "sapphire";
  if (lower.includes("gold")) return "gold";
  if (lower.includes("silver")) return "silver";
  return "bronze";
}

// Sync user's Duolingo profile & league standing to Firestore
export async function syncDuolingoProfileToCloud(profile: DuolingoProfile): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const uid = user.uid;
    const name = profile.displayName || localStorage.getItem("last_player_name") || "Player";
    const avatar = profile.avatar || localStorage.getItem("last_player_avatar") || "🦉";
    const cleanLeague = getCleanLeagueId(profile.league);

    // 1. Sync user profile doc
    const profileRef = doc(db, "duolingo_profiles", uid);
    await setDoc(
      profileRef,
      {
        uid,
        displayName: name,
        avatar,
        streakDays: profile.streakDays,
        lastPracticeDate: profile.lastPracticeDate,
        totalXp: profile.totalXp,
        todayXp: profile.todayXp,
        gems: profile.gems,
        league: profile.league,
        quests: profile.quests,
        updatedAt: Date.now()
      },
      { merge: true }
    );

    // 2. Sync league member doc
    const leagueRef = doc(db, "duolingo_leagues", cleanLeague, "members", uid);
    await setDoc(
      leagueRef,
      {
        uid,
        displayName: name,
        avatar,
        league: profile.league,
        totalXp: profile.totalXp,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  } catch (err: any) {
    console.warn("Could not sync Duolingo profile to Firestore:", err.message);
  }
}

// Fetch real league members from Firestore
export async function fetchRealLeagueMembers(leagueName: string): Promise<LeagueMember[]> {
  const cleanLeague = getCleanLeagueId(leagueName);
  const currentUid = auth.currentUser?.uid;

  try {
    const membersRef = collection(db, "duolingo_leagues", cleanLeague, "members");
    const q = query(membersRef, orderBy("totalXp", "desc"), limit(25));
    const snapshot = await getDocs(q);

    const members: LeagueMember[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      members.push({
        uid: data.uid || d.id,
        displayName: data.displayName || "Classroom Player",
        avatar: data.avatar || "🦉",
        league: data.league || leagueName,
        totalXp: Number(data.totalXp) || 0,
        isUser: Boolean(currentUid && (data.uid === currentUid || d.id === currentUid)),
        updatedAt: data.updatedAt || 0
      });
    });

    return members;
  } catch (err: any) {
    console.warn("Could not fetch real league members from Firestore:", err.message);
    return [];
  }
}

// Fetch cloud profile and merge with local
export async function loadDuolingoProfileFromCloud(): Promise<DuolingoProfile> {
  const local = getDuolingoProfile();
  try {
    const user = auth.currentUser;
    if (!user) return local;

    const profileRef = doc(db, "duolingo_profiles", user.uid);
    const snap = await getDoc(profileRef);

    if (snap.exists()) {
      const data = snap.data();
      // Take the higher XP and streak between cloud and local
      const totalXp = Math.max(local.totalXp, Number(data.totalXp) || 0);
      const streakDays = Math.max(local.streakDays, Number(data.streakDays) || 0);
      const gems = Math.max(local.gems, Number(data.gems) || 0);

      const merged: DuolingoProfile = {
        ...local,
        totalXp,
        streakDays,
        gems,
        lastPracticeDate: data.lastPracticeDate || local.lastPracticeDate,
        league: getLeagueForXP(totalXp),
        displayName: data.displayName || local.displayName,
        avatar: data.avatar || local.avatar
      };

      localStorage.setItem(DUOLINGO_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err: any) {
    console.warn("Could not load Duolingo profile from cloud:", err.message);
  }
  return local;
}

export function incrementQuestProgress(questId: string, amount: number = 1): DuolingoProfile {
  const profile = getDuolingoProfile();
  const updatedQuests = profile.quests.map((q) => {
    if (q.id === questId) {
      return {
        ...q,
        current: Math.min(q.target, q.current + amount)
      };
    }
    return q;
  });
  profile.quests = updatedQuests;
  saveDuolingoProfile(profile);
  return profile;
}

export function claimQuestReward(questId: string): DuolingoProfile {
  const profile = getDuolingoProfile();
  let xpToAdd = 0;
  let gemsToAdd = 0;

  const updatedQuests = profile.quests.map((q) => {
    if (q.id === questId && q.current >= q.target && !q.claimed) {
      xpToAdd = q.xpReward;
      gemsToAdd = q.gemReward;
      return { ...q, claimed: true };
    }
    return q;
  });

  profile.quests = updatedQuests;
  profile.todayXp += xpToAdd;
  profile.totalXp += xpToAdd;
  profile.gems += gemsToAdd;
  profile.league = getLeagueForXP(profile.totalXp);

  saveDuolingoProfile(profile);
  return profile;
}

export function recordCompletedMatch(): DuolingoProfile {
  const profile = getDuolingoProfile();
  const today = getTodayDateString();

  if (profile.lastPracticeDate === today) {
    incrementQuestProgress("match", 1);
    return getDuolingoProfile();
  }

  const lastDate = new Date(profile.lastPracticeDate);
  const currDate = new Date(today);
  const diffDays = Math.round((currDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

  if (diffDays === 1) {
    // Consecutive day match!
    profile.streakDays += 1;
  } else {
    // New streak started today
    profile.streakDays = 1;
  }

  profile.lastPracticeDate = today;
  profile.todayXp += 50;
  profile.totalXp += 50;
  profile.gems += 10;
  profile.league = getLeagueForXP(profile.totalXp);

  saveDuolingoProfile(profile);
  incrementQuestProgress("match", 1);
  return getDuolingoProfile();
}

export function addDuolingoXp(amount: number): DuolingoProfile {
  const profile = getDuolingoProfile();
  const today = getTodayDateString();

  // Check if streak increases today
  if (profile.lastPracticeDate !== today) {
    profile.streakDays += 1;
    profile.lastPracticeDate = today;
  }

  profile.todayXp += amount;
  profile.totalXp += amount;
  profile.gems += Math.floor(amount / 5); // Earn gems
  profile.league = getLeagueForXP(profile.totalXp);

  saveDuolingoProfile(profile);
  return profile;
}

export function getLeagueForXP(xp: number): string {
  if (xp >= 1000) return "Diamond League 💎";
  if (xp >= 600) return "Ruby League 🔴";
  if (xp >= 350) return "Sapphire League 🔷";
  if (xp >= 200) return "Gold League 🟡";
  if (xp >= 100) return "Silver League 🥈";
  return "Bronze League 🥉";
}

// Text-To-Speech helper for Duolingo audio pronunciation
export function speakWord(text: string): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel(); // cancel previous
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // clear, deliberate pronunciation
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    incrementQuestProgress("listen", 1);
  }
}

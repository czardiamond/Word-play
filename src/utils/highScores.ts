// High Scores Manager using Firestore Cloud Persistence with LocalStorage Fallback
import { db, auth, ensureAuth, collection, addDoc, getDocs, query, orderBy, limit, where } from "../firebase";

export interface HighScoreRecord {
  id: string;
  userId?: string;
  playerName: string;
  avatar: string;
  score: number;
  date: string;
  roundsPlayed: number;
  categoriesCount: number;
  isBot: boolean;
  isWinner: boolean;
  createdAt?: number;
  gameMode?: "singleplayer" | "multiplayer";
}

const STORAGE_KEY = "classroom_archives_high_scores_v1";

// Synchronous local getter
export function getHighScoresLocal(): HighScoreRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => b.score - a.score);
    }
  } catch (e) {
    console.error("Error reading high scores from localStorage:", e);
  }
  return [];
}

// Cloud Async Fetcher with local cache update
export async function fetchHighScoresCloud(filterType: "ALL" | "HUMANS" | "MY_SCORES" = "ALL"): Promise<HighScoreRecord[]> {
  try {
    await ensureAuth();
    const scoresRef = collection(db, "high_scores");
    let q = query(scoresRef, orderBy("score", "desc"), limit(60));

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      let records: HighScoreRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || "",
          playerName: data.playerName || "Anonymous",
          avatar: data.avatar || "👤",
          score: Number(data.score) || 0,
          date: data.date || "Recent",
          roundsPlayed: Number(data.roundsPlayed) || 1,
          categoriesCount: Number(data.categoriesCount) || 5,
          isBot: Boolean(data.isBot),
          isWinner: Boolean(data.isWinner),
          createdAt: Number(data.createdAt) || Date.now(),
          gameMode: data.gameMode || "singleplayer"
        };
      });

      // Update local storage cache with global top scores
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        // ignore
      }

      if (filterType === "HUMANS") {
        records = records.filter((r) => !r.isBot);
      } else if (filterType === "MY_SCORES") {
        const currentUid = auth.currentUser?.uid;
        const currentName = auth.currentUser?.displayName || localStorage.getItem("last_player_name");
        records = records.filter((r) => (currentUid && r.userId === currentUid) || (currentName && r.playerName === currentName));
      }

      return records;
    }
  } catch (err) {
    console.warn("Firestore high scores fetch warning, fallback to local:", err);
  }

  let local = getHighScoresLocal();
  if (filterType === "HUMANS") {
    local = local.filter((r) => !r.isBot);
  } else if (filterType === "MY_SCORES") {
    const currentName = auth.currentUser?.displayName || localStorage.getItem("last_player_name");
    local = local.filter((r) => !r.isBot && (!currentName || r.playerName === currentName));
  }
  return local;
}

export function getHighScores(): HighScoreRecord[] {
  return getHighScoresLocal();
}

export async function saveHighScore(record: Omit<HighScoreRecord, "id" | "date">): Promise<HighScoreRecord> {
  const localScores = getHighScoresLocal();
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const newRecord: HighScoreRecord = {
    ...record,
    userId: record.userId || auth.currentUser?.uid || "",
    id: `hs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    date: dateStr,
    createdAt: Date.now()
  };

  const updated = [...localScores, newRecord].sort((a, b) => b.score - a.score).slice(0, 60);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    // ignore
  }

  // Also push asynchronously to Firestore
  try {
    await ensureAuth();
    await addDoc(collection(db, "high_scores"), {
      userId: newRecord.userId,
      playerName: record.playerName,
      avatar: record.avatar || "👤",
      score: record.score,
      date: dateStr,
      roundsPlayed: record.roundsPlayed,
      categoriesCount: record.categoriesCount,
      isBot: record.isBot,
      isWinner: record.isWinner,
      gameMode: record.gameMode || "singleplayer",
      createdAt: Date.now()
    });
  } catch (err) {
    console.warn("Firestore save high score warning:", err);
  }

  return newRecord;
}

export function clearHighScores(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

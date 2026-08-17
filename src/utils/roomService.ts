import {
  db,
  ensureAuth,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "../firebase";
import { Answers, CategoryInfo } from "../types";

export const SPIN_COUNTDOWN_MS = 15000;

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  avatar: string;
  connected?: boolean;
  joinedAt?: any;
  lastSeen?: any;
}

export interface LivePlayerProgress {
  filledCount: number;
  totalCount: number;
  activeCategory?: string;
  completedCategories?: string[];
  isSubmitted?: boolean;
  lastUpdated?: number;
}

export interface RoomData {
  code: string;
  hostName: string;
  players: RoomPlayer[];
  isPublic: boolean;
  maxPlayers: number;
  status: "waiting" | "in_progress" | "finished";
  timeLimit: number;
  createdAt?: any;
  categories?: CategoryInfo[];
  currentRoundIndex?: number;
  matchPhase?: "SPIN" | "PLAYING" | "GRADING" | "SUMMARY";
  currentLetter?: string | null;
  roundControllerId?: string;
  spinDeadlineAt?: number | null; // epoch ms — when auto-spin fires if controller hasn't acted
  roundStartedAt?: number | null; // epoch ms when PLAYING phase started
  stopCalledBy?: {
    id: string;
    name: string;
    calledAt: number;
  } | null;
  liveBoardProgress?: {
    [playerId: string]: LivePlayerProgress;
  };
  roundSubmissions?: {
    [roundIndex: string]: {
      [playerId: string]: Answers;
    };
  };
  roundScores?: {
    [roundIndex: string]: {
      [playerId: string]: {
        scores: Record<string, number>;
        totalRoundScore: number;
      };
    };
  };
}

export interface OnlineSubmission {
  playerId: string;
  answers: Answers;
  submittedAt?: any;
  timeTaken?: number;
}

const AVATARS = ["😀", "🦁", "🐼", "🦊", "🐸", "🦉", "🐯", "🐨"];

function pickAvatar(idx: number): string {
  return AVATARS[idx % AVATARS.length];
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excludes 0, O, 1, I ambiguity
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getRoundController(players: RoomPlayer[], roundIndex: number): RoomPlayer {
  if (!players || players.length === 0) {
    return { id: "", name: "Host", isHost: true, avatar: "😀" };
  }
  return players[roundIndex % players.length];
}

export async function createRoom(
  hostName: string,
  isPublic: boolean = true,
  maxPlayers: number = 4,
  timeLimit: number = 60
): Promise<RoomData> {
  const user = await ensureAuth();
  const hostId = user?.uid || `guest_${Date.now()}`;
  const validHostName = (hostName || "Classroom Player").trim();

  // Retry on the rare chance of code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const roomRef = doc(db, "online_rooms", code);

    try {
      let created = false;
      await runTransaction(db, async (tx) => {
        const existing = await tx.get(roomRef);
        if (existing.exists()) return; // collision, retry outer loop

        const hostPlayer: RoomPlayer = {
          id: hostId,
          name: validHostName,
          isHost: true,
          avatar: pickAvatar(0),
          connected: true
        };

        const room: RoomData = {
          code,
          hostName: validHostName,
          players: [hostPlayer],
          isPublic: Boolean(isPublic),
          maxPlayers: Math.max(2, Math.min(8, maxPlayers)),
          status: "waiting",
          timeLimit: Number(timeLimit) || 60,
          currentRoundIndex: 0,
          matchPhase: "SPIN",
          currentLetter: null,
          roundControllerId: hostId,
          spinDeadlineAt: null,
          roundSubmissions: {}
        };

        tx.set(roomRef, {
          ...room,
          createdAt: serverTimestamp()
        });
        created = true;
      });

      if (created) {
        const snap = await getDoc(roomRef);
        return snap.data() as RoomData;
      }
    } catch (e) {
      console.warn("createRoom attempt failed, retrying:", e);
    }
  }

  throw new Error("Could not create a room right now. Please try again.");
}

export async function joinRoom(code: string, playerName: string): Promise<RoomData> {
  const user = await ensureAuth();
  const playerId = user?.uid || `guest_${Date.now()}`;
  const formattedCode = (code || "").trim().toUpperCase();

  if (!formattedCode) {
    throw new Error("Please enter a valid 6-character room code.");
  }

  const roomRef = doc(db, "online_rooms", formattedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) {
      throw new Error("Room code not found. Check the code and try again.");
    }

    const room = snap.data() as RoomData;

    if (room.status !== "waiting") {
      throw new Error("This game has already started or finished.");
    }

    // If player is already in room, treat as idempotent
    const existingIndex = room.players.findIndex((p) => p.id === playerId);
    if (existingIndex >= 0) {
      const updated = [...room.players];
      updated[existingIndex] = {
        ...updated[existingIndex],
        name: playerName || updated[existingIndex].name,
        connected: true
      };
      tx.update(roomRef, { players: updated });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error("Room is full!");
    }

    const updatedPlayers = [
      ...room.players,
      {
        id: playerId,
        name: playerName || `Player ${room.players.length + 1}`,
        isHost: false,
        avatar: pickAvatar(room.players.length),
        connected: true
      }
    ];

    tx.update(roomRef, { players: updatedPlayers });
  });

  const finalSnap = await getDoc(roomRef);
  return finalSnap.data() as RoomData;
}

export async function quickMatch(playerName: string): Promise<RoomData> {
  const roomsRef = collection(db, "online_rooms");
  const q = query(roomsRef, where("isPublic", "==", true), where("status", "==", "waiting"));
  const snap = await getDocs(q);

  const openRoom = snap.docs.find((d) => {
    const data = d.data() as RoomData;
    return Array.isArray(data.players) && data.players.length < data.maxPlayers;
  });

  if (openRoom) {
    return joinRoom(openRoom.id, playerName);
  }

  return createRoom(playerName, true, 4);
}

export async function startGame(code: string, chosenLetter?: string): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  const snap = await getDoc(roomRef);
  const room = snap.data() as RoomData;
  const controller = room?.players?.[0]?.id || "";

  await updateDoc(roomRef, {
    status: "in_progress",
    currentRoundIndex: 0,
    matchPhase: "SPIN",
    roundControllerId: controller,
    spinDeadlineAt: Date.now() + SPIN_COUNTDOWN_MS,
    currentLetter: chosenLetter || null
  });
}

export async function initMatchConfig(
  code: string,
  categories: CategoryInfo[],
  timeLimit: number,
  players?: RoomPlayer[]
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  const snap = await getDoc(roomRef);
  const room = snap.data() as RoomData;
  const currentPlayers = players || room?.players || [];
  const controller = currentPlayers.length > 0 ? getRoundController(currentPlayers, 0) : null;

  await updateDoc(roomRef, {
    categories,
    timeLimit,
    currentRoundIndex: 0,
    matchPhase: "SPIN",
    currentLetter: null,
    roundControllerId: controller?.id || null,
    spinDeadlineAt: Date.now() + SPIN_COUNTDOWN_MS,
    roundStartedAt: null,
    stopCalledBy: null,
    liveBoardProgress: {},
    roundSubmissions: {}
  });
}

// Entering the SPIN phase (assigns next controller and sets countdown)
export async function enterSpinPhase(
  code: string,
  players: RoomPlayer[],
  nextRoundIndex: number
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  const controller = getRoundController(players, nextRoundIndex);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;
    if (room.matchPhase === "SPIN" && room.currentRoundIndex === nextRoundIndex && room.currentLetter === null) {
      return; // already entered, avoid duplicate writes if multiple clients race
    }
    tx.update(roomRef, {
      matchPhase: "SPIN",
      currentRoundIndex: nextRoundIndex,
      currentLetter: null,
      roundControllerId: controller.id,
      spinDeadlineAt: Date.now() + SPIN_COUNTDOWN_MS,
      roundStartedAt: null,
      stopCalledBy: null,
      liveBoardProgress: {}
    });
  });
}

// Spinning (manual by controller, or auto after deadline)
export async function spinLetter(
  code: string,
  roundIndex: number,
  letter: string,
  spinnerId: string
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;

    if (room.matchPhase !== "SPIN" || room.currentRoundIndex !== roundIndex || room.currentLetter) {
      return; // already spun or wrong phase — no-op
    }

    const isController = room.roundControllerId === spinnerId;
    const deadlinePassed = !!room.spinDeadlineAt && Date.now() >= room.spinDeadlineAt;

    if (!isController && !deadlinePassed) {
      return; // not your turn, and it's not auto-spin time yet — silently reject
    }

    tx.update(roomRef, {
      currentLetter: letter,
      matchPhase: "PLAYING",
      roundStartedAt: Date.now(),
      stopCalledBy: null,
      liveBoardProgress: {}
    });
  });
}

// Live tile placement and board progress update during PLAYING phase
export async function updateLiveBoardProgress(
  code: string,
  playerId: string,
  progress: LivePlayerProgress
): Promise<void> {
  try {
    const formattedCode = (code || "").trim().toUpperCase();
    const roomRef = doc(db, "online_rooms", formattedCode);
    await updateDoc(roomRef, {
      [`liveBoardProgress.${playerId}`]: {
        ...progress,
        lastUpdated: Date.now()
      }
    });
  } catch (err) {
    // Non-blocking real-time board update
  }
}

// Emergency stop called when a player finishes all categories
export async function callStopRound(
  code: string,
  playerId: string,
  playerName: string
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  try {
    await updateDoc(roomRef, {
      stopCalledBy: {
        id: playerId,
        name: playerName,
        calledAt: Date.now()
      },
      matchPhase: "GRADING"
    });
  } catch (err) {
    console.error("callStopRound error:", err);
  }
}

// Early stop requested by current round controller
export async function requestStopRound(
  code: string,
  roundIndex: number,
  requesterId: string
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as RoomData;
    if (room.matchPhase !== "PLAYING" || room.currentRoundIndex !== roundIndex) return;
    if (room.roundControllerId !== requesterId) return; // silently reject — not the controller

    tx.update(roomRef, { matchPhase: "GRADING" });
  });
}

// Called by EVERY device when its local player submits their round
export async function submitRoundAnswers(
  code: string,
  roundIndex: number,
  playerId: string,
  answers: Answers
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw new Error("Room not found.");
    const room = snap.data() as RoomData;
    const roundKey = String(roundIndex);
    const existing = room.roundSubmissions?.[roundKey]?.[playerId];
    if (existing) return; // idempotent — already submitted

    const updatedRound = { ...(room.roundSubmissions?.[roundKey] || {}), [playerId]: answers };
    tx.update(roomRef, {
      [`roundSubmissions.${roundKey}`]: updatedRound
    });
  });
}

export async function submitRoundScores(
  code: string,
  roundIndex: number,
  scoresByPlayer: Record<string, { scores: Record<string, number>; totalRoundScore: number }>
): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  const roundKey = String(roundIndex);
  await updateDoc(roomRef, {
    [`roundScores.${roundKey}`]: scoresByPlayer
  });
}

// Called by host or watchdog to advance to grading
export async function advanceToGrading(code: string): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  await updateDoc(roomRef, { matchPhase: "GRADING" });
}

// Called by the controller / host / client after round to loop to next round
export async function startNextRound(code: string, players?: RoomPlayer[], nextRoundIndex?: number): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  if (players && typeof nextRoundIndex === "number") {
    await enterSpinPhase(formattedCode, players, nextRoundIndex);
  } else {
    const roomRef = doc(db, "online_rooms", formattedCode);
    const snap = await getDoc(roomRef);
    const room = snap.data() as RoomData;
    const roomPlayers = players || room?.players || [];
    const nIdx = typeof nextRoundIndex === "number" ? nextRoundIndex : (room?.currentRoundIndex ?? 0) + 1;
    await enterSpinPhase(formattedCode, roomPlayers, nIdx);
  }
}

export async function endMatch(code: string): Promise<void> {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);
  await updateDoc(roomRef, { matchPhase: "SUMMARY", status: "finished" });
}

export function subscribeToRoom(
  code: string,
  onUpdate: (room: RoomData | null) => void
): () => void {
  const formattedCode = (code || "").trim().toUpperCase();
  const roomRef = doc(db, "online_rooms", formattedCode);

  return onSnapshot(roomRef, (snap) => {
    onUpdate(snap.exists() ? (snap.data() as RoomData) : null);
  });
}

export function subscribePublicRooms(onUpdate: (rooms: RoomData[]) => void): () => void {
  const roomsRef = collection(db, "online_rooms");
  const q = query(roomsRef, where("isPublic", "==", true), where("status", "==", "waiting"));

  return onSnapshot(q, (snap) => {
    onUpdate(snap.docs.map((d) => d.data() as RoomData));
  });
}

export const subscribeToPublicRooms = subscribePublicRooms;

export async function updateHeartbeat(code: string, uid: string): Promise<void> {
  try {
    const formattedCode = (code || "").trim().toUpperCase();
    const roomRef = doc(db, "online_rooms", formattedCode);
    const snap = await getDoc(roomRef);

    if (snap.exists()) {
      const room = snap.data() as RoomData;
      const updatedPlayers = room.players.map((p) =>
        p.id === uid ? { ...p, connected: true, lastSeen: Date.now() } : p
      );
      await updateDoc(roomRef, { players: updatedPlayers });
    }
  } catch (err) {
    // Non-blocking heartbeat
  }
}

export async function leaveRoom(code: string, uid: string): Promise<void> {
  try {
    const formattedCode = (code || "").trim().toUpperCase();
    const roomRef = doc(db, "online_rooms", formattedCode);
    const snap = await getDoc(roomRef);

    if (snap.exists()) {
      const room = snap.data() as RoomData;
      const updatedPlayers = room.players.map((p) =>
        p.id === uid ? { ...p, connected: false } : p
      );
      await updateDoc(roomRef, { players: updatedPlayers });
    }
  } catch (err) {
    console.warn("Leave room error:", err);
  }
}

export async function getRoomState(code: string): Promise<RoomData | null> {
  const formattedCode = (code || "").trim().toUpperCase();
  if (!formattedCode) return null;
  const roomRef = doc(db, "online_rooms", formattedCode);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return null;
  return snap.data() as RoomData;
}


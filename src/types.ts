export interface Player {
  id: string;
  name: string;
  avatar?: string; // Emoji avatar or custom icon representation (e.g. 👤, 🤓, 🤠, ⚡, 🎨, 🚀, 👑)
  isBot: boolean;
  botPersonality?: "susie" | "harry" | "sam" | "joe";
  inkColor: string; // Tailwind color class for handwriting text (e.g. text-blue-700, text-purple-700, text-green-700, text-rose-700)
  rating?: number; // Chess.com style Elo rating
  title?: string; // GM, IM, WFM, CM, etc.
  currentTaunt?: string;
}

export interface Answers {
  [categoryId: string]: string;
}

export type Category = string;

export interface CategoryInfo {
  id: Category;
  label: string;
  isCustom?: boolean;
}

export interface PlayerRoundResult {
  playerId: string;
  answers: Answers;
  validations?: Record<Category, { isValid: boolean; feedback: string }>;
  scores?: Record<Category, number>;
  totalRoundScore?: number;
  taunt?: string;
  estimatedScore?: number;
  speedSeconds?: number;
}

export interface Round {
  roundNumber: number;
  letter: string;
  results: Record<string, PlayerRoundResult>; // playerId -> result
  isCompleted: boolean;
}

export interface GameState {
  players: Player[];
  rounds: Round[];
  currentRoundIndex: number;
  gamePhase: "SETUP" | "SPIN" | "PLAYING" | "GRADING" | "SUMMARY";
  categories: CategoryInfo[];
  roundTimeLimit: number; // in seconds, default 60
  difficulty?: "easy" | "medium" | "hard";
  isOnline?: boolean;
  onlineRoomCode?: string;
}

export interface OnlineRoom {
  code: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "in_progress" | "finished";
  isPublic: boolean;
  maxPlayers: number;
  categories: CategoryInfo[];
  roundTimeLimit: number;
  currentRoundIndex: number;
  currentLetter: string | null;
  totalRounds?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface OnlineRoomPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  joinedAt?: any;
  connected: boolean;
  lastSeen?: any;
}

export interface OnlineSubmission {
  playerId: string;
  answers: Answers;
  submittedAt?: any;
  timeTaken?: number;
}


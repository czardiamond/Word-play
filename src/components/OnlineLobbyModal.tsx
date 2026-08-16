import React, { useState, useEffect, useRef } from "react";
import { Users, Globe, Key, Plus, RefreshCw, Copy, Check, Play, Sparkles, X, UserCheck, LogIn } from "lucide-react";
import { Player } from "../types";
import {
  createRoom,
  joinRoom,
  quickMatch,
  startGame,
  subscribeToRoom,
  subscribePublicRooms,
  RoomData
} from "../utils/roomService";
import { auth, googleProvider } from "../firebase";
import { signInWithPopup } from "firebase/auth";

interface OnlineLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartOnlineGame: (players: Player[], roomCode: string, roomData?: RoomData) => void;
  currentPlayerName?: string;
}

export default function OnlineLobbyModal({
  isOpen,
  onClose,
  onStartOnlineGame,
  currentPlayerName = "Classroom Player"
}: OnlineLobbyModalProps) {
  const [activeTab, setActiveTab] = useState<"FRIENDS" | "RANDOM" | "ROOM">("FRIENDS");
  const [playerName, setPlayerName] = useState(currentPlayerName);
  const [joinCode, setJoinCode] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPublic, setIsPublic] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<RoomData | null>(null);
  const [publicRooms, setPublicRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasLaunchedRef = useRef(false);
  const myUid = auth.currentUser?.uid || "";
  const isHost = Boolean(
    currentRoom && currentRoom.players.some((p) => p.isHost && (p.id === myUid || p.name === playerName))
  );

  // Live subscription to active room state
  useEffect(() => {
    if (!currentRoom?.code) return;
    hasLaunchedRef.current = false;
    const unsub = subscribeToRoom(currentRoom.code, (room) => {
      if (room) {
        setCurrentRoom(room);
        if (room.status === "in_progress" && !hasLaunchedRef.current) {
          hasLaunchedRef.current = true;
          launchGameToScreen(room);
        }
      } else {
        setErrorMsg("Room was closed or not found.");
        setCurrentRoom(null);
        setActiveTab("FRIENDS");
      }
    });
    return () => unsub();
  }, [currentRoom?.code]);

  // Live subscription to public waiting rooms list
  useEffect(() => {
    if (!isOpen || activeTab !== "RANDOM") return;
    const unsub = subscribePublicRooms(setPublicRooms);
    return () => unsub();
  }, [isOpen, activeTab]);

  const launchGameToScreen = (room: RoomData) => {
    const gamePlayers: Player[] =
      room.players && room.players.length > 0
        ? room.players.map((p, idx) => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar || (p.isHost ? "👑" : "👤"),
            inkColor:
              idx % 4 === 0
                ? "text-blue-900"
                : idx % 4 === 1
                ? "text-red-900"
                : idx % 4 === 2
                ? "text-emerald-900"
                : "text-purple-900",
            isBot: false
          }))
        : [
            {
              id: myUid || "player_1",
              name: room.hostName || playerName,
              avatar: "👑",
              inkColor: "text-blue-900",
              isBot: false
            }
          ];

    if (gamePlayers.length < 2) {
      gamePlayers.push({
        id: "bot_susie",
        name: "Smart Susie 🤓",
        avatar: "🤓",
        inkColor: "text-purple-800",
        isBot: true,
        botPersonality: "susie"
      });
    }

    onStartOnlineGame(gamePlayers, room.code, room);
    onClose();
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const room = await createRoom(playerName, isPublic, maxPlayers);
      setCurrentRoom(room);
      setActiveTab("ROOM");
    } catch (err: any) {
      setErrorMsg(err.message || "Could not create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (codeToJoin?: string) => {
    const code = (codeToJoin || joinCode).trim().toUpperCase();
    if (!code) {
      setErrorMsg("Please enter a valid 6-character room code!");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const room = await joinRoom(code, playerName);
      setCurrentRoom(room);
      setActiveTab("ROOM");
    } catch (err: any) {
      setErrorMsg(err.message || "Could not join room");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickMatchmaking = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const room = await quickMatch(playerName);
      setCurrentRoom(room);
      setActiveTab("ROOM");
    } catch (err: any) {
      setErrorMsg(err.message || "Matchmaking error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!currentRoom?.code) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHostLaunch = async () => {
    if (!currentRoom?.code) return;
    setLoading(true);
    try {
      await startGame(currentRoom.code);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start match");
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      if (userCredential.user.displayName) {
        setPlayerName(userCredential.user.displayName.split(" ")[0]);
      }
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user") {
        setErrorMsg(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="glass-canvas text-slate-800 dark:text-slate-100 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-white/40 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200/70 dark:border-slate-800/80 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="font-display font-black text-base text-slate-900 dark:text-white">
                Multiplayer Lobby
              </h2>
              <span className="text-xs text-slate-500">Live synchronized multiplayer</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Player Display Name Input & Auth Button */}
        <div className="px-6 py-3 border-b border-slate-200/70 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:flex-1">
            <span className="text-xs text-slate-500 font-bold shrink-0">Your Name:</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="glass-input rounded-xl px-3.5 py-1.5 text-xs text-slate-900 dark:text-white w-full focus:outline-none font-bold"
              placeholder="Enter display name"
            />
          </div>
          {(!auth.currentUser || auth.currentUser.isAnonymous) && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Sign in with Google</span>
            </button>
          )}
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-3 border-b border-slate-200/70 dark:border-slate-800/80 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab("FRIENDS");
              setCurrentRoom(null);
            }}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 cursor-pointer transition-all ${
              activeTab === "FRIENDS"
                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Users size={14} /> Friends
          </button>
          <button
            onClick={() => {
              setActiveTab("RANDOM");
              setCurrentRoom(null);
            }}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 cursor-pointer transition-all ${
              activeTab === "RANDOM"
                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Globe size={14} /> Public Match
          </button>
          <button
            disabled={!currentRoom}
            onClick={() => setActiveTab("ROOM")}
            className={`py-3 flex items-center justify-center gap-1.5 border-b-2 cursor-pointer disabled:opacity-30 transition-all ${
              activeTab === "ROOM"
                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <UserCheck size={14} /> Room {currentRoom ? `(${currentRoom.code})` : ""}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 rounded-2xl text-xs flex items-center gap-2">
              <span className="text-sm">⚠️</span> {errorMsg}
            </div>
          )}

          {/* TAB 1: PLAY WITH FRIENDS */}
          {activeTab === "FRIENDS" && (
            <div className="space-y-4">
              {/* Host Room Box */}
              <div className="glass-card p-4 rounded-2xl space-y-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Plus size={16} className="text-blue-500" />
                  <span>Host New Game Room</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1 text-[11px] font-bold">Max Players</label>
                    <select
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-bold"
                    >
                      <option value={2}>2 Players</option>
                      <option value={3}>3 Players</option>
                      <option value={4}>4 Players</option>
                      <option value={6}>6 Players</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 text-[11px] font-bold">Visibility</label>
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white flex items-center justify-between cursor-pointer font-bold"
                    >
                      <span>{isPublic ? "🌐 Public" : "🔒 Private"}</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full py-3 google-fab-primary font-display font-extrabold text-xs rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                >
                  {loading ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                  <span>Create Room</span>
                </button>
              </div>

              {/* Join Room Box */}
              <div className="glass-card p-4 rounded-2xl space-y-3.5 border border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Key size={16} className="text-amber-500" />
                  <span>Join with Room Code</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter 6-char code"
                    className="flex-1 glass-input rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono uppercase tracking-wider font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => handleJoinRoom()}
                    disabled={loading || !joinCode}
                    className="px-5 py-2 google-fab-primary font-display font-extrabold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-40"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RANDOM MATCHMAKING */}
          {activeTab === "RANDOM" && (
            <div className="space-y-4">
              <div className="glass-card p-5 rounded-2xl text-center space-y-2.5 border border-slate-200/70 dark:border-slate-800">
                <Sparkles className="text-amber-500 mx-auto animate-bounce" size={24} />
                <h3 className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                  Instant Matchmaking
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  Automatically pairs you with open rooms worldwide via Firestore synchronization.
                </p>
                <button
                  type="button"
                  onClick={handleQuickMatchmaking}
                  disabled={loading}
                  className="mt-2 px-6 py-3 google-fab-primary font-display font-extrabold text-xs rounded-full transition-all cursor-pointer inline-flex items-center gap-2 shadow-lg"
                >
                  {loading ? <RefreshCw className="animate-spin" size={14} /> : <Globe size={14} />}
                  <span>Find Online Match</span>
                </button>
              </div>

              {/* List of Public Lobbies */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs text-slate-500 font-bold px-1">
                  <span>Open Public Rooms</span>
                  <span className="text-emerald-500 text-[11px] font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Live
                  </span>
                </div>

                {publicRooms.length === 0 ? (
                  <div className="p-5 glass-card rounded-2xl text-center text-xs text-slate-400">
                    No active rooms right now. Click "Find Online Match" to start one!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {publicRooms.map((r) => (
                      <div
                        key={r.code}
                        className="glass-card p-3.5 rounded-2xl flex items-center justify-between hover:border-blue-500/50 transition-all border border-slate-200/70 dark:border-slate-800"
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                            #{r.code}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Host: {r.hostName} ({r.players.length}/{r.maxPlayers})
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleJoinRoom(r.code)}
                          className="px-4 py-1.5 glass-pill hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold cursor-pointer"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVE ROOM */}
          {activeTab === "ROOM" && currentRoom && (
            <div className="space-y-4">
              {/* Room Code Badge */}
              <div className="glass-card p-4 rounded-2xl flex items-center justify-between border border-blue-500/30">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Room Code
                  </div>
                  <div className="font-mono text-xl font-black text-blue-600 dark:text-blue-400 tracking-widest">
                    {currentRoom.code}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2 glass-pill rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? "Copied!" : "Copy Code"}</span>
                </button>
              </div>

              {/* Members List */}
              <div className="space-y-2.5">
                <div className="text-xs text-slate-500 font-bold flex justify-between px-1">
                  <span>
                    Players in Lobby ({currentRoom.players.length}/{currentRoom.maxPlayers})
                  </span>
                  <span className="text-emerald-500 font-mono text-[11px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Connected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentRoom.players.map((p) => (
                    <div
                      key={p.id}
                      className="glass-card p-3 rounded-2xl flex items-center gap-2.5 border border-slate-200/70 dark:border-slate-800"
                    >
                      <span className="text-lg">{p.avatar || (p.isHost ? "👑" : "👤")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {p.name} {p.id === myUid ? "(You)" : ""}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.isHost ? "👑 Host" : "🟢 Ready"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Launch Online Game Button */}
              <div className="pt-2">
                {isHost ? (
                  <button
                    type="button"
                    onClick={handleHostLaunch}
                    disabled={loading}
                    className="w-full py-3.5 google-fab-primary font-display font-extrabold text-sm rounded-full transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                    <span>Start Match Now!</span>
                  </button>
                ) : (
                  <div className="p-3.5 glass-card rounded-2xl text-center text-xs text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2">
                    <RefreshCw className="animate-spin text-amber-500" size={14} />
                    <span>
                      Waiting for Host ({currentRoom.hostName || "Host"}) to start the match...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

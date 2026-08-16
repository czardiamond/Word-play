import React, { useState, useEffect } from "react";
import { Player, CategoryInfo } from "../types";
import NotebookPaper from "./NotebookPaper";
import AvatarSelector from "./AvatarSelector";
import { auth, googleProvider, onAuthStateChanged } from "../firebase";
import { User, signInWithPopup } from "firebase/auth";
import {
  Users,
  Plus,
  Trash2,
  Shield,
  Sparkles,
  Smile,
  Hourglass,
  Play,
  ListPlus,
  Dice5,
  Gauge,
  ShieldCheck,
  Flame,
  Zap,
  CheckCircle2,
  Bot
} from "lucide-react";

interface SetupScreenProps {
  onStartGame: (
    players: Player[],
    roundTimeLimit: number,
    categories: CategoryInfo[],
    difficulty: "easy" | "medium" | "hard"
  ) => void;
  id?: string;
}

const INK_COLORS = [
  { name: "Google Blue", class: "text-blue-600", bg: "bg-[#1a73e8]", hex: "#1a73e8" },
  { name: "Google Dark", class: "text-slate-900", bg: "bg-slate-900", hex: "#1e293b" },
  { name: "Google Red", class: "text-red-600", bg: "bg-[#ea4335]", hex: "#ea4335" },
  { name: "Google Purple", class: "text-purple-600", bg: "bg-[#a142f4]", hex: "#a142f4" },
  { name: "Google Green", class: "text-emerald-600", bg: "bg-[#34a853]", hex: "#34a853" }
];

const DEFAULT_AVATARS = ["🎓", "🦊", "⚡", "🎨", "🚀", "👑"];

const AVAILABLE_BOTS = [
  {
    id: "susie",
    name: "Susie",
    personality: "Smart Susie (Word Whiz)",
    desc: "Master vocabulary with rare, high-scoring words.",
    emoji: "🤓",
    speed: "25-30s",
    ink: "text-blue-600",
    rating: 1850,
    rank: "Master",
    badgeBg: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
  },
  {
    id: "harry",
    name: "Harry",
    personality: "Hurry Harry (Speedster)",
    desc: "Instant typing speed. Uses common everyday words.",
    emoji: "⚡",
    speed: "15-20s",
    ink: "text-slate-900",
    rating: 1400,
    rank: "Expert",
    badgeBg: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
  },
  {
    id: "joe",
    name: "Joe",
    personality: "Average Joe (Casual)",
    desc: "Classic casual companion with standard vocabulary.",
    emoji: "🤠",
    speed: "35-45s",
    ink: "text-emerald-600",
    rating: 1050,
    rank: "Intermediate",
    badgeBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
  },
  {
    id: "sam",
    name: "Sam",
    personality: "Silly Sam (Comedian)",
    desc: "Submits hilarious, playful, creative slang words!",
    emoji: "🤪",
    speed: "30-40s",
    ink: "text-purple-600",
    rating: 750,
    rank: "Novice",
    badgeBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
  }
];

const BONUS_SUGGESTIONS = [
  "Cartoon Character",
  "Movie or TV Show",
  "Superpower",
  "Something Yellow",
  "Job or Profession",
  "School Subject",
  "Something in this Room",
  "Famous Singer/Band",
  "Brand or Company",
  "Websites or Apps",
  "Fruit or Vegetable",
  "Holiday or Celebration",
  "Sport or Game",
  "Something Made of Metal",
  "A Verb/Action Word",
  "Something That Makes Noise"
];

export default function SetupScreen({ onStartGame, id }: SetupScreenProps) {
  const [humanPlayers, setHumanPlayers] = useState<Omit<Player, "isBot">[]>([
    { id: "p1", name: "Me", avatar: "🎓", inkColor: "text-blue-600" }
  ]);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>(["susie", "sam", "joe"]);
  const [roundTimeLimit, setRoundTimeLimit] = useState<number>(60);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [activeTab, setActiveTab] = useState<"bots" | "local">("bots");

  const [authUser, setAuthUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (user && !user.isAnonymous && user.displayName) {
        const firstName = user.displayName.split(" ")[0];
        setHumanPlayers((prev) => [
          { ...prev[0], name: firstName || prev[0].name },
          ...prev.slice(1)
        ]);
      }
    });
    return () => unsub();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
        console.error("Google sign in error:", err);
      }
    }
  };

  // Category State
  const [categories, setCategories] = useState<CategoryInfo[]>([
    { id: "name", label: "Name" },
    { id: "animal", label: "Animal" },
    { id: "food", label: "Food" },
    { id: "place", label: "Place" },
    { id: "thing", label: "Thing" }
  ]);
  const [newCatLabel, setNewCatLabel] = useState("");

  const addHumanPlayer = () => {
    if (humanPlayers.length >= 4) return;
    const nextId = `p${humanPlayers.length + 1}`;
    const nextColor = INK_COLORS[humanPlayers.length % INK_COLORS.length].class;
    const nextAvatar = DEFAULT_AVATARS[humanPlayers.length % DEFAULT_AVATARS.length];
    setHumanPlayers([
      ...humanPlayers,
      { id: nextId, name: `Friend ${humanPlayers.length + 1}`, avatar: nextAvatar, inkColor: nextColor }
    ]);
  };

  const removeHumanPlayer = (idToRemove: string) => {
    if (humanPlayers.length <= 1) return;
    setHumanPlayers(humanPlayers.filter((p) => p.id !== idToRemove));
  };

  const updateHumanPlayerName = (playerId: string, newName: string) => {
    setHumanPlayers(humanPlayers.map((p) => (p.id === playerId ? { ...p, name: newName } : p)));
  };

  const updateHumanPlayerAvatar = (playerId: string, newAvatar: string) => {
    setHumanPlayers(humanPlayers.map((p) => (p.id === playerId ? { ...p, avatar: newAvatar } : p)));
  };

  const updateHumanPlayerInk = (playerId: string, inkClass: string) => {
    setHumanPlayers(humanPlayers.map((p) => (p.id === playerId ? { ...p, inkColor: inkClass } : p)));
  };

  const toggleBot = (botId: string) => {
    if (selectedBotIds.includes(botId)) {
      setSelectedBotIds(selectedBotIds.filter((id) => id !== botId));
    } else {
      setSelectedBotIds([...selectedBotIds, botId]);
    }
  };

  const handleAddCategory = () => {
    const trimmed = newCatLabel.trim();
    if (!trimmed) return;
    if (categories.some((c) => c.label.toLowerCase() === trimmed.toLowerCase())) return;
    if (categories.length >= 8) return;

    const catId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "_");
    setCategories([...categories, { id: catId, label: trimmed, isCustom: true }]);
    setNewCatLabel("");
  };

  const handleSuggestBonus = () => {
    const available = BONUS_SUGGESTIONS.filter(
      (s) => !categories.some((c) => c.label.toLowerCase() === s.toLowerCase())
    );
    if (available.length === 0) return;
    const randomIdx = Math.floor(Math.random() * available.length);
    const suggestion = available[randomIdx];

    const catId = suggestion.toLowerCase().replace(/[^a-z0-9]/g, "_");
    setCategories([...categories, { id: catId, label: suggestion, isCustom: true }]);
  };

  const handleRemoveCategory = (catId: string) => {
    if (categories.length <= 3) return;
    setCategories(categories.filter((c) => c.id !== catId));
  };

  const handleStart = () => {
    const finalHumanPlayers: Player[] = humanPlayers.map((p) => ({
      ...p,
      isBot: false
    }));

    const finalBotPlayers: Player[] = AVAILABLE_BOTS.filter((b) => selectedBotIds.includes(b.id)).map((b) => ({
      id: b.id,
      name: b.name,
      avatar: b.emoji,
      isBot: true,
      botPersonality: b.id as any,
      inkColor: b.ink
    }));

    const allPlayers = [...finalHumanPlayers, ...finalBotPlayers];
    onStartGame(allPlayers, roundTimeLimit, categories, difficulty);
  };

  return (
    <div id={id || "setup-screen-root"} className="max-w-5xl mx-auto my-6 px-4">
      <NotebookPaper>
        {/* Header with Google Studio Branding */}
        <div className="border-b border-slate-200/70 dark:border-slate-800/70 pb-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold mb-2">
                <Sparkles size={13} />
                <span>Google Expressive Studio Edition</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Name, Animal, Food, Place, Thing
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm">
                Gemini 2.5 Active ⚡
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 font-sans">
            Spin the letter wheel, fill your cards, beat friends or AI bots, and let the AI judge score your answers.
          </p>
        </div>

        {/* Content Bento Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Left Column: Player Setup & Bots */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                🎮 Match Configuration
              </label>

              {/* Mode Selection Pills */}
              <div className="flex gap-2 p-1.5 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl border border-white/60 dark:border-slate-700/60 shadow-inner">
                <button
                  type="button"
                  id="tab-bots-btn"
                  onClick={() => setActiveTab("bots")}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "bots"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md border border-slate-200/50 dark:border-slate-700/50"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Bot size={15} />
                  <span>Play vs AI Friends</span>
                </button>
                <button
                  type="button"
                  id="tab-local-btn"
                  onClick={() => setActiveTab("local")}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === "local"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md border border-slate-200/50 dark:border-slate-700/50"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Users size={15} />
                  <span>Local Pass & Play</span>
                </button>
              </div>
            </div>

            {/* Profile configuration card */}
            <div className="glass-card p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>Player Profile</span>
                  {authUser && !authUser.isAnonymous && (
                    <span className="px-2 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-sans font-bold">
                      Google Synced
                    </span>
                  )}
                </h3>

                {(!authUser || authUser.isAnonymous) && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 font-sans font-bold rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center gap-1.5 text-xs cursor-pointer active:scale-95"
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
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <AvatarSelector
                    currentAvatar={humanPlayers[0].avatar || "🎓"}
                    onSelectAvatar={(avatar) => updateHumanPlayerAvatar(humanPlayers[0].id, avatar)}
                  />
                  <input
                    type="text"
                    value={humanPlayers[0].name}
                    maxLength={16}
                    onChange={(e) => updateHumanPlayerName(humanPlayers[0].id, e.target.value)}
                    className="glass-input text-base font-bold px-3 py-2 rounded-xl text-slate-800 dark:text-white w-full"
                    placeholder="Your Name"
                  />
                </div>

                {/* Ink selector */}
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                  {INK_COLORS.map((ink) => (
                    <button
                      key={ink.class}
                      type="button"
                      onClick={() => updateHumanPlayerInk(humanPlayers[0].id, ink.class)}
                      title={ink.name}
                      className={`w-6 h-6 rounded-full ${ink.bg} border-2 transition-all cursor-pointer ${
                        humanPlayers[0].inkColor === ink.class
                          ? "border-amber-400 scale-110 shadow-sm"
                          : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Local human players list */}
            {activeTab === "local" ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-display text-sm font-bold text-slate-800 dark:text-white">
                    Pass & Play Roster
                  </h3>
                  <button
                    type="button"
                    onClick={addHumanPlayer}
                    disabled={humanPlayers.length >= 4}
                    className="text-xs google-fab-primary px-3 py-1.5 rounded-full flex items-center gap-1.5 font-bold disabled:opacity-50 cursor-pointer"
                  >
                    <Plus size={13} /> Add Friend ({humanPlayers.length}/4)
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {humanPlayers.map((player, index) => (
                    <div
                      key={player.id}
                      className="glass-card p-3 rounded-xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 flex-1">
                        <AvatarSelector
                          currentAvatar={player.avatar || "👤"}
                          onSelectAvatar={(avatar) => updateHumanPlayerAvatar(player.id, avatar)}
                        />
                        <input
                          type="text"
                          value={player.name}
                          maxLength={16}
                          onChange={(e) => updateHumanPlayerName(player.id, e.target.value)}
                          className="glass-input text-sm font-bold px-2.5 py-1.5 rounded-lg text-slate-800 dark:text-white w-full"
                        />
                      </div>

                      {/* Ink selection */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {INK_COLORS.map((ink) => (
                          <button
                            key={ink.class}
                            type="button"
                            onClick={() => updateHumanPlayerInk(player.id, ink.class)}
                            title={ink.name}
                            className={`w-5 h-5 rounded-full ${ink.bg} border-2 transition-all ${
                              player.inkColor === ink.class
                                ? "border-amber-400 scale-125 shadow-sm"
                                : "border-transparent opacity-80 hover:opacity-100"
                            }`}
                          />
                        ))}

                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => removeHumanPlayer(player.id)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition ml-2"
                            title="Remove player"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Bot Selection Cards */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-800 dark:text-white">
                    Select AI Opponents ({selectedBotIds.length} Selected)
                  </h3>
                  <span className="text-xs text-slate-500">Tap to toggle</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
                  {AVAILABLE_BOTS.map((bot) => {
                    const isSelected = selectedBotIds.includes(bot.id);
                    return (
                      <button
                        type="button"
                        key={bot.id}
                        onClick={() => toggleBot(bot.id)}
                        className={`p-3.5 rounded-2xl text-left transition-all relative flex flex-col justify-between cursor-pointer border ${
                          isSelected
                            ? "glass-card border-blue-500/60 bg-blue-50/50 dark:bg-blue-950/30 shadow-md ring-2 ring-blue-500/20"
                            : "glass-card border-slate-200/70 dark:border-slate-800 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-2xl shrink-0 border border-slate-200/60 dark:border-slate-700/60">
                            {bot.emoji}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {bot.name}
                              </span>
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${bot.badgeBg}`}>
                                {bot.rating} Elo
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                              {bot.desc}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500">
                          <span>⚡ Speed: {bot.speed}</span>
                          <span className={`font-bold ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`}>
                            {isSelected ? "✓ Active" : "+ Add"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Game rules & round settings */}
          <div className="lg:col-span-5 space-y-6 lg:border-l border-slate-200/70 dark:border-slate-800/70 lg:pl-8 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Category Customizer Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ListPlus size={14} className="text-blue-500" /> Categories ({categories.length}/8)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Min 3 • Max 8</span>
                </label>

                {/* Theme Deck Quick Selectors */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() =>
                      setCategories([
                        { id: "name", label: "Name" },
                        { id: "animal", label: "Animal" },
                        { id: "food", label: "Food" },
                        { id: "place", label: "Place" },
                        { id: "thing", label: "Thing" }
                      ])
                    }
                    className="px-3 py-1 text-xs rounded-full chip-google-blue font-bold whitespace-nowrap cursor-pointer hover:brightness-110"
                  >
                    🏫 Classic
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCategories([
                        { id: "celebrity", label: "Celebrity" },
                        { id: "movie", label: "Movie / Show" },
                        { id: "superhero", label: "Superhero" },
                        { id: "song", label: "Song Title" },
                        { id: "brand", label: "Brand" }
                      ])
                    }
                    className="px-3 py-1 text-xs rounded-full chip-google-red font-bold whitespace-nowrap cursor-pointer hover:brightness-110"
                  >
                    🎬 Pop Culture
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCategories([
                        { id: "country", label: "Country" },
                        { id: "city", label: "City / State" },
                        { id: "landmark", label: "Famous Landmark" },
                        { id: "language", label: "Language" },
                        { id: "currency", label: "Currency" }
                      ])
                    }
                    className="px-3 py-1 text-xs rounded-full chip-google-green font-bold whitespace-nowrap cursor-pointer hover:brightness-110"
                  >
                    🌍 Explorer
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCategories([
                        { id: "ingredient", label: "Food Ingredient" },
                        { id: "dessert", label: "Dessert / Pastry" },
                        { id: "beverage", label: "Drink / Beverage" },
                        { id: "snack", label: "Snack" },
                        { id: "dish", label: "Traditional Dish" }
                      ])
                    }
                    className="px-3 py-1 text-xs rounded-full chip-google-yellow font-bold whitespace-nowrap cursor-pointer hover:brightness-110"
                  >
                    🍔 Foodie
                  </button>
                </div>

                {/* Categories Grid/List */}
                <div className="flex flex-wrap gap-2 p-3 glass-card rounded-2xl max-h-[140px] overflow-y-auto">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="px-3 py-1.5 glass-pill rounded-full flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm"
                    >
                      <span className="font-bold text-blue-500">#</span>
                      <span>{cat.label}</span>
                      {categories.length > 3 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-0.5 cursor-pointer"
                          title={`Remove ${cat.label}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Category Form */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add custom category..."
                    value={newCatLabel}
                    maxLength={24}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    className="glass-input text-xs px-3.5 py-2.5 rounded-xl text-slate-800 dark:text-white flex-1 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={!newCatLabel.trim() || categories.length >= 8}
                    className="px-4 py-2.5 google-fab-primary rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <Plus size={14} /> Add
                  </button>
                  <button
                    type="button"
                    onClick={handleSuggestBonus}
                    disabled={categories.length >= 8}
                    className="px-3.5 py-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl hover:bg-amber-500/25 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    title="Suggest bonus category"
                  >
                    <Dice5 size={14} className="text-amber-500" />
                  </button>
                </div>
              </div>

              {/* Timer Limit */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Hourglass size={14} className="text-blue-500" /> Round Timer
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 45, 60, 90, 0].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRoundTimeLimit(t)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-full transition-all border cursor-pointer ${
                        roundTimeLimit === t
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md scale-105"
                          : "glass-pill text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700"
                      }`}
                    >
                      {t === 0 ? "No Limit" : `${t} Seconds`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty & AI Validation Mode */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Gauge size={14} className="text-blue-500" /> AI Judge Strictness
                  </span>
                </label>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDifficulty("easy")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      difficulty === "easy"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 shadow-md ring-2 ring-emerald-500/30"
                        : "glass-card border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1">
                        🟢 Casual
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                        Lenient judge accepts typos & slang.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDifficulty("medium")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      difficulty === "medium"
                        ? "bg-blue-500/15 border-blue-500 text-blue-950 dark:text-blue-200 shadow-md ring-2 ring-blue-500/30"
                        : "glass-card border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1">
                        🟡 Standard
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                        Classic dictionary rules & pacing.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDifficulty("hard")}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      difficulty === "hard"
                        ? "bg-rose-500/15 border-rose-500 text-rose-950 dark:text-rose-200 shadow-md ring-2 ring-rose-500/30"
                        : "glass-card border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-extrabold flex items-center gap-1">
                        🔴 Master
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">
                        Lightning bots & strict validation.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Launch Game Button */}
            <div className="pt-4">
              <button
                type="button"
                id="start-game-btn"
                onClick={handleStart}
                className="w-full py-4 google-fab-primary font-display font-extrabold text-base rounded-2xl shadow-xl flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Play size={18} />
                <span>START MATCH</span>
              </button>
            </div>
          </div>
        </div>
      </NotebookPaper>
    </div>
  );
}

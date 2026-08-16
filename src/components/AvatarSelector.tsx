import React, { useState } from "react";
import { Smile, Sparkles, Check, X } from "lucide-react";
import { updateUserProfileCustomization } from "../utils/userProfileService";

interface AvatarSelectorProps {
  currentAvatar: string;
  onSelectAvatar: (avatar: string) => void;
}

export const AVATAR_PRESETS = [
  // Classrooms & Scholars
  "🎓", "🎒", "✏️", "📚", "🤓", "🧠", "📝", "🧐",
  // Animals & Fun
  "🦊", "🦉", "🦁", "🐼", "🦄", "🐱", "🐶", "🐸",
  // Action & Magic
  "⚡", "🚀", "👑", "🎯", "🎨", "👾", "🏆", "🌟",
  // Expression & Moods
  "🤠", "🤪", "😎", "🥳", "🤖", "🔥", "⚽", "🌈"
];

export default function AvatarSelector({ currentAvatar, onSelectAvatar }: AvatarSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (emoji: string) => {
    onSelectAvatar(emoji);
    setIsOpen(false);
    try {
      localStorage.setItem("last_player_avatar", emoji);
      updateUserProfileCustomization({ selectedAvatar: emoji });
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="relative inline-block">
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-11 h-11 rounded-2xl glass-card border-2 border-slate-200/80 dark:border-slate-700 hover:border-blue-500 flex items-center justify-center text-xl transition-all shadow-sm cursor-pointer relative group"
        title="Click to change your avatar"
      >
        <span>{currentAvatar || "👤"}</span>
        <span className="absolute -bottom-1 -right-1 bg-blue-600 text-white rounded-full p-0.5 text-[8px] opacity-90 group-hover:scale-110 transition-transform">
          ✏️
        </span>
      </button>

      {/* Popover Selection Modal */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-13 z-50 glass-canvas border border-white/40 dark:border-slate-800 text-slate-800 dark:text-white rounded-3xl p-3.5 shadow-2xl w-68 animate-sparkle-pop">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/70 dark:border-slate-800/80 text-xs font-display font-extrabold text-slate-900 dark:text-white">
              <span className="flex items-center gap-1.5">
                <Smile size={14} className="text-blue-500" /> Choose Your Avatar
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1.5 pt-2.5 max-h-48 overflow-y-auto">
              {AVATAR_PRESETS.map((emoji) => {
                const isSelected = currentAvatar === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelect(emoji)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-500/20 border-2 border-blue-500 text-blue-600 dark:text-blue-400 scale-110 shadow-sm"
                        : "glass-card hover:bg-slate-200/60 dark:hover:bg-slate-700 hover:scale-105"
                    }`}
                  >
                    <span>{emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

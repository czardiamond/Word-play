import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { playBadgeFanfare } from "../utils/soundEffects";

interface BadgeProps {
  key?: React.Key;
  icon: string;
  label: string;
  desc?: string;
  count?: number;
  color: string;
  size?: "sm" | "md" | "lg";
  showSparkleParticles?: boolean;
}

export default function SparkleBadge({
  icon,
  label,
  desc,
  count,
  color,
  size = "sm",
  showSparkleParticles = true
}: BadgeProps) {
  const [bursting, setBursting] = useState(false);

  const triggerBurst = () => {
    playBadgeFanfare();
    setBursting(true);
    setTimeout(() => setBursting(false), 1800);
  };

  const isLg = size === "lg";
  const isMd = size === "md";

  return (
    <div
      onClick={triggerBurst}
      title={desc ? `${label}: ${desc}` : label}
      className={`relative inline-flex items-center gap-1.5 rounded-full border font-semibold shadow-sm cursor-pointer transition-all duration-300 hover:scale-105 select-none animate-sparkle-pop ${
        isLg
          ? "px-3 py-1 text-xs border-amber-300 bg-amber-50 text-amber-900 animate-sparkle-glow"
          : isMd
          ? "px-2.5 py-0.5 text-[10px] border-amber-200 bg-amber-50 text-amber-900"
          : `px-1.5 py-0.5 text-[8px] ${color}`
      }`}
    >
      {/* Floating Sparkle Particles Effect */}
      {(showSparkleParticles || bursting) && (
        <>
          <span className="absolute -top-1 left-1 text-amber-400 text-[10px] pointer-events-none star-p1">✨</span>
          <span className="absolute -top-1.5 right-1 text-yellow-500 text-[9px] pointer-events-none star-p2">⭐</span>
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-300 text-[11px] pointer-events-none star-p3">✦</span>
        </>
      )}

      {/* Main Badge Contents */}
      <span className={isLg ? "text-base" : "text-xs"}>{icon}</span>
      <span className="truncate">{label}</span>

      {count && count > 1 ? (
        <span className="bg-black/15 text-black/80 rounded-full px-1 text-[7px] font-black">
          x{count}
        </span>
      ) : null}

      <Sparkles size={isLg ? 12 : 9} className="text-amber-500 animate-spin" style={{ animationDuration: "5s" }} />
    </div>
  );
}

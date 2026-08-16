import React, { useState, useEffect } from "react";
import NotebookPaper from "./NotebookPaper";
import { playSpinTick } from "../utils/soundEffects";
import { Sparkles, Disc, RefreshCw, Compass, ArrowDown } from "lucide-react";

interface WheelSpinnerProps {
  onLetterSelected: (letter: string) => void;
  id?: string;
}

const ALPHABET = "ABCDEFGHIJKLMNOPRSTWXYZ".split(""); // Omit extremely rare letters Q, U, V for funner gameplay

export default function WheelSpinner({ onLetterSelected, id }: WheelSpinnerProps) {
  const [mode, setMode] = useState<"wheel" | "silent">("wheel");
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentLetter, setCurrentLetter] = useState("A");
  const [degree, setDegree] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  // Silent reciter state
  const [silentIndex, setSilentIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSpinning && mode === "silent") {
      interval = setInterval(() => {
        setSilentIndex((prev) => (prev + 1) % ALPHABET.length);
        setCurrentLetter(ALPHABET[(silentIndex + 1) % ALPHABET.length]);
        playSpinTick();
      }, 70); // Very fast scrolling
    }
    return () => clearInterval(interval);
  }, [isSpinning, mode, silentIndex]);

  const spinWheel = () => {
    if (isSpinning) return;
    setIsSpinning(true);

    if (mode === "wheel") {
      // Choose random letter
      const randomIndex = Math.floor(Math.random() * ALPHABET.length);
      const selectedLetter = ALPHABET[randomIndex];

      // Calculate spin rotation (at least 4 full spins)
      const extraDegree = (randomIndex / ALPHABET.length) * 360;
      const newDegree = degree + 1440 + extraDegree - (degree % 360);
      setDegree(newDegree);

      // Scroll letters sequentially to simulate spinner
      let count = 0;
      const maxScrolls = 22;
      const scrollInterval = setInterval(() => {
        setCurrentLetter(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
        playSpinTick();
        count++;
        if (count >= maxScrolls) {
          clearInterval(scrollInterval);
          setCurrentLetter(selectedLetter);
          setIsSpinning(false);
          setHistory((prev) => [selectedLetter, ...prev.slice(0, 4)]);
          setTimeout(() => {
            onLetterSelected(selectedLetter);
          }, 900);
        }
      }, 90 + count * 10);
    }
  };

  const stopSilentReciter = () => {
    if (!isSpinning) return;
    setIsSpinning(false);
    const selectedLetter = ALPHABET[silentIndex];
    setCurrentLetter(selectedLetter);
    setHistory((prev) => [selectedLetter, ...prev.slice(0, 4)]);
    setTimeout(() => {
      onLetterSelected(selectedLetter);
    }, 1000);
  };

  const startSilentReciter = () => {
    if (isSpinning) return;
    setIsSpinning(true);
  };

  return (
    <div id={id || "wheel-spinner-root"} className="max-w-2xl mx-auto my-6 px-4">
      <NotebookPaper>
        <div className="flex-1 flex flex-col justify-between items-center text-center py-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
              <Sparkles size={13} />
              <span>Alphabet Selector</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Select the Starting Letter
            </h2>

            {/* Mode Switcher Pill */}
            <div className="flex gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-full max-w-[280px] mx-auto border border-white/60 dark:border-slate-700/60 shadow-inner">
              <button
                type="button"
                id="mode-wheel-btn"
                onClick={() => !isSpinning && setMode("wheel")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 ${
                  mode === "wheel"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
                disabled={isSpinning}
              >
                <Disc size={13} className="text-blue-500" />
                <span>Spin Wheel</span>
              </button>
              <button
                type="button"
                id="mode-silent-btn"
                onClick={() => !isSpinning && setMode("silent")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 ${
                  mode === "silent"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
                disabled={isSpinning}
              >
                <span>🤫 Silent</span>
              </button>
            </div>
          </div>

          {/* Interactive Acrylic Glass Area */}
          <div className="my-8 relative flex items-center justify-center">
            {mode === "wheel" ? (
              /* Google Acrylic Glass Wheel */
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                {/* Pointer / Indicator Notch with Google Red Arrow */}
                <div className="absolute -top-3 z-30 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-[#EA4335] text-white shadow-lg flex items-center justify-center border-2 border-white">
                    <ArrowDown size={18} className="animate-bounce" />
                  </div>
                </div>

                {/* Ambient Glow */}
                <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-blue-500/20 via-purple-500/10 to-amber-500/20 blur-xl pointer-events-none" />

                {/* Outer Glass Ring */}
                <div
                  className="w-60 h-60 sm:w-64 sm:h-64 rounded-full border-4 border-white/80 dark:border-slate-700/80 glass-card shadow-2xl relative transition-transform ease-out duration-[3200ms] overflow-hidden flex items-center justify-center"
                  style={{ transform: `rotate(${degree}deg)` }}
                >
                  {/* Quadrant color glows */}
                  <div className="absolute inset-0 bg-[conic-gradient(from_0deg,#4285F4,#EA4335,#FBBC05,#34A853,#4285F4)] opacity-15" />

                  {/* Spokes */}
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-0.5 h-full bg-slate-400/20"
                      style={{ transform: `rotate(${i * 30}deg)` }}
                    />
                  ))}

                  {/* Glass Center Hub */}
                  <div className="absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full glass-canvas border-2 border-white shadow-lg flex flex-col items-center justify-center">
                    <span className="font-display text-6xl sm:text-7xl font-black text-slate-900 dark:text-white select-none animate-float tracking-tight">
                      {currentLetter}
                    </span>
                    <div className="flex gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4285F4]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EA4335]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FBBC04]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34A853]" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Silent Reciter Screen */
              <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-3xl glass-card border border-white/80 dark:border-white/10 flex flex-col items-center justify-center p-6 shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none" />
                {isSpinning ? (
                  <div className="space-y-3 z-10">
                    <span className="font-display text-8xl font-black google-gradient-text tracking-tight animate-pulse block">
                      {currentLetter}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-bold uppercase tracking-wider block">
                      Reciting Alphabet...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3 z-10">
                    <span className="font-display text-8xl font-black text-slate-800 dark:text-white tracking-tight block">
                      {currentLetter}
                    </span>
                    <span className="text-xs text-slate-500 block font-medium">
                      Press start to begin silent recitation
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Trigger Button (Google Expressive FAB style) */}
          <div className="w-full max-w-xs">
            {mode === "wheel" ? (
              <button
                type="button"
                id="spin-wheel-btn"
                onClick={spinWheel}
                disabled={isSpinning}
                className="w-full py-4 google-fab-primary font-display font-extrabold text-sm rounded-full shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Disc size={18} className={isSpinning ? "animate-spin" : ""} />
                <span>{isSpinning ? "Spinning Wheel..." : "SPIN LETTER WHEEL"}</span>
              </button>
            ) : isSpinning ? (
              <button
                type="button"
                id="stop-silent-btn"
                onClick={stopSilentReciter}
                className="w-full py-4 bg-[#EA4335] hover:bg-[#d93025] text-white font-display font-extrabold text-sm rounded-full shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>STOP RECITER! 🛑</span>
              </button>
            ) : (
              <button
                type="button"
                id="start-silent-btn"
                onClick={startSilentReciter}
                className="w-full py-4 google-fab-primary font-display font-extrabold text-sm rounded-full shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>START RECITER 🤫</span>
              </button>
            )}
          </div>

          {/* Previous Letter History list */}
          {history.length > 0 && (
            <div className="mt-6 flex items-center gap-2 justify-center text-xs text-slate-500 font-sans">
              <span>Past letters:</span>
              <div className="flex gap-1.5">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className="w-6 h-6 rounded-full glass-pill flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </NotebookPaper>
    </div>
  );
}

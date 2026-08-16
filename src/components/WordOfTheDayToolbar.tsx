import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, ChevronUp, ChevronDown, Copy, Check, Lightbulb, BookOpen } from "lucide-react";

interface WordOfTheDay {
  word: string;
  category: string;
  letter: string;
  definition: string;
  funFact: string;
  gameTip?: string;
}

interface WordOfTheDayToolbarProps {
  currentLetter?: string;
}

export default function WordOfTheDayToolbar({ currentLetter }: WordOfTheDayToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeLetter, setActiveLetter] = useState<string>(currentLetter || "A");
  const [data, setData] = useState<WordOfTheDay | null>(null);

  // Sync letter when currentLetter changes from game
  useEffect(() => {
    if (currentLetter && currentLetter !== activeLetter) {
      setActiveLetter(currentLetter);
      fetchWord(currentLetter);
    }
  }, [currentLetter]);

  const fetchWord = async (letterToFetch?: string) => {
    const letter = letterToFetch || activeLetter;
    setLoading(true);
    try {
      const res = await fetch(`/api/word-of-the-day?letter=${letter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Error fetching word of the day:", err);
      // Client-side quick fallback if offline
      setData({
        word: letter === "N" ? "Narwhal" : letter === "Z" ? "Zanzibar" : "Axolotl",
        category: letter === "N" ? "Animal" : letter === "Z" ? "Place" : "Animal",
        letter: letter || "A",
        definition: "A fascinating word starting with " + (letter || "A"),
        funFact: "Using unique vocabulary scores maximum points in Name Animal Food Place Thing!",
        gameTip: "Try typing this word during your round!"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWord(activeLetter);
  }, []);

  const handleCopy = () => {
    if (!data?.word) return;
    navigator.clipboard.writeText(data.word);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRandomLetter = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const rand = letters[Math.floor(Math.random() * letters.length)];
    setActiveLetter(rand);
    fetchWord(rand);
  };

  return (
    <div className="w-full glass-canvas border-b border-slate-200/70 dark:border-slate-800/80 shadow-sm transition-all duration-300">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
        {/* Left: Headline & Badge */}
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full font-display font-extrabold text-[11px] shrink-0">
            <Sparkles size={12} className="animate-spin text-amber-500" style={{ animationDuration: '4s' }} />
            <span>WORD OF THE DAY</span>
          </div>

          {data && (
            <div className="flex items-center gap-2 truncate">
              <span className="font-display font-black text-sm tracking-wide text-slate-900 dark:text-white uppercase shrink-0">
                {data.word}
              </span>
              <span className="glass-pill text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0">
                {data.category}
              </span>
              <span className="hidden md:inline text-slate-500 text-[11px] truncate">
                — {data.definition}
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Copy Button */}
          {data && (
            <button
              type="button"
              onClick={handleCopy}
              title="Copy word to clipboard"
              className="p-1.5 px-2.5 glass-pill rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copied ? "Copied!" : "Copy"}</span>
            </button>
          )}

          {/* Refresh Word */}
          <button
            type="button"
            onClick={handleRandomLetter}
            disabled={loading}
            title="Fetch another word of the day"
            className="p-1.5 px-2.5 glass-pill rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">New Word</span>
          </button>

          {/* Toggle Expand Details */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 px-2.5 glass-pill rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors flex items-center gap-1 text-[11px] font-bold cursor-pointer"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="hidden xs:inline">{isExpanded ? "Hide" : "Details"}</span>
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && data && (
        <div className="border-t border-slate-200/70 dark:border-slate-800/80 px-4 py-3.5 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300 animate-fadeIn">
          {/* Definition */}
          <div className="space-y-1 glass-card p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-display font-bold text-[11px]">
              <BookOpen size={13} />
              <span>Definition ({data.letter.toUpperCase()})</span>
            </div>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-[11px]">{data.definition}</p>
          </div>

          {/* Fun Fact */}
          <div className="space-y-1 glass-card p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-display font-bold text-[11px]">
              <Lightbulb size={13} />
              <span>Did You Know?</span>
            </div>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-[11px]">{data.funFact}</p>
          </div>

          {/* Game Strategy Tip */}
          <div className="space-y-1 glass-card p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-display font-bold text-[11px]">
              <Sparkles size={13} />
              <span>Category Strategy Tip</span>
            </div>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-[11px]">
              {data.gameTip || `Using "${data.word}" for ${data.category} in letter ${data.letter} is a high-scoring unique answer!`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

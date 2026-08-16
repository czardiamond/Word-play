import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  Sparkles,
  BookOpen,
  Volume2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Compass,
  Award
} from "lucide-react";
import { speakWord } from "../utils/duolingoSystem";

interface WordLookupResult {
  source?: "gemini" | "fallback";
  word: string;
  targetLetter: string;
  category: string;
  isValidWord: boolean;
  isCategoryMatch: boolean;
  overallVerdict: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  origin?: string;
  funFact: string;
  gameTacticalValue: string;
  strategicScore: number;
  tacticalTip?: string;
  recommendedAlternatives: string[];
}

interface WordLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWord?: string;
  initialCategory?: string;
  initialLetter?: string;
}

const CATEGORIES_LIST = [
  "Name",
  "Animal",
  "Food",
  "Place",
  "Thing",
  "Movie",
  "Celebrity",
  "Superpower",
  "General"
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function WordLookupModal({
  isOpen,
  onClose,
  initialWord = "",
  initialCategory = "General",
  initialLetter
}: WordLookupModalProps) {
  const [searchTerm, setSearchTerm] = useState(initialWord);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedLetter, setSelectedLetter] = useState(
    initialLetter || (initialWord ? initialWord.charAt(0).toUpperCase() : "A")
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WordLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialWord) {
      setSearchTerm(initialWord);
      const letter = initialLetter || initialWord.charAt(0).toUpperCase();
      setSelectedLetter(letter);
      setSelectedCategory(initialCategory || "General");
      performLookup(initialWord, initialCategory || "General", letter);
    }
  }, [initialWord, initialCategory, initialLetter, isOpen]);

  const performLookup = async (word: string, category: string, letter: string) => {
    if (!word || word.trim() === "") return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/word-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: word.trim(),
          category,
          letter
        })
      });

      if (!res.ok) {
        throw new Error(`Lookup failed with status ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.warn("Word lookup error:", err);
      setError("Could not complete lookup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const letter = selectedLetter || searchTerm.trim().charAt(0).toUpperCase();
    performLookup(searchTerm, selectedCategory, letter);
  };

  const handleAlternativeClick = (altWord: string) => {
    setSearchTerm(altWord);
    performLookup(altWord, selectedCategory, selectedLetter);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="glass-canvas max-w-2xl w-full rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 border border-white/80 dark:border-white/20 my-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                Gemini Word & Definition Referee
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                AI Lexicon
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Live dictionary validation, phonetic pronunciation, and tournament scoring value.
            </p>
          </div>
        </div>

        {/* Search & Category Filter Form */}
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter any word (e.g. Axolotl, Zanzibar, Quiche)..."
                className="w-full pl-10 pr-4 py-3 bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchTerm.trim()}
              className="px-6 py-3 google-fab-primary rounded-2xl font-display font-extrabold text-sm flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
              <span>Inspect</span>
            </button>
          </div>

          {/* Letter & Category Pills */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider mr-1">
                Category:
              </span>
              {CATEGORIES_LIST.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    if (searchTerm) performLookup(searchTerm, cat, selectedLetter);
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? "bg-blue-600 text-white shadow-sm"
                      : "glass-pill text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 font-mono uppercase tracking-wider mr-1">
                Letter:
              </span>
              <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full no-scrollbar">
                {ALPHABET.map((char) => (
                  <button
                    key={char}
                    type="button"
                    onClick={() => {
                      setSelectedLetter(char);
                      if (searchTerm) performLookup(searchTerm, selectedCategory, char);
                    }}
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                      selectedLetter === char
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="py-12 text-center space-y-3 glass-card rounded-2xl border border-blue-500/30">
            <RefreshCw size={28} className="animate-spin text-blue-500 mx-auto" />
            <p className="font-display font-bold text-sm text-slate-800 dark:text-white">
              Consulting Gemini Lexicon…
            </p>
            <p className="text-xs text-slate-500 font-sans">
              Verifying dictionary legitimacy, category placement, and tactical value
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <XCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result Card */}
        {result && !loading && (
          <div className="space-y-4 animate-fadeIn">
            {/* Top Word Summary Banner */}
            <div className="glass-card p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-wide">
                      {result.word}
                    </h3>
                    <button
                      type="button"
                      onClick={() => speakWord(result.word)}
                      className="p-2 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full transition-colors cursor-pointer"
                      title="Pronounce Word with TTS"
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">{result.phonetic}</span>
                    <span>•</span>
                    <span className="italic">{result.partOfSpeech}</span>
                    {result.origin && (
                      <>
                        <span>•</span>
                        <span>{result.origin}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score & Verdict Pill */}
                <div className="flex flex-col items-end gap-1.5">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono ${
                      result.isValidWord && result.isCategoryMatch
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : result.isValidWord
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {result.isValidWord && result.isCategoryMatch ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : (
                      <XCircle size={14} className="text-rose-500" />
                    )}
                    <span>{result.overallVerdict}</span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {result.gameTacticalValue || `+${result.strategicScore} pts`}
                  </span>
                </div>
              </div>

              {/* Authoritative Definition */}
              <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/80">
                <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-sans">
                  {result.definition}
                </p>
              </div>
            </div>

            {/* Tactical Grid: Did You Know & Strategic Coach Tips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Fun Fact */}
              <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-display font-bold text-xs">
                  <Lightbulb size={14} />
                  <span>Did You Know?</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  {result.funFact}
                </p>
              </div>

              {/* Tactical Coach Advice */}
              <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-display font-bold text-xs">
                  <Award size={14} />
                  <span>Scattergories Strategy</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                  {result.tacticalTip ||
                    `Using "${result.word}" for ${result.category} yields a solid rating against competitive opponents.`}
                </p>
              </div>
            </div>

            {/* Recommended High-Scoring Alternatives */}
            {result.recommendedAlternatives && result.recommendedAlternatives.length > 0 && (
              <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-display font-bold text-xs">
                    <Compass size={14} />
                    <span>Top 15-Point Alternatives for Letter '{result.targetLetter}' ({result.category}):</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Click word to inspect</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {result.recommendedAlternatives.map((alt) => (
                    <button
                      key={alt}
                      type="button"
                      onClick={() => handleAlternativeClick(alt)}
                      className="px-3 py-1.5 glass-pill hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105"
                    >
                      <span>{alt}</span>
                      <ArrowRight size={11} className="text-blue-500 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

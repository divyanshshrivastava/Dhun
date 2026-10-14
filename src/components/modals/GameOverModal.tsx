"use client";

import React, { useState, useEffect } from "react";
import { GuessRecord } from "../GuessHistory";

export interface SolutionDetails {
  id: string;
  title: string;
  artists: string[];
  movieOrAlbum?: string;
  language: string;
  era: string;
}

export interface GameOverModalProps {
  isOpen: boolean;
  isWon: boolean;
  attemptsUsed: number;
  guesses: GuessRecord[];
  solution?: SolutionDetails;
  challengeDate?: string;
  mode?: "DAILY" | "PRACTICE";
  onClose: () => void;
  onOpenStats?: () => void;
  onPlayNextPractice?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  isWon,
  attemptsUsed,
  guesses,
  solution,
  challengeDate,
  mode = "DAILY",
  onClose,
  onOpenStats,
  onPlayNextPractice,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // Countdown timer to midnight IST (UTC+5:30)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // IST is UTC+5.5 hours
      const nowUtcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const istMs = nowUtcMs + 5.5 * 3600000;
      const istDate = new Date(istMs);

      // Midnight IST of next calendar day
      const nextMidnightIst = new Date(istDate);
      nextMidnightIst.setHours(24, 0, 0, 0);

      const diffMs = nextMidnightIst.getTime() - istDate.getTime();
      if (diffMs <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(
          seconds
        ).padStart(2, "0")}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Generate Wordle-style emoji grid
  const generateEmojiShareText = (): string => {
    const dateLabel = challengeDate || new Date().toISOString().slice(0, 10);
    const scoreLabel = isWon ? `${attemptsUsed}/6` : "X/6";

    const emojiRow = guesses
      .map((g) => {
        if (g.isCorrect) return "🟩";
        if (g.action === "SKIP") return "⬛";
        return "🟥";
      })
      .join("");

    return `Dhun (${dateLabel}) ${scoreLabel}\n${emojiRow}\n\nPlay at: https://dhun.game`;
  };

  const handleCopy = async () => {
    const text = generateEmojiShareText();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const spotifySearchUrl = solution
    ? `https://open.spotify.com/search/${encodeURIComponent(
        `${solution.title} ${solution.artists.join(" ")}`
      )}`
    : "#";

  const youtubeSearchUrl = solution
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${solution.title} ${solution.artists.join(" ")}`
      )}`
    : "#";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-guess-pop"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center gap-5">
        {/* Close icon button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Win/Loss Status Banner */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-4xl">{isWon ? "🎉" : "💔"}</span>
          <h2
            id="game-over-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            {isWon ? "Wah! You got it!" : "Game Over"}
          </h2>
          <p className="text-sm text-slate-400">
            {isWon
              ? `Guessed in ${attemptsUsed} attempt${attemptsUsed === 1 ? "" : "s"}!`
              : "Better luck tomorrow!"}
          </p>
        </div>

        {/* Song Solution Card */}
        {solution && (
          <div className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col items-center gap-2 shadow-inner">
            <span className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold">
              Today&apos;s Dhun
            </span>
            <h3 className="text-lg font-bold text-white truncate max-w-full">
              {solution.title}
            </h3>
            <p className="text-sm text-slate-300 truncate max-w-full">
              {solution.artists?.join(", ")}
            </p>
            {solution.movieOrAlbum && (
              <p className="text-xs text-slate-400 italic">
                From &ldquo;{solution.movieOrAlbum}&rdquo;
              </p>
            )}

            {/* Listen on Spotify / YouTube */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href={spotifySearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/50 text-[#1DB954] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>Spotify</span> ↗
              </a>
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#FF0000]/20 hover:bg-[#FF0000]/30 border border-[#FF0000]/50 text-red-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>YouTube</span> ↗
              </a>
            </div>
          </div>
        )}

        {/* Share Button & Countdown */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <span>{copied ? "✓ Copied to Clipboard!" : "Share Result 📋"}</span>
          </button>

          {onOpenStats && (
            <button
              type="button"
              onClick={onOpenStats}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              View Full Statistics
            </button>
          )}

          {mode === "PRACTICE" && onPlayNextPractice ? (
            <button
              type="button"
              onClick={onPlayNextPractice}
              className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>🎲</span>
              <span>Play Next Practice Song</span>
            </button>
          ) : (
            /* Midnight Countdown */
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Next Dhun in:</span>
              <span className="font-mono font-bold text-amber-400">{timeLeft || "--:--:--"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState, useEffect } from "react";
import { GuessRecord } from "../GuessHistory";
import { X, Share2, Check, Clock, ExternalLink } from "lucide-react";

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
      const nowUtcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const istMs = nowUtcMs + 5.5 * 3600000;
      const istDate = new Date(istMs);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-guess-pop"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center gap-5">
        {/* Close icon button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Win/Loss Status Banner */}
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="text-4xl">{isWon ? "🎉" : "💔"}</span>
          <h2
            id="game-over-title"
            className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            {isWon ? "Shabaash! You Got It!" : "Game Over"}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
            {isWon
              ? `Guessed in ${attemptsUsed} of 6 attempts!`
              : "Better luck tomorrow!"}
          </p>
        </div>

        {/* Song Solution Card */}
        {solution && (
          <div className="w-full bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 flex flex-col items-center gap-1.5 shadow-sm">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">
              {mode === "DAILY" ? "Today's Dhun" : "Practice Dhun"}
            </span>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate max-w-full">
              {solution.title}
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate max-w-full">
              {solution.artists?.join(", ")}
            </p>
            {solution.movieOrAlbum && (
              <p className="text-xs text-neutral-400 dark:text-neutral-400 italic">
                From &ldquo;{solution.movieOrAlbum}&rdquo;
              </p>
            )}

            {/* Listen on Spotify / YouTube */}
            <div className="flex items-center gap-2 pt-2">
              <a
                href={spotifySearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 text-[#1DB954] dark:text-[#1ed760] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Spotify</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={youtubeSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 border border-[#FF0000]/30 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span>YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Share Button & Countdown */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="btn-tactile w-full h-11 bg-amber-500 hover:bg-amber-600 text-white dark:text-neutral-950 font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share Result</span>
              </>
            )}
          </button>

          {onOpenStats && (
            <button
              type="button"
              onClick={onOpenStats}
              className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 underline underline-offset-2 transition-colors cursor-pointer py-1"
            >
              View Full Statistics
            </button>
          )}

          {mode === "PRACTICE" && onPlayNextPractice ? (
            <button
              type="button"
              onClick={onPlayNextPractice}
              className="btn-tactile w-full h-11 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Play Next Practice Song 🎲</span>
            </button>
          ) : (
            /* Midnight Countdown */
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Next Dhun in:</span>
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{timeLeft || "--:--:--"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

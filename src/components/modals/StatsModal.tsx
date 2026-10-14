"use client";

import React, { useEffect } from "react";
import { X, Trophy, Flame } from "lucide-react";

export interface PlayerStatsData {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  guessDistribution?: Record<string, number>;
}

export interface StatsModalProps {
  isOpen: boolean;
  stats: PlayerStatsData;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, stats, onClose }) => {
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

  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  const dist = stats.guessDistribution || {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
  };

  const maxFreq = Math.max(
    1,
    ...[1, 2, 3, 4, 5, 6].map((i) => dist[String(i)] || 0)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stats-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-guess-pop"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-5">
        {/* Close icon */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close statistics modal"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="stats-modal-title" className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span>Player Statistics</span>
        </h2>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-4 gap-2 w-full text-center">
          <div className="bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
              {stats.gamesPlayed}
            </span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Played</span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
              {winRate}%
            </span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Win %</span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2.5 flex flex-col items-center">
            <div className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span className="text-xl font-bold font-mono">
                {stats.currentStreak}
              </span>
            </div>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Current</span>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {stats.maxStreak}
            </span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Max</span>
          </div>
        </div>

        {/* Guess Distribution Horizontal Bars */}
        <div className="w-full flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400 text-left">
            Guess Distribution
          </h3>

          <div className="flex flex-col gap-1.5 w-full">
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const count = dist[String(num)] || 0;
              const barWidthPercent = Math.max((count / maxFreq) * 100, 7);

              return (
                <div key={num} className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-3 text-right text-neutral-500 dark:text-neutral-400 font-bold">{num}</span>
                  <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg h-5 overflow-hidden flex items-center">
                    <div
                      style={{ width: `${barWidthPercent}%` }}
                      className={`h-full flex items-center justify-end px-2 text-[11px] font-bold transition-all duration-300 ${
                        count > 0
                          ? "bg-amber-500 text-white dark:text-neutral-950"
                          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500"
                      }`}
                    >
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-tactile w-full h-10 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

"use client";

import React from "react";

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-guess-pop"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-6">
        {/* Close icon */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close statistics modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="stats-modal-title" className="text-xl font-bold text-white tracking-tight">
          Player Statistics
        </h2>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-4 gap-2 w-full text-center">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-white">
              {stats.gamesPlayed}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">Played</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-white">
              {winRate}%
            </span>
            <span className="text-[11px] text-slate-400 mt-1">Win %</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-amber-400">
              {stats.currentStreak}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">Current</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex flex-col items-center">
            <span className="text-xl font-bold font-mono text-amber-400">
              {stats.maxStreak}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">Max</span>
          </div>
        </div>

        {/* Guess Distribution Horizontal Bars */}
        <div className="w-full flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wider font-mono text-slate-400 font-semibold text-left">
            Guess Distribution
          </h3>

          <div className="flex flex-col gap-1.5 w-full">
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const count = dist[String(num)] || 0;
              const barWidthPercent = Math.max((count / maxFreq) * 100, 7);

              return (
                <div key={num} className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-3 text-right text-slate-400">{num}</span>
                  <div className="flex-1 bg-slate-800/50 rounded h-5 overflow-hidden flex items-center">
                    <div
                      style={{ width: `${barWidthPercent}%` }}
                      className={`h-full flex items-center justify-end px-2 text-[11px] font-bold text-slate-950 transition-all duration-300 ${
                        count > 0 ? "bg-amber-400" : "bg-slate-700 text-slate-400"
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
          className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

"use client";

import React from "react";

export interface GuessRecord {
  attemptIndex: number; // 0 to 5
  action: "GUESS" | "SKIP";
  isCorrect: boolean;
  guessedSongTitle?: string;
  guessedSongArtists?: string[];
}

export interface GuessHistoryProps {
  guesses: GuessRecord[];
  attemptsUsed: number; // 0 to 6
  maxAttempts?: number; // default 6
  isGameOver?: boolean;
}

export const GuessHistory: React.FC<GuessHistoryProps> = ({
  guesses,
  attemptsUsed,
  maxAttempts = 6,
  isGameOver = false,
}) => {
  const slots = Array.from({ length: maxAttempts }, (_, index) => {
    const existingGuess = guesses.find((g) => g.attemptIndex === index);
    const isCurrent = !isGameOver && index === attemptsUsed;
    const isFuture = index > attemptsUsed;

    return {
      index,
      guess: existingGuess,
      isCurrent,
      isFuture,
    };
  });

  return (
    <div
      className="w-full flex flex-col gap-2 select-none"
      role="region"
      aria-label="Guess history"
      aria-live="polite"
    >
      {slots.map(({ index, guess, isCurrent, isFuture }) => {
        // Case 1: Correct Guess (Win)
        if (guess && guess.isCorrect) {
          return (
            <div
              key={index}
              className="h-12 px-4 rounded-xl border border-emerald-500/70 bg-emerald-950/40 backdrop-blur-md flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-guess-pop"
              aria-label={`Attempt ${index + 1}: Correct! ${guess.guessedSongTitle}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                  ✓
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-sm text-emerald-200 truncate">
                    {guess.guessedSongTitle || "Correct Song"}
                  </span>
                  {guess.guessedSongArtists && guess.guessedSongArtists.length > 0 && (
                    <span className="text-[11px] text-emerald-400/80 truncate">
                      {guess.guessedSongArtists.join(", ")}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 flex-shrink-0">
                🟩 WIN
              </span>
            </div>
          );
        }

        // Case 2: Incorrect Guess
        if (guess && !guess.isCorrect && guess.action === "GUESS") {
          return (
            <div
              key={index}
              className="h-12 px-4 rounded-xl border border-red-500/50 bg-red-950/30 backdrop-blur-md flex items-center justify-between gap-3 animate-guess-pop"
              aria-label={`Attempt ${index + 1}: Incorrect guess, ${guess.guessedSongTitle}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500/80 text-white flex items-center justify-center font-bold text-xs">
                  ✕
                </span>
                <span className="text-sm text-slate-300 line-through truncate">
                  {guess.guessedSongTitle || "Incorrect Guess"}
                </span>
              </div>
              <span className="text-xs font-mono text-red-400 flex-shrink-0">
                🟥 WRONG
              </span>
            </div>
          );
        }

        // Case 3: Skipped Attempt
        if (guess && guess.action === "SKIP") {
          return (
            <div
              key={index}
              className="h-12 px-4 rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3 animate-guess-pop"
              aria-label={`Attempt ${index + 1}: Skipped`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0 text-slate-400 text-sm">⏭</span>
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Skipped
                </span>
              </div>
              <span className="text-xs font-mono text-slate-500 flex-shrink-0">
                ⬛ SKIP
              </span>
            </div>
          );
        }

        // Case 4: Active Current Attempt Row
        if (isCurrent) {
          return (
            <div
              key={index}
              className="h-12 px-4 rounded-xl border border-amber-500/60 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30 transition-all"
              aria-label={`Attempt ${index + 1}: Active attempt`}
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
                <span className="text-sm font-medium text-amber-300">
                  Attempt {index + 1} of {maxAttempts}
                </span>
              </div>
              <span className="text-xs font-mono text-amber-400/80">
                ACTIVE
              </span>
            </div>
          );
        }

        // Case 5: Locked / Future Attempt Row
        return (
          <div
            key={index}
            className="h-12 px-4 rounded-xl border border-dashed border-slate-800/60 bg-slate-950/30 flex items-center justify-between gap-3"
            aria-label={`Attempt ${index + 1}: Locked`}
          >
            <span className="text-xs font-mono text-slate-600">
              {index + 1}
            </span>
            <span className="text-xs text-slate-700">
              —
            </span>
          </div>
        );
      })}
    </div>
  );
};

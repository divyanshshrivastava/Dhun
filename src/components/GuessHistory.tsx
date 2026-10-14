"use client";

import React from "react";
import { Check, X, SkipForward } from "lucide-react";

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
      className="w-full flex flex-col gap-1 select-none"
      role="region"
      aria-label="Guess history"
      aria-live="polite"
    >
      {slots.map(({ index, guess, isCurrent }) => {
        // Case 1: Correct Guess (Win)
        if (guess && guess.isCorrect) {
          return (
            <div
              key={index}
              className="h-7 px-2.5 rounded-lg border border-emerald-400 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-between gap-2 shadow-xs animate-guess-pop"
              aria-label={`Attempt ${index + 1}: Correct! ${guess.guessedSongTitle}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="font-semibold text-xs text-emerald-900 dark:text-emerald-100 truncate">
                  {guess.guessedSongTitle || "Correct Song"}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.5 rounded flex-shrink-0">
                WIN
              </span>
            </div>
          );
        }

        // Case 2: Incorrect Guess
        if (guess && !guess.isCorrect && guess.action === "GUESS") {
          return (
            <div
              key={index}
              className="h-7 px-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 flex items-center justify-between gap-2 animate-guess-pop"
              aria-label={`Attempt ${index + 1}: Incorrect guess, ${guess.guessedSongTitle}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                  <X className="w-2.5 h-2.5 stroke-[3]" />
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400 line-through truncate font-medium">
                  {guess.guessedSongTitle || "Incorrect Guess"}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60 px-1 py-0.5 rounded flex-shrink-0">
                MISSED
              </span>
            </div>
          );
        }

        // Case 3: Skipped Attempt
        if (guess && guess.action === "SKIP") {
          return (
            <div
              key={index}
              className="h-7 px-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-[#14161b] flex items-center justify-between gap-2 animate-guess-pop"
              aria-label={`Attempt ${index + 1}: Skipped`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <SkipForward className="w-3 h-3 text-neutral-400 dark:text-neutral-500 flex-shrink-0" />
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Skipped
                </span>
              </div>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex-shrink-0">
                SKIP
              </span>
            </div>
          );
        }

        // Case 4: Active Current Attempt Row
        if (isCurrent) {
          return (
            <div
              key={index}
              className="h-7 px-2.5 rounded-lg border border-[#c5e31e] dark:border-[#d6f830] bg-[#c5e31e]/10 dark:bg-[#d6f830]/10 flex items-center justify-between gap-2 transition-all shadow-xs"
              aria-label={`Attempt ${index + 1}: Active attempt`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#c5e31e] dark:bg-[#d6f830] text-neutral-950 font-bold text-[9px] flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Attempt {index + 1} of {maxAttempts}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#7a8f08] dark:text-[#d6f830] bg-[#c5e31e]/20 dark:bg-[#d6f830]/20 px-1.5 py-0.5 rounded">
                ACTIVE
              </span>
            </div>
          );
        }

        // Case 5: Locked / Future Attempt Row
        return (
          <div
            key={index}
            className="h-5.5 px-2.5 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-850 bg-neutral-50/50 dark:bg-[#14161b]/40 flex items-center justify-between gap-2 opacity-70"
            aria-label={`Attempt ${index + 1}: Locked`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-600 font-medium text-[8px] flex items-center justify-center">
                {index + 1}
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-600">
                Locked
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

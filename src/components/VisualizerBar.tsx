"use client";

import React from "react";

export interface VisualizerBarProps {
  currentAttempt: number; // 0 to 5
  currentTime: number; // in seconds
  isPlaying: boolean;
  isWon?: boolean;
  isGameOver?: boolean;
}

// Slice cumulative timestamps in seconds
export const CUMULATIVE_DURATIONS = [0.1, 0.5, 1.5, 4.0, 8.0, 15.0];
const TOTAL_DURATION = 15.0;

// Individual segment delta durations (how wide each segment is visually)
const SEGMENT_DELTAS = [
  0.1, // 0 -> 0.1s
  0.4, // 0.1 -> 0.5s
  1.0, // 0.5 -> 1.5s
  2.5, // 1.5 -> 4.0s
  4.0, // 4.0 -> 8.0s
  7.0, // 8.0 -> 15.0s
];

export const VisualizerBar: React.FC<VisualizerBarProps> = ({
  currentAttempt,
  currentTime,
  isPlaying,
  isWon = false,
  isGameOver = false,
}) => {
  // If game is over (won or lost), full 15s is unlocked
  const effectiveAttempt = isGameOver ? 5 : Math.min(Math.max(currentAttempt, 0), 5);
  const unlockedDuration = CUMULATIVE_DURATIONS[effectiveAttempt];

  // Calculate playhead position as percentage of total 15s width
  const progressPercent = Math.min(
    Math.max((currentTime / TOTAL_DURATION) * 100, 0),
    100
  );

  return (
    <div className="w-full flex flex-col gap-1.5 select-none" aria-label="Audio timeline visualizer">
      {/* 6-segment cumulative timeline bar */}
      <div
        className="relative w-full h-7 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700/60 shadow-sm flex"
        role="progressbar"
        aria-label="Song snippet timeline"
        aria-valuenow={Math.round(currentTime * 10) / 10}
        aria-valuemin={0}
        aria-valuemax={unlockedDuration}
      >
        {SEGMENT_DELTAS.map((delta, idx) => {
          const widthPercent = (delta / TOTAL_DURATION) * 100;
          const isUnlocked = idx <= effectiveAttempt;
          const isCurrentActive = idx === effectiveAttempt && !isGameOver;

          // Clean, game-like segment styling
          let bgClass = "bg-neutral-100 dark:bg-neutral-800/40";
          if (isWon) {
            bgClass = isUnlocked
              ? "bg-emerald-100/70 dark:bg-emerald-900/30"
              : "bg-neutral-100 dark:bg-neutral-850/40";
          } else if (isUnlocked) {
            bgClass = isCurrentActive
              ? "bg-amber-100/80 dark:bg-amber-500/20"
              : "bg-neutral-200/70 dark:bg-neutral-700/40";
          }

          return (
            <div
              key={idx}
              style={{ width: `${widthPercent}%` }}
              className={`relative h-full border-r border-neutral-200/90 dark:border-neutral-700/60 transition-colors duration-200 flex items-center justify-center ${bgClass}`}
              title={`Attempt ${idx + 1}: up to ${CUMULATIVE_DURATIONS[idx]}s`}
            >
              {!isUnlocked && (
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
              )}
            </div>
          );
        })}

        {/* Dynamic active playhead fill */}
        <div
          className={`absolute top-0 bottom-0 left-0 transition-all duration-75 pointer-events-none ${
            isWon
              ? "bg-emerald-500/30 dark:bg-emerald-500/40"
              : "bg-amber-500/35 dark:bg-amber-500/40"
          }`}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Crisp vertical playhead needle */}
        {isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-amber-600 dark:bg-amber-400 rounded-full pointer-events-none transition-all duration-75 shadow-sm"
            style={{ left: `calc(${progressPercent}% - 2px)` }}
          />
        )}
      </div>

      {/* Segment time marker stamps below the bar */}
      <div className="flex justify-between w-full px-0.5 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
        <span>0s</span>
        {CUMULATIVE_DURATIONS.map((dur, i) => {
          const isReached = i <= effectiveAttempt;
          return (
            <span
              key={i}
              className={`transition-colors ${
                isReached
                  ? "text-amber-600 dark:text-amber-400 font-semibold"
                  : "text-neutral-400 dark:text-neutral-600"
              }`}
            >
              {dur}s
            </span>
          );
        })}
      </div>
    </div>
  );
};

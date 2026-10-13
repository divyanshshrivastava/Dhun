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
    <div className="w-full flex flex-col gap-2 select-none" aria-label="Audio timeline visualizer">
      {/* 6-segment cumulative timeline bar */}
      <div
        className="relative w-full h-8 bg-slate-900/90 rounded-lg overflow-hidden border border-slate-700/60 shadow-inner flex"
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

          // Segment background color
          let bgClass = "bg-slate-800/50";
          if (isWon) {
            bgClass = isUnlocked ? "bg-emerald-600/30" : "bg-slate-850/50";
          } else if (isUnlocked) {
            bgClass = isCurrentActive
              ? "bg-amber-500/25 border-b-2 border-amber-400"
              : "bg-slate-700/40";
          }

          return (
            <div
              key={idx}
              style={{ width: `${widthPercent}%` }}
              className={`relative h-full border-r border-slate-900/80 transition-colors duration-300 flex items-center justify-center ${bgClass}`}
              title={`Attempt ${idx + 1}: up to ${CUMULATIVE_DURATIONS[idx]}s`}
            >
              {/* Locked lock indicator for later segments */}
              {!isUnlocked && (
                <span className="text-[10px] text-slate-500 font-mono tracking-tighter opacity-60">
                  🔒
                </span>
              )}
            </div>
          );
        })}

        {/* Dynamic active playhead fill */}
        <div
          className={`absolute top-0 bottom-0 left-0 transition-all duration-75 pointer-events-none ${
            isWon
              ? "bg-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
              : "bg-gradient-to-r from-amber-600/30 to-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
          }`}
          style={{ width: `${progressPercent}%` }}
        />

        {/* Glowing vertical playhead needle */}
        {isPlaying && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-amber-300 rounded-full shadow-[0_0_8px_#f59e0b] pointer-events-none transition-all duration-75"
            style={{ left: `calc(${progressPercent}% - 2px)` }}
          />
        )}
      </div>

      {/* Segment time marker stamps below the bar */}
      <div className="relative w-full h-4 text-[11px] font-mono text-slate-400">
        <div className="flex justify-between w-full">
          <span>0s</span>
          {CUMULATIVE_DURATIONS.map((dur, i) => {
            const isReached = i <= effectiveAttempt;
            return (
              <span
                key={i}
                className={`transition-colors ${
                  isReached ? "text-amber-400 font-medium" : "text-slate-600"
                }`}
              >
                {dur}s
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

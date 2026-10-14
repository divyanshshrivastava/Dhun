"use client";

import React, { useMemo } from "react";
import { Play, Pause, RefreshCw, Volume2, AlertCircle } from "lucide-react";
import { CUMULATIVE_DURATIONS } from "./VisualizerBar";

export interface AudioPlayerCardProps {
  currentAttempt: number;
  currentTime: number;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  isWon?: boolean;
  isGameOver?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRefreshAudio: () => void;
}

const TOTAL_DURATION = 15.0;

// Individual segment delta durations (how wide each segment is visually)
const SEGMENT_DELTAS = [0.1, 0.4, 1.0, 2.5, 4.0, 7.0];

// Fixed visual waveform bar profile for natural acoustic song shape (46 bars)
const WAVEFORM_HEIGHTS = [
  24, 38, 55, 70, 45, 30, 60, 85, 95, 65, 40, 50, 78, 90, 82, 60, 45, 68,
  88, 75, 55, 42, 65, 80, 92, 70, 50, 62, 85, 95, 76, 52, 40, 65, 82, 72,
  58, 44, 60, 78, 88, 66, 48, 38, 28, 20
];

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  currentAttempt,
  currentTime,
  isPlaying,
  isLoading,
  error,
  isWon = false,
  isGameOver = false,
  onPlay,
  onPause,
  onRefreshAudio,
}) => {
  const effectiveAttempt = isGameOver ? 5 : Math.min(Math.max(currentAttempt, 0), 5);
  const totalUnlockedDuration = CUMULATIVE_DURATIONS[effectiveAttempt];

  // Playhead progress percentage (0 to 100%)
  const progressPercent = Math.min(
    Math.max((currentTime / TOTAL_DURATION) * 100, 0),
    100
  );

  // Unlocked duration percentage of total width
  const unlockedPercent = (totalUnlockedDuration / TOTAL_DURATION) * 100;

  return (
    <div className="w-full bg-white dark:bg-[#14161b] border border-neutral-200 dark:border-neutral-800/90 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col gap-2 transition-colors">
      {/* Top Header Row of Audio Card */}
      <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase px-0.5">
        <span className="tracking-widest">LISTEN TO THE INTRO</span>
        <span className="flex items-center gap-1 font-mono text-neutral-600 dark:text-neutral-400 font-semibold">
          <Volume2 className="w-3 h-3 text-[#c5e31e] dark:text-[#d6f830]" />
          <span>{totalUnlockedDuration.toFixed(1)} SECONDS</span>
        </span>
      </div>

      {/* Error alert banner if audio loading fails */}
      {error && (
        <div
          role="alert"
          className="w-full p-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between gap-2 text-red-800 dark:text-red-200 text-xs animate-guess-pop"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefreshAudio}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold flex-shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Center Waveform & Play Button Container */}
      <div className="relative w-full h-16 sm:h-17 bg-neutral-50 dark:bg-[#0f1013] rounded-xl overflow-hidden border border-neutral-100 dark:border-neutral-850 flex items-center justify-center px-3">
        {/* Waveform Bars Container */}
        <div className="w-full h-full flex items-center justify-between gap-0.5 sm:gap-1 px-1">
          {WAVEFORM_HEIGHTS.map((height, idx) => {
            const barTime = (idx / (WAVEFORM_HEIGHTS.length - 1)) * TOTAL_DURATION;
            const isPlayed = barTime <= currentTime;
            const isUnlocked = barTime <= totalUnlockedDuration;

            // Bar styling based on playback state
            let barColor = "bg-neutral-200 dark:bg-neutral-800";
            if (isWon) {
              barColor = isPlayed
                ? "bg-emerald-500"
                : isUnlocked
                ? "bg-emerald-400/50"
                : "bg-neutral-200 dark:bg-neutral-800";
            } else if (isPlayed) {
              barColor = "bg-[#c5e31e] dark:bg-[#d6f830]";
            } else if (isUnlocked) {
              barColor = "bg-[#c5e31e]/40 dark:bg-[#d6f830]/40";
            }

            return (
              <div
                key={idx}
                style={{ height: `${height}%` }}
                className={`w-1 rounded-full transition-all duration-150 ${barColor} ${
                  isPlaying && isPlayed ? "scale-y-110" : ""
                }`}
              />
            );
          })}
        </div>

        {/* Center Circular Play Button */}
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={isLoading}
          aria-label={
            isLoading
              ? "Loading audio snippet"
              : isPlaying
              ? "Pause audio snippet"
              : "Play audio snippet"
          }
          className={`btn-tactile absolute z-10 w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-transform cursor-pointer ${
            isLoading
              ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-wait"
              : "bg-[#c5e31e] hover:bg-[#b8d617] dark:bg-[#d6f830] dark:hover:bg-[#c6e822] text-neutral-950 hover:scale-105 active:scale-95 shadow-[#c5e31e]/20"
          }`}
        >
          {isLoading ? (
            <RefreshCw className="animate-spin w-4 h-4 text-neutral-700 dark:text-neutral-900" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      </div>

      {/* Time Stamps & 6-Segment Timeline */}
      <div className="w-full flex flex-col gap-1">
        {/* Time Labels: 0:00 and 0:15 */}
        <div className="flex justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 px-0.5">
          <span>0:{currentTime.toFixed(1).padStart(4, "0")}</span>
          <span>0:{TOTAL_DURATION.toFixed(0).padStart(2, "0")}</span>
        </div>

        {/* Segmented Timeline Bar */}
        <div
          className="relative w-full h-2 bg-neutral-100 dark:bg-neutral-800/90 rounded-full overflow-hidden flex border border-neutral-200/60 dark:border-neutral-700/50"
          role="progressbar"
          aria-label="Snippet timeline"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={totalUnlockedDuration}
        >
          {SEGMENT_DELTAS.map((delta, idx) => {
            const widthPercent = (delta / TOTAL_DURATION) * 100;
            const isUnlocked = idx <= effectiveAttempt;
            return (
              <div
                key={idx}
                style={{ width: `${widthPercent}%` }}
                className={`h-full border-r border-neutral-300 dark:border-neutral-900/90 transition-colors ${
                  isUnlocked
                    ? "bg-neutral-300/80 dark:bg-neutral-700"
                    : "bg-neutral-100 dark:bg-neutral-850"
                }`}
              />
            );
          })}

          {/* Active Played Fill */}
          <div
            className={`absolute top-0 bottom-0 left-0 transition-all duration-75 pointer-events-none ${
              isWon
                ? "bg-emerald-500"
                : "bg-[#c5e31e] dark:bg-[#d6f830]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Milestone Marks: 0.1s, 0.5s, 1.5s, 4s, 8s, 15s */}
        <div className="flex justify-between w-full px-0.5 text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
          {CUMULATIVE_DURATIONS.map((dur, i) => {
            const isReached = i <= effectiveAttempt;
            return (
              <span
                key={i}
                className={`transition-colors ${
                  isReached
                    ? "text-[#a3bd12] dark:text-[#d6f830] font-bold"
                    : "text-neutral-400 dark:text-neutral-600"
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

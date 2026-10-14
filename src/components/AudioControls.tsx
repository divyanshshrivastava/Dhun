"use client";

import React from "react";
import { CUMULATIVE_DURATIONS } from "./VisualizerBar";
import { Play, Pause, SkipForward, AlertCircle, RefreshCw } from "lucide-react";

export interface AudioControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  currentAttempt: number;
  isGameOver: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkip: () => void;
  onRefreshAudio: () => void;
  onGiveUp?: () => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  isLoading,
  error,
  currentTime,
  currentAttempt,
  isGameOver,
  onPlay,
  onPause,
  onSkip,
  onRefreshAudio,
  onGiveUp,
}) => {
  const effectiveAttempt = isGameOver ? 5 : Math.min(Math.max(currentAttempt, 0), 5);
  const totalUnlockedDuration = CUMULATIVE_DURATIONS[effectiveAttempt];

  // Calculate next snippet duration for the Skip button label
  const nextAttempt = effectiveAttempt + 1;
  const nextDuration =
    nextAttempt < CUMULATIVE_DURATIONS.length
      ? CUMULATIVE_DURATIONS[nextAttempt]
      : null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Error / Network Notification */}
      {error && (
        <div
          role="alert"
          className="w-full p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between gap-3 text-red-800 dark:text-red-200 text-xs sm:text-sm animate-guess-pop"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefreshAudio}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors flex-shrink-0 cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Main Playback Bar with Time Display & Play/Pause */}
      <div className="w-full flex items-center justify-between px-1">
        {/* Current Time / Duration Stamp */}
        <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/80 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700/60">
          <span className="text-amber-600 dark:text-amber-400">
            {currentTime.toFixed(1)}s
          </span>
          <span className="text-neutral-400 dark:text-neutral-500"> / </span>
          <span>{totalUnlockedDuration.toFixed(1)}s</span>
        </div>

        {/* Big Tactile Circular Play / Pause Button */}
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
          className={`btn-tactile relative w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
            isLoading
              ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-wait"
              : isPlaying
              ? "bg-amber-500 text-white dark:text-neutral-950 hover:bg-amber-600 dark:hover:bg-amber-400 scale-105 shadow-amber-500/25 shadow-lg"
              : "bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-neutral-950 hover:scale-105 shadow-amber-500/20 shadow-md"
          }`}
        >
          {isLoading ? (
            <RefreshCw className="animate-spin w-6 h-6 text-neutral-500 dark:text-neutral-400" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        {/* Give up / Forfeit button or empty spacer */}
        {!isGameOver && onGiveUp ? (
          <button
            type="button"
            onClick={onGiveUp}
            className="text-xs text-neutral-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 transition-colors px-2 py-1.5 cursor-pointer rounded-md font-medium"
            title="Give up and reveal the song"
          >
            Give Up?
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Action Buttons: Skip */}
      {!isGameOver && (
        <div className="w-full pt-1">
          <button
            type="button"
            onClick={onSkip}
            disabled={isLoading}
            className="btn-tactile w-full h-11 px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700/80 text-neutral-800 dark:text-neutral-200 rounded-xl font-semibold text-sm border border-neutral-200 dark:border-neutral-700/80 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            aria-label={`Skip to next snippet duration${
              nextDuration ? `, unlocking ${nextDuration}s` : ""
            }`}
          >
            <SkipForward className="w-4 h-4" />
            <span>SKIP</span>
            {nextDuration && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                (+{nextDuration}s)
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

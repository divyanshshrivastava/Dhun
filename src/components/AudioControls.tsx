"use client";

import React from "react";
import { CUMULATIVE_DURATIONS } from "./VisualizerBar";

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
    <div className="w-full flex flex-col items-center gap-4">
      {/* Error / Slow Network / Token Refresh Banner */}
      {error && (
        <div
          role="alert"
          className="w-full p-3 bg-red-950/70 border border-red-500/60 rounded-xl flex items-center justify-between gap-3 text-red-200 text-sm shadow-lg animate-guess-pop"
        >
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-lg">⚠️</span>
            <span className="text-xs sm:text-sm font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefreshAudio}
            className="px-3 py-1 bg-red-800/80 hover:bg-red-700 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors flex-shrink-0 cursor-pointer"
          >
            Retry Audio
          </button>
        </div>
      )}

      {/* Main Playback Bar with Time Display & Play/Pause */}
      <div className="w-full flex items-center justify-between px-2">
        {/* Current Time / Duration Stamp */}
        <div className="font-mono text-sm text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-amber-400 font-semibold">
            {currentTime.toFixed(1)}s
          </span>
          <span className="text-slate-500"> / </span>
          <span>{totalUnlockedDuration.toFixed(1)}s</span>
        </div>

        {/* Big Circular Play / Pause Button */}
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
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl cursor-pointer active:scale-95 ${
            isLoading
              ? "bg-slate-800 text-slate-500 cursor-wait"
              : isPlaying
              ? "bg-amber-500 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.6)] scale-105"
              : "bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-105"
          }`}
        >
          {isLoading ? (
            <svg
              className="animate-spin h-7 w-7 text-amber-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : isPlaying ? (
            // Pause Icon
            <svg
              className="w-7 h-7"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            // Play Icon (slightly offset to visual center)
            <svg
              className="w-7 h-7 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Give up / Forfeit button or empty spacer */}
        {!isGameOver && onGiveUp ? (
          <button
            type="button"
            onClick={onGiveUp}
            className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 cursor-pointer"
            title="Give up and reveal the song"
          >
            Give Up?
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Action Buttons: Skip and status indicators */}
      {!isGameOver && (
        <div className="w-full flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onSkip}
            disabled={isLoading}
            className="w-full h-11 px-4 bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-700 text-slate-200 rounded-xl font-medium text-sm border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            aria-label={`Skip to next snippet duration${
              nextDuration ? `, unlocking ${nextDuration}s` : ""
            }`}
          >
            <span>SKIP</span>
            {nextDuration && (
              <span className="text-xs font-mono text-amber-400/90 font-normal">
                (+{nextDuration}s)
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

"use client";

import React, { useEffect } from "react";
import { X, HelpCircle, Music, Clock } from "lucide-react";

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-guess-pop"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-5 text-left max-h-[90vh] overflow-y-auto">
        {/* Close icon */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rules modal"
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="help-modal-title" className="text-xl font-bold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-500" />
          <span>How to Play Dhun (धुन)</span>
        </h2>

        <div className="flex flex-col gap-4 text-sm text-neutral-600 dark:text-neutral-300">
          <p>
            Guess today&apos;s song in <strong>6 attempts</strong>. Each puzzle features beloved Indian tracks from Bollywood, Punjabi, Tamil, Telugu, and Indie!
          </p>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Audio Progression</span>
            </h3>
            <ul className="grid grid-cols-2 gap-2 text-xs font-mono">
              <li className="bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                1st: <strong>0.1s</strong>
              </li>
              <li className="bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                2nd: <strong>0.5s</strong>
              </li>
              <li className="bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                3rd: <strong>1.5s</strong>
              </li>
              <li className="bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                4th: <strong>4.0s</strong>
              </li>
              <li className="bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                5th: <strong>8.0s</strong>
              </li>
              <li className="bg-neutral-100 dark:bg-neutral-800/80 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                6th: <strong>15.0s</strong>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              <span>Tips & Rules</span>
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
              <li>Skipped or incorrect attempts unlock more audio from the song.</li>
              <li>Search by song title, movie name, or artist.</li>
              <li>Remakes and originals with identical melodic compositions are credited as correct!</li>
              <li>A new daily challenge unlocks every midnight IST (00:00).</li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="btn-tactile w-full h-10 bg-amber-500 hover:bg-amber-600 text-white dark:text-neutral-950 font-bold rounded-xl transition-colors cursor-pointer"
        >
          Got It, Let&apos;s Play!
        </button>
      </div>
    </div>
  );
};

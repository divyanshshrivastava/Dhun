"use client";

import React from "react";

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-guess-pop"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-5 text-left max-h-[90vh] overflow-y-auto">
        {/* Close icon */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rules modal"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="help-modal-title" className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>🎵</span> How to Play Dhun (धुन)
        </h2>

        <div className="flex flex-col gap-4 text-sm text-slate-300">
          <p>
            Guess today&apos;s Indian song in <strong>6 attempts</strong>. Each puzzle features beloved tracks from Bollywood, Punjabi, Tamil, Telugu, and Indian Indie!
          </p>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-amber-400">
              Cumulative Snippets
            </h3>
            <ul className="grid grid-cols-2 gap-2 text-xs font-mono">
              <li className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                1st: <strong>0.1s</strong>
              </li>
              <li className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                2nd: <strong>0.5s</strong>
              </li>
              <li className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                3rd: <strong>1.5s</strong>
              </li>
              <li className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                4th: <strong>4.0s</strong>
              </li>
              <li className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                5th: <strong>8.0s</strong>
              </li>
              <li className="bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                6th: <strong>15.0s</strong>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-amber-400">
              Hinglish &amp; Acronym Matching
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Type the song in Hinglish, title, movie, or singer name. You can even use movie song acronyms like <code className="text-amber-300 bg-slate-800 px-1 py-0.5 rounded">khnh</code> for <em>Kal Ho Naa Ho</em>!
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs uppercase font-mono tracking-wider font-semibold text-amber-400">
              Canonical Remake Equivalence
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              If the song is a remake or reprise (e.g. <em>Dilbar</em> from 1999 vs 2018), both versions count as correct answers.
            </p>
          </div>

          <div className="flex flex-col gap-1 border-t border-slate-800 pt-3 text-xs text-slate-400">
            <span>✨ A new Dhun drops daily at <strong>00:00 IST</strong>.</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer"
        >
          Got It, Let&apos;s Play!
        </button>
      </div>
    </div>
  );
};

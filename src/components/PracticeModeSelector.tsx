"use client";

import React from "react";
import { SUPPORTED_LANGUAGES } from "../config/languages";
import { MUSIC_ERAS } from "../config/eras";
import { MUSIC_GENRES } from "../config/genres";

export interface PracticeFilters {
  language?: string;
  era?: string;
  genre?: string;
}

interface PracticeModeSelectorProps {
  currentMode: "DAILY" | "PRACTICE";
  filters: PracticeFilters;
  isLoading: boolean;
  onSelectMode: (mode: "DAILY" | "PRACTICE") => void;
  onFilterChange: (filters: PracticeFilters) => void;
  onNewPracticeSong: () => void;
}

export const PracticeModeSelector: React.FC<PracticeModeSelectorProps> = ({
  currentMode,
  filters,
  isLoading,
  onSelectMode,
  onFilterChange,
  onNewPracticeSong,
}) => {
  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center p-1 bg-slate-900/90 border border-slate-800 rounded-xl shadow-inner text-xs font-medium">
        <button
          type="button"
          onClick={() => onSelectMode("DAILY")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === "DAILY"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
          aria-pressed={currentMode === "DAILY"}
        >
          <span>📅</span>
          <span>Daily Dhun</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode("PRACTICE")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === "PRACTICE"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
          aria-pressed={currentMode === "PRACTICE"}
        >
          <span>🎯</span>
          <span>Practice Mode</span>
        </button>
      </div>

      {/* Practice Filters & Controls Panel */}
      {currentMode === "PRACTICE" && (
        <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Filter Practice Songs:</span>
            <button
              type="button"
              onClick={onNewPracticeSong}
              disabled={isLoading}
              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>🎲</span>
              <span>New Song</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Language Filter */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-language" className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Language
              </label>
              <select
                id="filter-language"
                value={filters.language || ""}
                onChange={(e) =>
                  onFilterChange({ ...filters, language: e.target.value || undefined })
                }
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400/80 cursor-pointer"
              >
                <option value="">All Languages</option>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Era Filter */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-era" className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Era
              </label>
              <select
                id="filter-era"
                value={filters.era || ""}
                onChange={(e) =>
                  onFilterChange({ ...filters, era: e.target.value || undefined })
                }
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400/80 cursor-pointer"
              >
                <option value="">All Eras</option>
                {MUSIC_ERAS.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Genre Filter */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-genre" className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Genre
              </label>
              <select
                id="filter-genre"
                value={filters.genre || ""}
                onChange={(e) =>
                  onFilterChange({ ...filters, genre: e.target.value || undefined })
                }
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400/80 cursor-pointer"
              >
                <option value="">All Genres</option>
                {MUSIC_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

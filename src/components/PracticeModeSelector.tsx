"use client";

import React from "react";
import { SUPPORTED_LANGUAGES } from "../config/languages";
import { MUSIC_ERAS } from "../config/eras";
import { MUSIC_GENRES } from "../config/genres";
import { Calendar, Target, Shuffle, Filter } from "lucide-react";

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
    <div className="w-full flex flex-col items-center gap-2.5">
      {/* Mode Switcher Segmented Control */}
      <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/60 rounded-xl text-xs font-semibold">
        <button
          type="button"
          onClick={() => onSelectMode("DAILY")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === "DAILY"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
          aria-pressed={currentMode === "DAILY"}
        >
          <Calendar className="w-3.5 h-3.5 text-amber-500" />
          <span>Daily Dhun</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode("PRACTICE")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            currentMode === "PRACTICE"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
          aria-pressed={currentMode === "PRACTICE"}
        >
          <Target className="w-3.5 h-3.5 text-orange-500" />
          <span>Practice Mode</span>
        </button>
      </div>

      {/* Practice Filters & Controls Panel */}
      {currentMode === "PRACTICE" && (
        <div className="w-full bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-700/60 rounded-xl p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150 shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
              <Filter className="w-3.5 h-3.5 text-amber-500" />
              <span>Filter Practice Songs</span>
            </div>
            <button
              type="button"
              onClick={onNewPracticeSong}
              disabled={isLoading}
              className="btn-tactile flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Shuffle className="w-3 h-3" />
              <span>New Song</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Language Filter */}
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-language" className="text-[10px] uppercase font-semibold text-neutral-500 dark:text-neutral-400">
                Language
              </label>
              <select
                id="filter-language"
                value={filters.language || ""}
                onChange={(e) =>
                  onFilterChange({ ...filters, language: e.target.value || undefined })
                }
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
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
              <label htmlFor="filter-era" className="text-[10px] uppercase font-semibold text-neutral-500 dark:text-neutral-400">
                Era
              </label>
              <select
                id="filter-era"
                value={filters.era || ""}
                onChange={(e) =>
                  onFilterChange({ ...filters, era: e.target.value || undefined })
                }
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
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
              <label htmlFor="filter-genre" className="text-[10px] uppercase font-semibold text-neutral-500 dark:text-neutral-400">
                Genre
              </label>
              <select
                id="filter-genre"
                value={filters.genre || ""}
                onChange={(e) =>
                  onFilterChange({ ...filters, genre: e.target.value || undefined })
                }
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-amber-500 cursor-pointer"
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

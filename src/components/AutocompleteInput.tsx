"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { CatalogSongItem, searchSongCatalog, SearchResultItem } from "../lib/search/catalogSearch";
import { CLIENT_SONG_CATALOG } from "../lib/search/clientCatalog";
import { Search, X, Music2, SkipForward } from "lucide-react";

export interface AutocompleteInputProps {
  onSelectSong: (song: CatalogSongItem) => void;
  onSkip: () => void;
  nextSkipDuration?: number | null;
  disabled?: boolean;
  placeholder?: string;
  attemptNumber?: number;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  onSelectSong,
  onSkip,
  nextSkipDuration,
  disabled = false,
  placeholder = "Search for a song or artist...",
  attemptNumber = 1,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Search instantly on query changes
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setSelectedIndex(-1);
      return;
    }

    const matches = searchSongCatalog(CLIENT_SONG_CATALOG, query.trim(), 10);
    setResults(matches);
    setIsOpen(true);
    setSelectedIndex(matches.length > 0 ? 0 : -1);
  }, [query]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (song: CatalogSongItem) => {
    onSelectSong(song);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && isOpen && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp" && isOpen && results.length > 0) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        const target = selectedIndex >= 0 && selectedIndex < results.length ? results[selectedIndex] : results[0];
        handleSelect(target);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar + Dynamic Action Button (Skip / Submit) */}
      <div className="flex items-center gap-2 w-full">
        {/* Search Input Container */}
        <div className="relative flex-1 flex items-center">
          <div className="absolute left-3.5 pointer-events-none text-neutral-400 dark:text-neutral-500">
            <Search className="w-4 h-4" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim().length >= 2 && results.length > 0) {
                setIsOpen(true);
              }
            }}
            disabled={disabled}
            placeholder={disabled ? "Game completed" : placeholder}
            className="w-full h-11 pl-10 pr-8 bg-white dark:bg-[#14161b] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 rounded-xl border border-neutral-300 dark:border-neutral-800 focus:border-[#c5e31e] dark:focus:border-[#d6f830] focus:ring-1 focus:ring-[#c5e31e]/30 dark:focus:ring-[#d6f830]/30 transition-all outline-none text-xs sm:text-sm font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-label={`Search Indian song catalog for attempt ${attemptNumber}`}
          />

          {/* Quick Clear Query Button */}
          {query && !disabled && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1 cursor-pointer"
              aria-label="Clear search input"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dynamic Action Button: Skip (when empty) / Submit (when text entered) */}
        {!disabled && (
          hasQuery ? (
            <button
              type="button"
              onClick={() => {
                if (results.length > 0) {
                  const target = selectedIndex >= 0 ? results[selectedIndex] : results[0];
                  handleSelect(target);
                }
              }}
              disabled={results.length === 0}
              className="btn-tactile h-11 px-4 sm:px-5 bg-[#c5e31e] hover:bg-[#b4d216] dark:bg-[#d6f830] dark:hover:bg-[#c2e424] text-neutral-950 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm flex-shrink-0 disabled:opacity-50"
            >
              <span>Submit guess</span>
              <span>→</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSkip}
              className="btn-tactile h-11 px-3.5 sm:px-4 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#14161b] dark:hover:bg-[#1d2027] text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 shadow-sm"
              aria-label={`Skip snippet${nextSkipDuration ? `, +${nextSkipDuration}s` : ""}`}
            >
              <span>Skip</span>
              <SkipForward className="w-3.5 h-3.5" />
              {nextSkipDuration && (
                <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500 font-normal">
                  (+{nextSkipDuration}s)
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white dark:bg-[#15171c] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl divide-y divide-neutral-100 dark:divide-neutral-800/80"
          aria-label="Song search suggestions"
        >
          {results.length > 0 ? (
            results.map((song, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  key={song.id}
                  id={`song-opt-${song.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(song)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left ${
                    isSelected
                      ? "bg-[#c5e31e]/15 dark:bg-[#d6f830]/15 text-neutral-900 dark:text-white"
                      : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Music2 className="w-3.5 h-3.5 text-[#a4bd1a] dark:text-[#d6f830] flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs sm:text-sm truncate text-neutral-900 dark:text-neutral-100">
                        {song.title}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                        {song.artists?.join(", ") || "Unknown Artist"}
                        {song.movieOrAlbum ? ` • ${song.movieOrAlbum}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {song.language && (
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
                        {song.language}
                      </span>
                    )}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-5 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No matching Indian songs found for &ldquo;<span className="text-[#a4bd1a] dark:text-[#d6f830] font-semibold">{query}</span>&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

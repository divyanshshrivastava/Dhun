"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import { CatalogSongItem, searchSongCatalog, SearchResultItem } from "../lib/search/catalogSearch";
import { CLIENT_SONG_CATALOG } from "../lib/search/clientCatalog";

export interface AutocompleteInputProps {
  onSelectSong: (song: CatalogSongItem) => void;
  disabled?: boolean;
  placeholder?: string;
  attemptNumber?: number;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  onSelectSong,
  disabled = false,
  placeholder = "Know it? Search for title, artist, or movie...",
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
    if (!isOpen || results.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Accessible Input Group */}
      <div className="relative flex items-center">
        {/* Search Icon */}
        <div className="absolute left-3.5 pointer-events-none text-slate-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
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
          className="w-full h-12 pl-11 pr-10 bg-slate-900/90 text-slate-100 placeholder-slate-400 rounded-xl border border-slate-700/80 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition-all outline-none text-sm font-sans shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label={`Search Indian song catalog for attempt ${attemptNumber}`}
        />

        {/* Clear query button */}
        {query && !disabled && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label="Clear search input"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Floating Dropdown Results */}
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl divide-y divide-slate-800/70"
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
                  className={`px-4 py-3 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left ${
                    isSelected
                      ? "bg-amber-500/20 text-white"
                      : "text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm truncate text-slate-100">
                      {song.title}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {song.artists?.join(", ") || "Unknown Artist"}
                      {song.movieOrAlbum ? ` • ${song.movieOrAlbum}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {song.language && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                        {song.language}
                      </span>
                    )}
                    {song.era && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {song.era}
                      </span>
                    )}
                  </div>
                </li>
              );
            })
          ) : (
            <li className="px-4 py-6 text-center text-sm text-slate-400">
              No matching Indian songs found for &ldquo;<span className="text-amber-300">{query}</span>&rdquo;
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

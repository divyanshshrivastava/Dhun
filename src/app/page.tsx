"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DhunAudioPlayer } from "../lib/audio/DhunAudioPlayer";
import { AudioPlayerCard } from "../components/AudioPlayerCard";
import { CUMULATIVE_DURATIONS } from "../components/VisualizerBar";
import { AutocompleteInput } from "../components/AutocompleteInput";
import { GuessHistory, GuessRecord } from "../components/GuessHistory";
import { GameOverModal, SolutionDetails } from "../components/modals/GameOverModal";
import { StatsModal, PlayerStatsData } from "../components/modals/StatsModal";
import { HelpModal } from "../components/modals/HelpModal";
import { PracticeModeSelector, PracticeFilters } from "../components/PracticeModeSelector";
import { CatalogSongItem } from "../lib/search/catalogSearch";
import { HelpCircle, BarChart2, Sun, Moon, Share2, ExternalLink, Clock, Headphones, Shuffle } from "lucide-react";

export default function DhunPage() {
  // Theme State
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("dhun_theme", nextTheme);
  };

  // Session & Player State
  const [guestId, setGuestId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [challengeDate, setChallengeDate] = useState<string>("");
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0);
  const [status, setStatus] = useState<"IN_PROGRESS" | "WON" | "LOST">("IN_PROGRESS");
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [solution, setSolution] = useState<SolutionDetails | undefined>(undefined);

  // Audio Player State
  const playerRef = useRef<DhunAudioPlayer | null>(null);
  const sessionTokenRef = useRef<string>("");
  const hasMountedRef = useRef<boolean>(false);
  const practiceFiltersRef = useRef<PracticeFilters>({});
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Modals
  const [isGameOverOpen, setIsGameOverOpen] = useState<boolean>(false);
  const [isStatsOpen, setIsStatsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [stats, setStats] = useState<PlayerStatsData>({
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDistribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
  });

  // Countdown timer to midnight IST (UTC+5:30)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nowUtcMs = now.getTime() + now.getTimezoneOffset() * 60000;
      const istMs = nowUtcMs + 5.5 * 3600000;
      const istDate = new Date(istMs);
      const nextMidnightIst = new Date(istDate);
      nextMidnightIst.setHours(24, 0, 0, 0);

      const diffMs = nextMidnightIst.getTime() - istDate.getTime();
      if (diffMs <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. Initialize Player and Guest ID on Mount
  useEffect(() => {
    // Generate or retrieve persistent guestId
    let localGuestId = localStorage.getItem("dhun_guest_id");
    if (!localGuestId) {
      localGuestId = crypto.randomUUID();
      localStorage.setItem("dhun_guest_id", localGuestId);
    }
    setGuestId(localGuestId);

    // Load cached stats from localStorage (server is source of truth, localStorage is cache)
    const cachedStats = localStorage.getItem("dhun_stats_cache");
    if (cachedStats) {
      try {
        setStats(JSON.parse(cachedStats));
      } catch {
        // ignore parse error
      }
    }

    // Initialize DhunAudioPlayer with Web Audio API
    const player = new DhunAudioPlayer({
      onStatusChange: (s) => {
        setIsPlaying(s === "playing");
        setIsLoadingAudio(s === "loading");
      },
      onEnded: () => {
        setIsPlaying(false);
        setCurrentTime(0);
      },
      onProgress: (_fraction, currentTimeMs) => {
        setCurrentTime(currentTimeMs / 1000);
      },
      onError: (errMsg: string) => setAudioError(errMsg),
    });
    playerRef.current = player;

    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, []);

  // Sync latest authoritative player stats from server
  const fetchStats = useCallback(async (gId: string) => {
    if (!gId) return;
    try {
      const res = await fetch(`/api/stats/${gId}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        localStorage.setItem("dhun_stats_cache", JSON.stringify(data));
      }
    } catch {
      // ignore network stats errors
    }
  }, []);

  // Mode & Filter State
  const [gameMode, setGameMode] = useState<"DAILY" | "PRACTICE">("DAILY");
  const [practiceFilters, setPracticeFilters] = useState<PracticeFilters>({});

  const updateSessionToken = (token: string, sId?: string) => {
    setSessionToken(token);
    sessionTokenRef.current = token;
    if (sId) {
      localStorage.setItem(`dhun_session_token_${sId}`, token);
    }
  };

  // 2. Start or Resume Game Session (Daily or Practice)
  const startSession = useCallback(
    async (mode: "DAILY" | "PRACTICE", customFilters?: PracticeFilters) => {
      if (!guestId) return;
      setGameMode(mode);
      setIsLoadingAudio(true);
      setAudioError(null);
      setIsGameOverOpen(false);
      setSolution(undefined);
      setGuesses([]);
      setAttemptsUsed(0);
      setStatus("IN_PROGRESS");
      setCurrentTime(0);

      try {
        const filtersToUse = mode === "PRACTICE" ? (customFilters ?? practiceFiltersRef.current) : undefined;
        const res = await fetch("/api/game/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestId,
            mode,
            filters: filtersToUse,
          }),
        });

        if (!res.ok) {
          throw new Error("Unable to create game session");
        }

        const data = await res.json();
        setSessionId(data.sessionId);

        // Cache and restore sessionToken for session persistence across reloads
        if (data.sessionToken) {
          updateSessionToken(data.sessionToken, data.sessionId);
        } else {
          const savedToken = localStorage.getItem(`dhun_session_token_${data.sessionId}`);
          if (savedToken) {
            updateSessionToken(savedToken, data.sessionId);
          }
        }

        setChallengeDate(data.challengeDate || "");
        setAttemptsUsed(data.attemptsUsed);
        setStatus(data.status);
        setGuesses(data.previousGuesses || []);

        const solutionPayload = data.solution || data.answer;
        if (solutionPayload) {
          setSolution(solutionPayload);
          // Only auto-open if the modal has not been closed by the user yet
          const dismissKey = `dhun_modal_closed_${data.challengeDate || data.sessionId}`;
          const alreadyDismissed = localStorage.getItem(dismissKey);
          if (!alreadyDismissed) {
            setIsGameOverOpen(true);
          } else {
            setIsGameOverOpen(false);
          }
        } else {
          setIsGameOverOpen(false);
        }

        // Configure player token refresh callback
        if (playerRef.current) {
          const sId = data.sessionId;
          playerRef.current.setTokenRefreshCallback(async (attemptIndex: number) => {
            const currentSavedToken =
              sessionTokenRef.current ||
              data.sessionToken ||
              localStorage.getItem(`dhun_session_token_${sId}`) ||
              "";
            const refreshRes = await fetch("/api/game/clip/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sId,
                sessionToken: currentSavedToken,
                attemptIndex,
              }),
            });
            if (!refreshRes.ok) {
              throw new Error("Failed to refresh audio stream token");
            }
            const refreshData = await refreshRes.json();
            return refreshData.clipStreamUrl;
          });
        }

        // Fetch and decode initial clip immediately upon URL arrival
        const activeClip = data.currentClip || data.nextClip;
        if (activeClip?.clipStreamUrl && playerRef.current) {
          const loaded = await playerRef.current.loadAndDecodeClip(
            activeClip.clipStreamUrl,
            activeClip.attemptIndex,
            activeClip.durationMs
          );
          if (loaded) {
            setAudioError(null);
          }
        }
      } catch (err: any) {
        setAudioError(err.message || "Failed to load game session");
      } finally {
        setIsLoadingAudio(false);
      }
    },
    [guestId]
  );

  // Initial load on mount once guestId is ready (runs only ONCE, never on mode switch)
  useEffect(() => {
    if (guestId && !hasMountedRef.current) {
      hasMountedRef.current = true;
      fetchStats(guestId);
      startSession("DAILY");
    }
  }, [guestId, fetchStats, startSession]);

  const handleSelectMode = (mode: "DAILY" | "PRACTICE") => {
    setGameMode(mode);
    startSession(mode, practiceFiltersRef.current);
  };

  const handleFilterChange = (newFilters: PracticeFilters) => {
    setPracticeFilters(newFilters);
    practiceFiltersRef.current = newFilters;
    if (gameMode === "PRACTICE") {
      startSession("PRACTICE", newFilters);
    }
  };

  const handleNewPracticeSong = () => {
    startSession("PRACTICE", practiceFiltersRef.current);
  };

  const handleCloseGameOver = () => {
    setIsGameOverOpen(false);
    const key = challengeDate || sessionId;
    if (key) {
      localStorage.setItem(`dhun_modal_closed_${key}`, "true");
    }
  };

  // Handle Play/Pause
  const handlePlayAudio = async () => {
    if (!playerRef.current) return;
    setAudioError(null);
    try {
      await playerRef.current.play();
    } catch (err: any) {
      setAudioError(err.message || "Audio playback error");
    }
  };

  const handlePauseAudio = () => {
    if (!playerRef.current) return;
    playerRef.current.pause();
    setIsPlaying(false);
  };

  // Refresh Audio Stream for current attempt
  const handleRefreshAudio = async () => {
    if (!sessionId || !playerRef.current) return;
    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const activeToken =
        sessionToken ||
        localStorage.getItem(`dhun_session_token_${sessionId}`) ||
        "";
      const res = await fetch("/api/game/clip/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken: activeToken,
          attemptIndex: attemptsUsed,
        }),
      });

      if (!res.ok) {
        throw new Error("Could not refresh audio token. Please try again.");
      }

      const data = await res.json();
      const loaded = await playerRef.current.loadAndDecodeClip(
        data.clipStreamUrl,
        data.attemptIndex,
        data.durationMs
      );
      if (loaded) {
        setAudioError(null);
      }
    } catch (err: any) {
      setAudioError(err.message || "Audio reload failed");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Submit a Guess
  const handleGuess = async (selectedSong: CatalogSongItem) => {
    if (!sessionId || status !== "IN_PROGRESS") return;
    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const activeToken =
        sessionToken ||
        sessionTokenRef.current ||
        localStorage.getItem(`dhun_session_token_${sessionId}`) ||
        "";
      const res = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken: activeToken,
          action: "GUESS",
          guessedSongId: selectedSong.id,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit guess");
      }

      const data = await res.json();
      setAttemptsUsed(data.attemptsUsed);
      setStatus(data.status);

      if (data.allGuesses) {
        setGuesses(data.allGuesses);
      } else if (data.previousGuesses) {
        setGuesses(data.previousGuesses);
      } else if (data.guessResult) {
        setGuesses((prev) => {
          const filtered = prev.filter((g) => g.attemptIndex !== data.guessResult.attemptIndex);
          return [...filtered, data.guessResult];
        });
      }

      const solutionPayload = data.solution || data.answer;
      if (solutionPayload) {
        setSolution(solutionPayload);
        setIsGameOverOpen(true);
        fetchStats(guestId);
      } else {
        const nextClip = data.nextClip || data.currentClip;
        if (nextClip && playerRef.current) {
          // Pre-fetch and decode next clip immediately
          await playerRef.current.loadAndDecodeClip(
            nextClip.clipStreamUrl,
            nextClip.attemptIndex,
            nextClip.durationMs
          );
        }
      }
    } catch (err: any) {
      setAudioError(err.message || "Error submitting guess");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Skip Attempt
  const handleSkip = async () => {
    if (!sessionId || status !== "IN_PROGRESS") return;
    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const activeToken =
        sessionToken ||
        sessionTokenRef.current ||
        localStorage.getItem(`dhun_session_token_${sessionId}`) ||
        "";
      const res = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken: activeToken,
          action: "SKIP",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to skip attempt");
      }

      const data = await res.json();
      setAttemptsUsed(data.attemptsUsed);
      setStatus(data.status);

      if (data.allGuesses) {
        setGuesses(data.allGuesses);
      } else if (data.previousGuesses) {
        setGuesses(data.previousGuesses);
      } else if (data.guessResult) {
        setGuesses((prev) => {
          const filtered = prev.filter((g) => g.attemptIndex !== data.guessResult.attemptIndex);
          return [...filtered, data.guessResult];
        });
      }

      const solutionPayload = data.solution || data.answer;
      if (solutionPayload) {
        setSolution(solutionPayload);
        setIsGameOverOpen(true);
        fetchStats(guestId);
      } else {
        const nextClip = data.nextClip || data.currentClip;
        if (nextClip && playerRef.current) {
          await playerRef.current.loadAndDecodeClip(
            nextClip.clipStreamUrl,
            nextClip.attemptIndex,
            nextClip.durationMs
          );
        }
      }
    } catch (err: any) {
      setAudioError(err.message || "Error skipping attempt");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Give Up / Surrender
  const handleGiveUp = async () => {
    if (!sessionId || status !== "IN_PROGRESS") return;
    if (!confirm("Are you sure you want to give up and reveal today's song?")) return;

    setIsLoadingAudio(true);
    try {
      const activeToken =
        sessionToken ||
        sessionTokenRef.current ||
        localStorage.getItem(`dhun_session_token_${sessionId}`) ||
        "";
      const res = await fetch("/api/game/give-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken: activeToken,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus(data.status);
        if (data.solution) {
          setSolution(data.solution);
          setIsGameOverOpen(true);
          fetchStats(guestId);
        }
      }
    } catch (err: any) {
      setAudioError(err.message || "Failed to give up");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const nextAttempt = attemptsUsed + 1;
  const nextSkipDuration =
    nextAttempt < CUMULATIVE_DURATIONS.length
      ? CUMULATIVE_DURATIONS[nextAttempt]
      : null;

  const [dayNumber, setDayNumber] = useState<number>(1);
  const [formattedDate, setFormattedDate] = useState<string>("");

  useEffect(() => {
    const base = new Date("2026-05-10").getTime();
    const cur = challengeDate ? new Date(challengeDate).getTime() : Date.now();
    setDayNumber(Math.max(1, Math.floor((cur - base) / 86400000)));

    const dateObj = challengeDate ? new Date(challengeDate) : new Date();
    setFormattedDate(
      dateObj.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  }, [challengeDate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-[var(--bg-page)] text-[var(--text-primary)] px-3 py-2.5 sm:px-4 sm:py-4 transition-colors duration-150 selection:bg-[#c5e31e]/30 selection:text-neutral-900 dark:selection:text-white">
      {/* Top Header Bar */}
      <header className="w-full max-w-md sm:max-w-lg flex items-center justify-between pb-2.5 border-b border-neutral-100 dark:border-neutral-850">
        {/* Left: Waveform Logo + Title */}
        <div className="flex items-center gap-2 select-none">
          {/* Waveform icon in lime-gold */}
          <div className="flex items-center gap-0.5 h-4 text-[#c5e31e] dark:text-[#d6f830]">
            <span className="w-1 h-2 rounded-full bg-current" />
            <span className="w-1 h-3.5 rounded-full bg-current" />
            <span className="w-1 h-4 rounded-full bg-current" />
            <span className="w-1 h-2.5 rounded-full bg-current" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">
              dhun
            </span>
            <span className="text-xs font-normal text-neutral-400 dark:text-neutral-500">
              धुन
            </span>
          </div>
        </div>

        {/* Right: Actions (Stats, Help, Theme Toggle) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsStatsOpen(true)}
            className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="View statistics"
            title="Statistics"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="How to play instructions"
            title="How to play"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-600" />
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md sm:max-w-lg flex flex-col items-center gap-3 py-1.5 flex-1">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center gap-1 select-none pt-0.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-500 dark:text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c5e31e] dark:bg-[#d6f830]" />
            <span>YOUR DAILY DOSE OF INDIAN MUSIC</span>
          </div>

          <h1 className="brand-type text-3xl sm:text-4xl tracking-tight text-neutral-900 dark:text-white">
            Find your{" "}
            <span className="relative inline-block">
              dhun.
              <span className="absolute left-0 right-0 -bottom-1 h-[3.5px] bg-[#c5e31e] dark:bg-[#d6f830] rounded-full" />
            </span>
          </h1>
        </div>

        {/* Mode Selector Segmented Pill */}
        <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-[#15171c] border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold shadow-xs">
          <button
            type="button"
            onClick={() => handleSelectMode("DAILY")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              gameMode === "DAILY"
                ? "bg-white dark:bg-[#222631] text-neutral-950 dark:text-white shadow-xs font-bold"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
            }`}
          >
            <span className="text-xs">♪</span>
            <span>Daily Dhun</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectMode("PRACTICE")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              gameMode === "PRACTICE"
                ? "bg-white dark:bg-[#222631] text-neutral-950 dark:text-white shadow-xs font-bold"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 font-medium"
            }`}
          >
            <span className="text-xs">🔀</span>
            <span>Practice</span>
          </button>
        </div>

        {/* Practice Mode Filter Panel (only visible when in PRACTICE mode) */}
        {gameMode === "PRACTICE" && (
          <div className="w-full">
            <PracticeModeSelector
              currentMode={gameMode}
              filters={practiceFilters}
              isLoading={isLoadingAudio}
              onSelectMode={handleSelectMode}
              onFilterChange={handleFilterChange}
              onNewPracticeSong={handleNewPracticeSong}
            />
          </div>
        )}

        {/* Sub-header Context Row: Daily # / Date and Sound On */}
        <div className="w-full flex items-center justify-between text-[11px] font-mono text-neutral-400 dark:text-neutral-500 px-1">
          <span className="uppercase tracking-wider">
            {gameMode === "DAILY"
              ? `DAILY #${dayNumber}${formattedDate ? `  /  ${formattedDate}` : ""}`
              : "UNLIMITED PRACTICE"}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Headphones className="w-3 h-3 text-[#9fba11] dark:text-[#d6f830]" />
              <span>Sound on</span>
            </span>
            {status === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={handleGiveUp}
                className="hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors text-[11px]"
                title="Give up and reveal the song"
              >
                • Give up?
              </button>
            )}
          </div>
        </div>

        {/* 1. Guesses On Top (Compact, no scroll) */}
        <div className="w-full">
          <GuessHistory
            guesses={guesses}
            attemptsUsed={attemptsUsed}
            maxAttempts={6}
            isGameOver={status !== "IN_PROGRESS"}
          />
        </div>

        {/* 2. Audio Player Card (Waveform + Play Button in Center + Timeline Line) */}
        <div className="w-full">
          <AudioPlayerCard
            currentAttempt={attemptsUsed}
            currentTime={currentTime}
            isPlaying={isPlaying}
            isLoading={isLoadingAudio}
            error={audioError}
            isWon={status === "WON"}
            isGameOver={status !== "IN_PROGRESS"}
            onPlay={handlePlayAudio}
            onPause={handlePauseAudio}
            onRefreshAudio={handleRefreshAudio}
          />
        </div>

        {/* 3. Attempt Progress Indicator (Attempt 1 of 6 + 6 Pips) */}
        <div className="w-full flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 px-1">
          <span className="font-semibold text-neutral-600 dark:text-neutral-300">
            Attempt {Math.min(attemptsUsed + 1, 6)} of 6
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => {
              const g = guesses.find((x) => x.attemptIndex === i);
              let pipClass = "bg-neutral-200 dark:bg-neutral-800";
              if (g?.isCorrect) pipClass = "bg-emerald-500";
              else if (g && g.action === "GUESS") pipClass = "bg-red-500";
              else if (g && g.action === "SKIP") pipClass = "bg-neutral-400 dark:bg-neutral-600";
              else if (i === attemptsUsed && status === "IN_PROGRESS")
                pipClass = "bg-[#c5e31e] dark:bg-[#d6f830]";

              return (
                <span
                  key={i}
                  className={`w-3.5 h-1.5 rounded-full transition-colors ${pipClass}`}
                />
              );
            })}
          </div>
        </div>

        {/* 4. Autocomplete Input with Unified Skip / Submit Button on the Right */}
        <div className="w-full">
          {status === "IN_PROGRESS" ? (
            <AutocompleteInput
              onSelectSong={handleGuess}
              onSkip={handleSkip}
              nextSkipDuration={nextSkipDuration}
              disabled={isLoadingAudio}
              attemptNumber={attemptsUsed + 1}
            />
          ) : (
            /* Finished Game Results Banner */
            <div className="w-full bg-white dark:bg-[#14161b] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm animate-guess-pop">
              {/* Header Status */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{status === "WON" ? "🎉" : "💔"}</span>
                  <div className="flex flex-col text-left">
                    <span
                      className={`text-xs font-bold tracking-wider uppercase ${
                        status === "WON"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      {status === "WON" ? "Shabaash! You Won!" : "Game Over"}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {status === "WON"
                        ? `Guessed in ${attemptsUsed} of 6 attempts`
                        : "You used all 6 attempts"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGameOverOpen(true)}
                  className="btn-tactile px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-[#1a1d24] dark:hover:bg-[#242934] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>

              {/* Revealed Song Card */}
              {solution && (
                <div className="w-full bg-neutral-50 dark:bg-[#0f1013] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex flex-col text-left gap-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#9fba11] dark:text-[#d6f830]">
                    {gameMode === "DAILY" ? "Today's Dhun" : "Practice Dhun"}
                  </span>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                    {solution.title}
                  </h3>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                    {solution.artists?.join(", ")}
                    {solution.movieOrAlbum ? ` • ${solution.movieOrAlbum}` : ""}
                  </p>

                  {/* External Streaming Links */}
                  <div className="flex items-center gap-2 pt-1.5">
                    <a
                      href={`https://open.spotify.com/search/${encodeURIComponent(
                        `${solution.title} ${solution.artists?.join(" ") || ""}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] dark:text-[#1ed760] border border-[#1DB954]/30 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>Spotify</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                        `${solution.title} ${solution.artists?.join(" ") || ""} song`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#FF0000]/10 hover:bg-[#FF0000]/20 text-rose-600 dark:text-rose-400 border border-[#FF0000]/30 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>YouTube</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Bottom Actions based on Mode */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-0.5">
                {gameMode === "DAILY" ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Next Dhun in:</span>
                      <span className="font-mono font-bold text-[#8fa70e] dark:text-[#d6f830]">
                        {timeLeft || "--:--:--"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectMode("PRACTICE")}
                      className="btn-tactile w-full sm:w-auto px-4 py-2 bg-[#c5e31e] hover:bg-[#b4d216] dark:bg-[#d6f830] dark:hover:bg-[#c2e424] text-neutral-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                    >
                      🎯 Play Unlimited Practice
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleNewPracticeSong}
                    disabled={isLoadingAudio}
                    className="btn-tactile w-full py-2 bg-[#c5e31e] hover:bg-[#b4d216] dark:bg-[#d6f830] dark:hover:bg-[#c2e424] text-neutral-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span>Play Another Practice Song 🎲</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. Phrase Underneath Submission Bar */}
        <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 italic pt-0.5">
          Trust your ears. The song is closer than you think.
        </p>
      </main>

      {/* 6. Bottom Micro-Copy / Footer */}
      <footer className="w-full max-w-md sm:max-w-lg pt-2 pb-1 border-t border-neutral-100 dark:border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#c5e31e] dark:bg-[#d6f830]" />
          <span>A fresh dhun every midnight, IST</span>
        </span>
        <button
          type="button"
          onClick={() => setIsGameOverOpen(true)}
          className="flex items-center gap-1 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <Share2 className="w-3 h-3" />
          <span>Share</span>
        </button>
      </footer>

      {/* Modals */}
      <GameOverModal
        isOpen={isGameOverOpen}
        isWon={status === "WON"}
        attemptsUsed={attemptsUsed}
        guesses={guesses}
        solution={solution}
        challengeDate={challengeDate}
        mode={gameMode}
        onPlayNextPractice={handleNewPracticeSong}
        onClose={handleCloseGameOver}
        onOpenStats={() => {
          setIsGameOverOpen(false);
          setIsStatsOpen(true);
        }}
      />

      <StatsModal
        isOpen={isStatsOpen}
        stats={stats}
        onClose={() => setIsStatsOpen(false)}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}

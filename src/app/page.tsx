"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { DhunAudioPlayer } from "../lib/audio/DhunAudioPlayer";
import { VisualizerBar } from "../components/VisualizerBar";
import { AutocompleteInput } from "../components/AutocompleteInput";
import { GuessHistory, GuessRecord } from "../components/GuessHistory";
import { AudioControls } from "../components/AudioControls";
import { GameOverModal, SolutionDetails } from "../components/modals/GameOverModal";
import { StatsModal, PlayerStatsData } from "../components/modals/StatsModal";
import { HelpModal } from "../components/modals/HelpModal";
import { PracticeModeSelector, PracticeFilters } from "../components/PracticeModeSelector";
import { CatalogSongItem } from "../lib/search/catalogSearch";

export default function DhunPage() {
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-[#080c14] text-slate-100 p-4 sm:p-6 selection:bg-amber-500/30">
      {/* Top Navigation Bar */}
      <header className="w-full max-w-lg flex items-center justify-between pb-4 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className="w-9 h-9 rounded-full bg-slate-800/70 hover:bg-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          aria-label="How to play instructions"
        >
          ?
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪕</span>
            <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">
              DHUN <span className="text-lg font-normal text-slate-400">धुन</span>
            </h1>
          </div>
          <span className="text-[11px] font-mono text-slate-500 tracking-wide">
            DAILY INDIAN MUSIC CHALLENGE
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsStatsOpen(true)}
          className="w-9 h-9 rounded-full bg-slate-800/70 hover:bg-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          aria-label="View statistics"
        >
          📊
        </button>
      </header>

      {/* Practice / Daily Mode Selector */}
      <div className="w-full max-w-lg pt-3">
        <PracticeModeSelector
          currentMode={gameMode}
          filters={practiceFilters}
          isLoading={isLoadingAudio}
          onSelectMode={handleSelectMode}
          onFilterChange={handleFilterChange}
          onNewPracticeSong={handleNewPracticeSong}
        />
      </div>

      {/* Main Game Interface Container */}
      <main className="w-full max-w-lg flex-1 flex flex-col items-center justify-between py-4 gap-4">
        {/* Attempt History List */}
        <div className="w-full">
          <GuessHistory
            guesses={guesses}
            attemptsUsed={attemptsUsed}
            maxAttempts={6}
            isGameOver={status !== "IN_PROGRESS"}
          />
        </div>

        {/* Audio Visualizer & Timeline */}
        <div className="w-full">
          <VisualizerBar
            currentAttempt={attemptsUsed}
            currentTime={currentTime}
            isPlaying={isPlaying}
            isWon={status === "WON"}
            isGameOver={status !== "IN_PROGRESS"}
          />
        </div>

        {/* Audio Controls */}
        <div className="w-full">
          <AudioControls
            isPlaying={isPlaying}
            isLoading={isLoadingAudio}
            error={audioError}
            currentTime={currentTime}
            currentAttempt={attemptsUsed}
            isGameOver={status !== "IN_PROGRESS"}
            onPlay={handlePlayAudio}
            onPause={handlePauseAudio}
            onSkip={handleSkip}
            onRefreshAudio={handleRefreshAudio}
            onGiveUp={handleGiveUp}
          />
        </div>

        {/* Autocomplete Input or Finished Banner */}
        <div className="w-full pt-1">
          {status === "IN_PROGRESS" ? (
            <AutocompleteInput
              onSelectSong={handleGuess}
              disabled={isLoadingAudio}
              attemptNumber={attemptsUsed + 1}
            />
          ) : (
            <div className="w-full bg-slate-900/95 border border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md animate-guess-pop">
              {/* Header Status */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{status === "WON" ? "🎉" : "💔"}</span>
                  <div className="flex flex-col text-left">
                    <span
                      className={`text-xs font-mono font-bold tracking-wider uppercase ${
                        status === "WON" ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {status === "WON" ? "Shabaash! You Won!" : "Game Over"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {status === "WON"
                        ? `Guessed in ${attemptsUsed} of 6 attempts`
                        : "You used all 6 attempts"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGameOverOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>📋</span>
                  <span>Share</span>
                </button>
              </div>

              {/* Revealed Song Card */}
              {solution && (
                <div className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col text-left gap-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-amber-500/90 font-semibold">
                    {gameMode === "DAILY" ? "Today's Song" : "Practice Song"}
                  </span>
                  <h3 className="text-base font-bold text-white truncate">
                    {solution.title}
                  </h3>
                  <p className="text-xs text-slate-300 truncate">
                    {solution.artists?.join(", ")}
                    {solution.movieOrAlbum ? ` • ${solution.movieOrAlbum}` : ""}
                  </p>

                  {/* Quick external streaming links */}
                  <div className="flex items-center gap-2 pt-2">
                    <a
                      href={`https://open.spotify.com/search/${encodeURIComponent(
                        `${solution.title} ${solution.artists?.join(" ") || ""}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#1DB954]/15 hover:bg-[#1DB954]/25 text-[#1DB954] border border-[#1DB954]/40 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>Spotify</span> ↗
                    </a>
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                        `${solution.title} ${solution.artists?.join(" ") || ""} song`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-[#FF0000]/15 hover:bg-[#FF0000]/25 text-rose-400 border border-rose-500/40 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <span>YouTube</span> ↗
                    </a>
                  </div>
                </div>
              )}

              {/* Bottom Actions based on Mode */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                {gameMode === "DAILY" ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Next Daily Dhun:</span>
                      <span className="font-mono font-bold text-amber-400">{timeLeft || "--:--:--"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectMode("PRACTICE")}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition-transform active:scale-95 cursor-pointer shadow-md"
                    >
                      🎯 Play Unlimited Practice
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleNewPracticeSong}
                    disabled={isLoadingAudio}
                    className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl transition-transform active:scale-95 cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span>🎲</span>
                    <span>Play Another Practice Song</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-lg pt-2 text-center text-[11px] text-slate-600 font-mono">
        Dhun • Made with ❤️ for Indian Music
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

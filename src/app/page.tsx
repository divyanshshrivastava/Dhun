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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);

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

  // 2. Fetch or Resume Daily Game Session
  useEffect(() => {
    if (!guestId) return;

    fetchStats(guestId);

    const initSession = async () => {
      setIsLoadingAudio(true);
      try {
        const res = await fetch("/api/game/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId, mode: "DAILY" }),
        });

        if (!res.ok) {
          throw new Error("Unable to create game session");
        }

        const data = await res.json();
        setSessionId(data.sessionId);
        
        // Cache and restore sessionToken for session persistence across reloads
        if (data.sessionToken) {
          setSessionToken(data.sessionToken);
          localStorage.setItem(`dhun_session_token_${data.sessionId}`, data.sessionToken);
        } else {
          const savedToken = localStorage.getItem(`dhun_session_token_${data.sessionId}`);
          if (savedToken) {
            setSessionToken(savedToken);
          }
        }

        setChallengeDate(data.challengeDate || "");
        setAttemptsUsed(data.attemptsUsed);
        setStatus(data.status);
        setGuesses(data.previousGuesses || []);

        const solutionPayload = data.solution || data.answer;
        if (solutionPayload) {
          setSolution(solutionPayload);
          setIsGameOverOpen(true);
        }

        // Configure player token refresh callback
        if (playerRef.current) {
          const sId = data.sessionId;
          playerRef.current.setTokenRefreshCallback(async (attemptIndex: number) => {
            const currentSavedToken =
              sessionToken ||
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
          await playerRef.current.loadAndDecodeClip(
            activeClip.clipStreamUrl,
            activeClip.attemptIndex,
            activeClip.durationMs
          );
          setAudioError(null);
        }
      } catch (err: any) {
        setAudioError(err.message || "Failed to load game session");
      } finally {
        setIsLoadingAudio(false);
      }
    };

    initSession();
  }, [guestId, fetchStats, sessionToken]);

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
      const res = await fetch("/api/game/clip/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken,
          attemptIndex: attemptsUsed,
        }),
      });

      if (!res.ok) {
        throw new Error("Could not refresh audio token. Please try again.");
      }

      const data = await res.json();
      await playerRef.current.loadAndDecodeClip(data.clipStreamUrl, data.attemptIndex);
      setAudioError(null);
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
      const res = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken,
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
      const res = await fetch("/api/game/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken,
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
      const res = await fetch("/api/game/give-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sessionToken,
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
            <div className="w-full p-4 bg-slate-900/90 border border-slate-700 rounded-xl flex items-center justify-between shadow-lg">
              <div className="flex flex-col text-left">
                <span className="text-xs uppercase font-mono text-amber-400 font-bold">
                  {status === "WON" ? "Solved!" : "Game Over"}
                </span>
                <span className="text-sm font-semibold text-white">
                  {solution?.title || "Daily Dhun Complete"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsGameOverOpen(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-transform active:scale-95 cursor-pointer"
              >
                View Summary
              </button>
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
        onClose={() => setIsGameOverOpen(false)}
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

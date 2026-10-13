# Dhun (धुन)

A Heardle-style daily music guessing game built specifically for Indian music. Players identify songs across Bollywood, regional cinema (Tamil, Telugu, Punjabi, Malayalam, Kannada, Bengali, Marathi, Gujarati), Indian Indie, and Ghazals from progressively longer intro slices.

## Game Mechanics
- **6 Attempts, Cumulative Slices:** Slices start at the very beginning of the track and expand: `0.1s` → `0.5s` → `1.5s` → `4s` → `8s` → `15s`.
- **Daily Challenge:** A synchronized song of the day resets at midnight IST (`Asia/Kolkata`) with Wordle-style shareable emoji result grids.
- **Practice Mode:** On-demand play with language, genre, and era filters.
- **Canonical Remake Equivalence:** Canonical work matching ensures remakes, reprisals, and multi-era recordings (e.g., *Dilbar 1999* vs *2018*, *Humma Humma* vs *The Humma Song*) count as correct answers.

## Architecture & Engineering

### 1. Zero-Leak Anti-Cheat & Streaming Pipeline
- **Strict Server Authority:** Song titles, recording IDs, and answer metadata never reach client state or network payloads until a terminal game state (`WON` or `LOST`).
- **Bound HMAC Clip Tokens:** Audio streams are authorized via short-lived (60s) HMAC-SHA256 tokens bound to `(sessionId, attemptIndex)`. Requests for future attempts are rejected (`403 Forbidden`). Tokens are verified in constant time (`crypto.timingSafeEqual`) with `Cache-Control: private, no-store`.
- **Per-Session Concurrency Locks:** Guess submissions and state transitions are serialized via per-session mutex locks to prevent race conditions on rapid concurrent inputs.

### 2. Audio Pipeline & Timing Integrity
- **Two-Pass Linear Loudnorm:** Masters undergo two-pass EBU R128 normalization (`-16 LUFS`) with `linear=true` applied statically. This prevents dynamic AGC compressor pumping, ensuring the `0.1s` slice accurately reflects master volume.
- **Hybrid Format Slicing:**
  - `0.1s`, `0.5s`, `1.5s`: Lossless PCM WAV (44.1kHz 16-bit stereo) with 0ms container priming delay, eliminating playback start stutter on mobile Safari.
  - `4s`, `8s`, `15s`: AAC-LC (`.m4a`) with stripped ID3 tags for bandwidth efficiency.
- **Pluggable Audio Source Provider:** Master audio ingest abstraction supporting local high-fidelity masters, Apple Music previews, and offline synthetic tone generation.

### 3. Client-Side Search & Phonetic Matching
- **Local In-Memory Index:** Full catalog search runs client-side with `<0.5ms` response time, eliminating roundtrip latency during autocomplete.
- **Hinglish Phonetic Transliteration:** Handles diverse spellings, vowel reductions (e.g., `aa` ↔ `a`), consonant substitutions (`ph` ↔ `f`, `kh` ↔ `k`), and multi-word acronym matching (`khnh` → *Kal Ho Naa Ho*).

## Tech Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Database / ORM:** PostgreSQL with Drizzle ORM
- **Audio Processing:** FFmpeg (linear EBU R128, frame-accurate slicing)
- **Validation & Security:** Zod, Node `crypto` HMAC-SHA256
- **Test Suite:** Vitest (unit, API integration, and anti-cheat leak verification)

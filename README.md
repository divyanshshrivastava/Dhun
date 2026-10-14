# Dhun (धुन)

A Heardle-style daily music guessing game built specifically for Indian music. Players identify songs across Bollywood, regional cinema (Tamil, Telugu, Punjabi, Malayalam, Kannada, Bengali, Marathi, Gujarati), Indian Indie, and Ghazals from progressively longer intro slices.

---

## Game Mechanics
- **6 Attempts, Cumulative Slices:** Slices start at the very beginning of the track and expand: `0.1s` → `0.5s` → `1.5s` → `4s` → `8s` → `15s`.
- **Daily Challenge:** A synchronized song of the day resets at midnight IST (`Asia/Kolkata`) with Wordle-style shareable emoji result grids.
- **Practice Mode:** Unlimited on-demand play with regional language, genre, and era filters.
- **Canonical Remake Equivalence:** Canonical work matching ensures remakes, reprisals, and multi-era recordings (e.g., *Dilbar 1999* vs *2018*, *Humma Humma* vs *The Humma Song*) count as correct answers.

---

## Zero-Cost Free Tier Architecture & Resource Caps

Dhun is engineered to run at **$0 monthly operating cost** by staying strictly within the permanent free tiers of modern cloud providers.

| Service | Free Plan Limit | Dhun Optimization & Protection | Dashboard URL |
| :--- | :--- | :--- | :--- |
| **Vercel Hobby** | 100k invocations/mo, 100 GB bandwidth | Autocomplete catalog served as static Edge CDN asset (`/catalog.json`), zero serverless invocations for searching. Images set to `unoptimized: true` to bypass paid optimization. | `vercel.com/dashboard/usage` |
| **Neon Postgres** | 0.5 GB storage, 1 compute branch | Connection pooling with generous 15s timeout and automatic 1-retry on cold-start wake-up. Automated 30-day data retention cleanup (`/api/cron/cleanup`) prunes historical sessions to prevent storage growth. | `console.neon.tech/app/projects` |
| **Upstash Redis** | 500k commands/mo | Ultra-low command footprint: single-pipeline HTTP REST (`INCR` + `EXPIRE NX`). Applied strictly to `/session` and `/guess`. Fails over automatically to in-memory fallback if quota is exhausted. | `console.upstash.com` |
| **Cloudflare R2** | 10 GB storage, 1M Class A, 10M Class B, $0 egress | Audio slices are generated once and stored under opaque hash keys. Zero egress fees regardless of listener volume. | `dash.cloudflare.com` -> R2 |
| **Supabase Storage** | 1 GB storage, 2 GB bandwidth/mo | Drop-in zero-code fallback behind `ClipStorage` interface if Cloudflare credit card verification is skipped. | `app.supabase.com` |

---

## Engineering Specifications

### 1. Zero-Leak Anti-Cheat & Streaming Pipeline
- **Strict Server Authority:** Song titles, recording IDs, and answer metadata never reach client state or network payloads until a terminal game state (`WON` or `LOST`).
- **Bound HMAC Clip Tokens:** Audio streams are authorized via short-lived (60s) HMAC-SHA256 tokens bound to `(sessionId, attemptIndex)`. Requests for future attempts are rejected (`403 Forbidden`). Tokens are verified in constant time (`crypto.timingSafeEqual`) with `Cache-Control: private, no-store`.
- **Database Row Locking:** Guess submissions and state transitions use atomic SQL row updates with row-count checks to prevent race conditions on concurrent inputs.

### 2. Audio Pipeline & Timing Integrity
- **Two-Pass Linear Loudnorm:** Masters undergo two-pass EBU R128 normalization (`-16 LUFS`) with `linear=true` applied statically. This prevents dynamic AGC compressor pumping, ensuring the `0.1s` slice accurately reflects master volume.
- **Hybrid Format Slicing:**
  - `0.1s`, `0.5s`, `1.5s`: Lossless PCM WAV (44.1kHz 16-bit stereo) with 0ms container priming delay, eliminating playback start stutter on mobile Safari.
  - `4s`, `8s`, `15s`: AAC-LC (`.m4a`) with stripped ID3 tags for bandwidth efficiency.
- **Pluggable Audio Source Provider:** Master audio ingest abstraction supporting local high-fidelity masters, Apple Music previews, and offline synthetic tone generation.

### 3. Client-Side Search & Phonetic Matching
- **Local In-Memory Index:** Full catalog search runs client-side with `<0.5ms` response time, eliminating roundtrip latency during autocomplete.
- **Hinglish Phonetic Transliteration:** Handles diverse spellings, vowel reductions (e.g., `aa` ↔ `a`), consonant substitutions (`ph` ↔ `f`, `kh` ↔ `k`), and multi-word acronym matching (`khnh` → *Kal Ho Naa Ho*).

---

## Content Ingestion Pipeline

Dhun includes a high-fidelity audio pipeline that normalizes full-length audio tracks and uploads 6 cumulative slices per song (`0.1s` → `15s`).

### 1. Master Audio Placement (`audio-masters/`)
- Directory path: `./audio-masters/` (workspace root, automatically `.gitignore`d).
- **Supported Formats:** `.wav`, `.mp3`, `.m4a`, `.flac`, `.aac`.
- **Minimum Duration:** Audio masters must be at least `16 seconds` long so all 6 slices (`0.1s`, `0.5s`, `1.5s`, `4.0s`, `8.0s`, `15.0s`) can be extracted from the opening intro.
- **Naming Convention:** Name the audio file matching either the exact song title, catalog ID, or any known alias (e.g. `Tum Hi Ho.mp3`, `Chaiyya Chaiyya.wav`, `kal-ho-naa-ho.mp3`).

### 2. Ingestion Commands
- **Batch Masters Ingestion:**
  ```bash
  npm run ingest:masters
  ```
  Scans `audio-masters/`, matches titles against the catalog, applies two-pass linear EBU R128 loudness normalization (`-16 LUFS`), cuts 6 cumulative slices, uploads to storage, and activates the song.
- **Catalog Coverage Report:**
  ```bash
  npm run catalog:report
  ```
  Outputs the total song count, percentage of songs with all 6 clips active, and a tabular audit of songs still requiring audio masters.

---

## Maintenance & CLI Commands

```bash
# Ingest single song or batch from audio-masters/
npm run ingest -- --title "Tum Hi Ho"
npm run ingest:masters

# Audit catalog clip coverage
npm run catalog:report

# Generate public/catalog.json for Edge CDN
npm run catalog:generate

# Prune completed game sessions older than 30 days (Neon free quota safety)
npm run db:cleanup

# Run unit and API integration tests (Vitest)
npm test

# Run cross-browser end-to-end tests (Playwright)
npm run test:e2e
```

---

## Cross-Browser & Real-Device Testing Matrix

Dhun is verified with automated Playwright end-to-end tests across Chromium and WebKit engines, as well as a real-device test checklist.

### Automated E2E Suite (Playwright)
```bash
npm run test:e2e
```
Runs 16 automated tests across 4 browser configurations:
1. **Desktop Chrome** (1280x720)
2. **Mobile Chrome** (Pixel 5 emulation, 393x851)
3. **Mobile Safari** (iPhone 12 emulation, 390x844, WebKit)
4. **Desktop WebKit** (macOS/Safari rendering engine, 1280x720)

### Real-Device Testing Checklist
When testing on physical smartphones and tablets, verify:
- **iOS Safari (iPhone):**
  - Web Audio Context initializes on the first tap of the Play button (respecting iOS user gesture autoplay restrictions).
  - Audio plays properly even if the physical iPhone Mute/Silent hardware switch is engaged.
  - Safe-area bottom navigation bar padding (`env(safe-area-inset-bottom)`) does not overlap audio playhead controls or modal action buttons.
- **Android Chrome (Samsung/Pixel):**
  - Autocomplete dropdown renders smoothly without virtual keyboard layout thrashing or viewport jumping.
  - Touch targets for the 6 visualizer segments, Skip button, and Play button are at least 48x48px.
  - Haptic feedback or audio finish triggers the `onended` playhead reset reliably.
- **Desktop Firefox / Safari / Chrome:**
  - High DPI retina displays render SVG icons, visualizer bars, and borders cleanly.
  - Keyboard navigation (Tab, Enter to submit guess, Space to play/pause) operates correctly.

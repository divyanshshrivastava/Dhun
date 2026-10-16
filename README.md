# Dhun (धुन)

> **The Daily Indian Music Guessing Game**  
> Play live at: **[dhun](https://dhun-psi.vercel.app/)**

Dhun (धुन) is a Heardle-style audio guessing game built specifically for Indian music. Players identify songs across Bollywood, regional cinema (Tamil, Telugu, Punjabi, Malayalam, Kannada, Bengali, Marathi, Gujarati), Indian Indie, and Ghazals from progressively longer intro slices.

---

## How It Works

### 1. Cumulative Audio Progression
- Players begin with a **0.1-second** slice of the track's intro.
- Each incorrect guess or skip unlocks progressively longer audio:
  $$\text{0.1s} \longrightarrow \text{0.5s} \longrightarrow \text{1.5s} \longrightarrow \text{4.0s} \longrightarrow \text{8.0s} \longrightarrow \text{15.0s}$$
- Slices always play cumulatively from time `0:00`, letting players hear the rhythm, instrumentation, and vocals develop naturally.

### 2. Daily Challenge & Global Reset
- A synchronized song of the day shared by all players worldwide.
- Resets every midnight Indian Standard Time (**00:00 IST / Asia/Kolkata**).
- Completing the challenge generates a spoiler-free, Wordle-style emoji grid (e.g., `🟩⬛⬛⬛⬛⬛`) ready to share with friends.

### 3. Practice Mode
- On-demand, unlimited gameplay.
- Filter the song pool by **Language** (Hindi, Tamil, Telugu, Punjabi, Malayalam, Kannada, Bengali, Marathi, Gujarati), **Era** (1970s through 2020s), or **Genre** (Bollywood, Romantic, Sufi, Classical, Indie).

### 4. Canonical Remake Equivalence
- Indian music has a rich history of reprises, recreations, and remakes across eras (e.g., *Dilbar* 1999 vs. 2018, *Humma Humma* vs. *The Humma Song*).
- Dhun groups versions under a shared **Canonical Work ID**. Guessing either the original or the modern remake counts as a correct match.

---

## How It's Made

Dhun is built with a server-authoritative architecture engineered to run at **$0 monthly operating cost** within permanent cloud free tiers while delivering sub-second response times and zero client leaks.

### 1. Core Stack
- **Framework:** Next.js (App Router), React 19, TypeScript
- **Styling:** Custom CSS design system with HSL color tokens, glassmorphic dark surfaces, and responsive micro-animations
- **Database & ORM:** PostgreSQL on Neon Serverless with connection pooling, orchestrated via Drizzle ORM
- **Audio Playback:** Native Web Audio API (`AudioContext`) with precise scheduling and custom playhead visualizers
- **Rate Limiting:** Upstash Serverless Redis via single-pipeline REST with automatic in-memory sliding-window failover
- **Object Storage:** Cloudflare R2 (S3-compatible, zero egress fees) with drop-in Supabase Storage support

---

## Architecture & Engineering Highlights

```
                       ┌─────────────────────────┐
                       │       Client App        │
                       │ (React 19 / Next.js UI) │
                       └────────────┬────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
     [Static Search]       [Game API Routes]          [Clip Stream]
           │                        │                        │
           ▼                        ▼                        ▼
 ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
 │   Edge CDN Cache  │    │   Next.js Server  │    │ 60s HMAC Token API│
 │   /catalog.json   │    │  (State Machine)  │    │  (Constant-Time)  │
 └───────────────────┘    └─────────┬─────────┘    └─────────┬─────────┘
                                    │                        │
                         ┌──────────┴──────────┐             ▼
                         ▼                     ▼    ┌───────────────────┐
                  ┌─────────────┐       ┌───────────┐│ Cloudflare R2 /   │
                  │ Neon DB     │       │ Upstash   ││ Supabase Storage  │
                  │ (Postgres)  │       │ (Redis)   │└───────────────────┘
                  └─────────────┘       └───────────┘
```

### Zero-Leak Anti-Cheat Security
- **Server-Authoritative State:** Song titles, artist metadata, and solutions are never delivered to the browser until the game reaches a terminal state (`WON` or `LOST`).
- **Bound Single-Attempt HMAC Tokens:** Audio playback uses short-lived (60s) HMAC-SHA256 tokens bound strictly to `(sessionId, attemptIndex)`. Requests for future attempts are rejected with `403 Forbidden`, and tokens are validated in constant time (`crypto.timingSafeEqual`) with `Cache-Control: private, no-store`.
- **Database Row Locking:** Guess submissions use atomic SQL updates with row-count checks to prevent race conditions from concurrent duplicate submissions.

### Audio Pipeline & Timing Integrity
- **Two-Pass Linear Loudnorm:** Source audio undergoes two-pass EBU R128 loudness normalization (`-16 LUFS`) with `linear=true` applied statically. This eliminates dynamic automatic gain control (AGC) pumping, ensuring the 0.1s clip accurately reflects the master's volume.
- **Hybrid Slice Encoding:**
  - `0.1s`, `0.5s`, `1.5s`: Lossless PCM WAV (44.1kHz 16-bit stereo) with 0ms container priming delay, eliminating audio start stutter on iOS Safari.
  - `4.0s`, `8.0s`, `15.0s`: High-efficiency AAC-LC (`.m4a`) with stripped metadata tags for fast mobile streaming.

### Client-Side Autocomplete & Hinglish Matching
- **Zero Serverless Search Invocations:** The catalog index (`catalog.json`) is served as an immutable, pre-rendered static asset cached at the Edge CDN.
- **Instant Response (<0.5ms):** Searches execute entirely in-memory in the browser.
- **Phonetic Normalization:** Handles phonetic spelling variations, vowel reductions (e.g. *aa* ↔ *a*), consonant interchanges (*ph* ↔ *f*, *kh* ↔ *k*), and multi-word acronym matching (e.g. `khnh` matches *Kal Ho Naa Ho*).

### High-Availability Rate Limiting
- Upstash Redis enforces rate limits using a single REST pipeline command (`INCR` + `EXPIRE NX`), minimizing quota consumption.
- If Upstash encounters network errors or reaches free-tier quotas, the system fails open with an in-memory sliding-window fallback, ensuring players are never blocked.

### Automated Retention Cleanup
- Historical completed sessions older than 30 days are automatically pruned via a daily maintenance endpoint protected by constant-time secret verification, keeping database storage well within Neon's free tier.

---

## Cross-Browser Compatibility

Dhun is verified across desktop and mobile browsers:
- **Mobile Safari (iOS):** AudioContext unlocks on initial touch gesture; handles physical mute switch states.
- **Android Chrome:** Touch-optimized 48px hit targets, smooth virtual keyboard handling, and responsive autocomplete.
- **Desktop (Chrome, Safari, Firefox, Edge):** Full keyboard navigation (Space to play/pause, Enter to submit) and retina-ready SVG visualizations.

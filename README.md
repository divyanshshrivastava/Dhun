# Dhun (धुन)

A Heardle-style daily music guessing game built specifically for Indian music. Players identify songs across Bollywood, regional cinema (Tamil, Telugu, Punjabi, Malayalam, Kannada, Bengali, Marathi, Gujarati), Indian Indie, and Ghazals from progressively longer intro slices.

---

## Game Mechanics
- **6 Attempts, Cumulative Slices:** Slices start at the very beginning of the track and expand: `0.1s` → `0.5s` → `1.5s` → `4s` → `8s` → `15s`.
- **Daily Challenge:** A synchronized song of the day resets at midnight IST (`Asia/Kolkata`) with Wordle-style shareable emoji result grids.
- **Practice Mode:** Unlimited on-demand play with regional language, genre, and era filters.
- **Canonical Remake Equivalence:** Canonical work matching ensures remakes, reprisals, and multi-era recordings (e.g., *Dilbar 1999* vs *2018*, *Humma Humma* vs *The Humma Song*) count as correct answers.

---

## Zero-Cost Free Tier Architecture & Dashboard Watch Guide

Dhun is engineered to run at **$0 monthly operating cost** by staying strictly within the permanent free tiers of modern cloud providers.

| Service | Free Plan Limit | Dhun Optimization & Protection | Dashboard URL |
| :--- | :--- | :--- | :--- |
| **Vercel Hobby** | 100k invocations/mo, 100 GB bandwidth | Autocomplete catalog served as static Edge CDN asset (`/catalog.json`), zero serverless invocations for searching. Images set to `unoptimized: true` to bypass paid optimization. | `vercel.com/dashboard/usage` |
| **Neon Postgres** | 0.5 GB storage, 1 compute branch | Connection pooling with generous 15s timeout and automatic 1-retry on cold-start wake-up. Automated 30-day data retention cleanup (`/api/cron/cleanup`) prunes historical sessions to prevent storage growth. | `console.neon.tech/app/projects` |
| **Upstash Redis** | 500k commands/mo | Ultra-low command footprint: single-pipeline HTTP REST (`INCR` + `EXPIRE NX`). Applied strictly to `/session` and `/guess`. Skipped on `/clip` (already protected by signed HMAC tokens). | `console.upstash.com` |
| **Cloudflare R2** | 10 GB storage, 1M Class A, 10M Class B, $0 egress | Audio slices are generated once and stored under opaque hash keys. Zero egress fees regardless of listener volume. | `dash.cloudflare.com` -> R2 |
| **Supabase Storage** | 1 GB storage, 2 GB bandwidth/mo | Drop-in zero-code fallback behind `ClipStorage` interface if Cloudflare credit card verification is skipped. | `app.supabase.com` |

---

## Deployment Guide (Step-by-Step)

### 1. Database Setup (Neon Free Tier)
1. Sign up at [Neon](https://neon.tech) and create a project named `dhun-db`.
2. In the Neon Console dashboard, copy the **Pooled connection string** (ends with `-pooler` in host, includes `?sslmode=require`).
3. Set `DATABASE_URL` in your environment variables.
4. Run migrations and seed the catalog:
   ```bash
   npx drizzle-kit push
   npm run db:seed
   ```

### 2. Rate Limiter Setup (Upstash Redis Free Tier)
1. Sign up at [Upstash](https://upstash.com) and create a serverless Redis database in your nearest region (e.g., `ap-south-1` Mumbai).
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the Upstash REST API credentials section.

### 3. Audio Storage Setup (Cloudflare R2 or Supabase Fallback)
#### Option A: Cloudflare R2 (Recommended)
1. Sign up at [Cloudflare](https://dash.cloudflare.com) and navigate to **R2**.
2. Create a bucket named `dhun-audio-clips`.
3. In **Manage R2 API Tokens**, create a token with `Admin Read & Write` permissions.
4. Copy `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.

#### Option B: Supabase Storage (Fallback without card)
1. Create a project at [Supabase](https://supabase.com).
2. Create a storage bucket named `dhun-audio-clips`.
3. Set `SUPABASE_STORAGE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### 4. Vercel Hobby Deployment
1. Import your Git repository into [Vercel](https://vercel.com).
2. Add the environment variables from your `.env.example` in the Vercel Project Settings:
   - `DATABASE_URL`
   - `DHUN_SERVER_SECRET` (generate with `openssl rand -hex 32`)
   - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL`
3. Click **Deploy**. Vercel will build the static CDN catalog and deploy edge routes with zero cost.

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

## Maintenance & CLI Commands

```bash
# Ingest songs and upload slices to storage (-16 LUFS normalized)
npm run ingest -- --title "Tum Hi Ho"
npm run ingest -- --all --limit 20

# Generate public/catalog.json for Edge CDN
npm run catalog:generate

# Prune completed game sessions older than 30 days (Neon free quota safety)
npm run db:cleanup

# Run test suites
npm run test       # Unit and API integration tests (Vitest)
npm run test:e2e   # Playwright end-to-end full playthrough tests
```

// Daily Challenge resolver for Dhun
// Manages the daily song selection tied to calendar date in IST (Asia/Kolkata)
// Provides deterministic fallback so a challenge song ALWAYS exists even before manual curation

import crypto from 'crypto';
import { getCurrentIstDateString } from '../lib/istDate';
import { CatalogSongItem } from '../lib/search/catalogSearch';

// Computes a deterministic integer index from the date string and server secret salt
export function computeDailyFallbackIndex(
  dateString: string,
  totalAvailableSongs: number,
  serverSecret = process.env.DHUN_SERVER_SECRET || 'dhun_server_secret_fallback_salt_2026'
): number {
  if (totalAvailableSongs <= 0) return 0;
  const hash = crypto
    .createHmac('sha256', serverSecret)
    .update(`dhun_daily_seed_salt_${dateString}`)
    .digest('hex');

  // Use the first 8 hex characters as a 32-bit unsigned integer
  const num = parseInt(hash.substring(0, 8), 16);
  return num % totalAvailableSongs;
}

// Selects today's song: checks manual daily challenge override or uses deterministic fallback
export function resolveDailySong(
  challengeDateString: string,
  catalog: CatalogSongItem[],
  explicitDbSongId?: string
): CatalogSongItem {
  if (!catalog || catalog.length === 0) {
    throw new Error('Cannot resolve daily challenge: song catalog is empty');
  }

  // 1. If explicitly scheduled in the database, use that song
  if (explicitDbSongId) {
    const matched = catalog.find(s => s.id === explicitDbSongId);
    if (matched) return matched;
  }

  // 2. Deterministic calendar fallback
  const fallbackIndex = computeDailyFallbackIndex(challengeDateString, catalog.length);
  return catalog[fallbackIndex];
}

// Helper to get today's active challenge date string in IST
export function getTodayChallengeDate(): string {
  return getCurrentIstDateString();
}

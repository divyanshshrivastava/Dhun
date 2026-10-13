// Core game configuration parameters for Dhun
// Keep these easily tunable for game balance

export interface ClipAttemptConfig {
  attemptIndex: number;
  durationMs: number;
  format: 'wav' | 'm4a' | 'opus';
  label: string;
}

export const GAME_CONFIG = {
  // 6 cumulative intervals: 0.1s, 0.5s, 1.5s, 4s, 8s, 15s
  // First 3 use uncompressed WAV for zero-latency instant start on mobile Safari/Chrome.
  // Last 3 use AAC (m4a) for bandwidth optimization on longer audio.
  clipAttempts: [
    { attemptIndex: 0, durationMs: 100, format: 'wav', label: '0.1s' },
    { attemptIndex: 1, durationMs: 500, format: 'wav', label: '0.5s' },
    { attemptIndex: 2, durationMs: 1500, format: 'wav', label: '1.5s' },
    { attemptIndex: 3, durationMs: 4000, format: 'm4a', label: '4.0s' },
    { attemptIndex: 4, durationMs: 8000, format: 'm4a', label: '8.0s' },
    { attemptIndex: 5, durationMs: 15000, format: 'm4a', label: '15.0s' },
  ] as const satisfies readonly ClipAttemptConfig[],

  totalAttempts: 6,
  timezone: 'Asia/Kolkata', // Midnight IST reset
  hmacTokenExpirySeconds: 90, // Valid window to stream the unlocked clip
  maxRateLimitPerMinute: 15,
} as const;

export type GameClipFormat = typeof GAME_CONFIG.clipAttempts[number]['format'];

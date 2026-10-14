import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { MUSIC_ERAS } from '@/config/eras';
import { MUSIC_GENRES } from '@/config/genres';
import { GameEngine } from '@/services/gameEngine';

describe('Practice Mode - Filter options and backend pooling', () => {
  it('provides comprehensive Indian regional languages and eras', () => {
    expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(10);
    expect(SUPPORTED_LANGUAGES.some(l => l.id === 'hindi')).toBe(true);
    expect(SUPPORTED_LANGUAGES.some(l => l.id === 'punjabi')).toBe(true);
    expect(SUPPORTED_LANGUAGES.some(l => l.id === 'tamil')).toBe(true);
    expect(SUPPORTED_LANGUAGES.some(l => l.id === 'telugu')).toBe(true);

    expect(MUSIC_ERAS.length).toBeGreaterThanOrEqual(6);
    expect(MUSIC_ERAS.some(e => e.id === '90s')).toBe(true);
    expect(MUSIC_ERAS.some(e => e.id === '2000s')).toBe(true);

    expect(MUSIC_GENRES.length).toBeGreaterThanOrEqual(8);
    expect(MUSIC_GENRES.includes('Bollywood')).toBe(true);
    expect(MUSIC_GENRES.includes('Sufi')).toBe(true);
  });

  it('filters practice songs pool by language, era, and genre in GameEngine', async () => {
    const engine = new GameEngine();
    const guestId = '12345678-1234-4000-8000-123456789012';

    const session = await engine.createPracticeSession(guestId, {
      language: 'hindi',
      era: '2010s',
    });

    expect(session.mode).toBe('PRACTICE');
    expect(session.sessionId).toBeDefined();
    expect(session.sessionToken).toBeDefined();
    expect(session.attemptsUsed).toBe(0);
    expect(session.maxAttempts).toBe(6);
  });
});

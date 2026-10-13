import { describe, it, expect } from 'vitest';
import { AudioCutterService, generateOpaqueClipKey } from '../../src/services/audioCutter';
import { SyntheticToneProvider } from '../../src/services/audioSources/SyntheticToneProvider';

describe('AudioCutterService - Master loudness normalization & slice pipeline', () => {
  it('generates consistent HMAC-SHA256 opaque storage keys', () => {
    const key1 = generateOpaqueClipKey('test-song-id', 0, 'wav', 'secret-abc');
    const key2 = generateOpaqueClipKey('test-song-id', 0, 'wav', 'secret-abc');
    const keyDiffAttempt = generateOpaqueClipKey('test-song-id', 1, 'wav', 'secret-abc');
    const keyDiffSong = generateOpaqueClipKey('other-song-id', 0, 'wav', 'secret-abc');

    // Deterministic with same inputs
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^clips\/[a-f0-9]{64}\.wav$/);

    // Differs for different attempts and songs
    expect(key1).not.toBe(keyDiffAttempt);
    expect(key1).not.toBe(keyDiffSong);
  });

  it('slices a master track into 6 cumulative clips (0.1s to 15s) with correct formats', async () => {
    const toneProvider = new SyntheticToneProvider();
    const testAudio = await toneProvider.fetchTrack({ title: 'Test Audio Cutter' });

    const cutter = new AudioCutterService();
    const slices = await cutter.sliceTrack(testAudio.audioBuffer, 'wav', {
      songId: 'unit-test-song-1',
    });

    expect(slices).toHaveLength(6);

    // Verify attempt indices and cumulative durations
    const expectedDurations = [100, 500, 1500, 4000, 8000, 15000];
    const expectedFormats = ['wav', 'wav', 'wav', 'm4a', 'm4a', 'm4a'];

    for (let i = 0; i < 6; i++) {
      expect(slices[i].attemptIndex).toBe(i);
      expect(slices[i].durationMs).toBe(expectedDurations[i]);
      expect(slices[i].format).toBe(expectedFormats[i]);
      expect(slices[i].fileSizeBytes).toBeGreaterThan(0);
      expect(slices[i].buffer.length).toBe(slices[i].fileSizeBytes);
      expect(slices[i].storageKey).toMatch(new RegExp(`^clips\\/[a-f0-9]{64}\\.${expectedFormats[i]}$`));
    }

    // Verify WAV headers on attempts 0, 1, 2
    for (let i = 0; i < 3; i++) {
      const sliceBuf = slices[i].buffer;
      expect(sliceBuf.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(sliceBuf.subarray(8, 12).toString('ascii')).toBe('WAVE');
    }

    // Attempt 1 (500ms) should be larger than attempt 0 (100ms)
    expect(slices[1].fileSizeBytes).toBeGreaterThan(slices[0].fileSizeBytes);
    // Attempt 2 (1500ms) should be larger than attempt 1 (500ms)
    expect(slices[2].fileSizeBytes).toBeGreaterThan(slices[1].fileSizeBytes);
  }, 30000); // 30s timeout for ffmpeg loudness analysis & cutting
});

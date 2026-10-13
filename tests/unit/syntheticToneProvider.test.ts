import { describe, it, expect } from 'vitest';
import { SyntheticToneProvider } from '../../src/services/audioSources/SyntheticToneProvider';

describe('SyntheticToneProvider - Offline Indian scale audio generator', () => {
  it('generates a valid 44.1kHz 16-bit stereo WAV buffer', async () => {
    const provider = new SyntheticToneProvider();
    const result = await provider.fetchTrack({
      title: 'Raag Bilawal Test',
      artists: ['Pandit Synthetic'],
    });

    expect(result.mimeType).toBe('audio/wav');
    expect(result.sourceType).toBe('synthetic_tone');
    expect(result.audioBuffer).toBeInstanceOf(Buffer);

    // Verify standard WAV header
    const buf = result.audioBuffer;
    expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(buf.subarray(12, 16).toString('ascii')).toBe('fmt ');

    // AudioFormat 1 = PCM
    expect(buf.readUInt16LE(20)).toBe(1);
    // Channels = 2 (stereo)
    expect(buf.readUInt16LE(22)).toBe(2);
    // SampleRate = 44100
    expect(buf.readUInt32LE(24)).toBe(44100);
    // BitsPerSample = 16
    expect(buf.readUInt16LE(34)).toBe(16);

    // Verify total size covers 22 seconds (44100 * 22 * 4 + 44 bytes = 3,880,844 bytes)
    expect(buf.byteLength).toBe(44 + 44100 * 22 * 4);
  });

  it('generates distinctly different seeded melodies for different songs', async () => {
    const provider = new SyntheticToneProvider();
    const trackA = await provider.fetchTrack({ id: 'song-a', title: 'Kal Ho Naa Ho' });
    const trackB = await provider.fetchTrack({ id: 'song-b', title: 'Channa Mereya' });

    expect(trackA.audioBuffer.byteLength).toBe(trackB.audioBuffer.byteLength);
    // Buffers must not be identical because seeds and scale intervals differ
    expect(trackA.audioBuffer.equals(trackB.audioBuffer)).toBe(false);
  });
});

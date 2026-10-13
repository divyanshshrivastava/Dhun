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

    // Verify total size covers 16 seconds (44100 * 16 * 4 + 44 bytes = 2,822,444 bytes)
    expect(buf.byteLength).toBe(44 + 44100 * 16 * 4);
  });
});

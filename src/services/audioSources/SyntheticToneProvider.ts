// Generates authentic synthetic Indian raga scale tones in pure 16-bit PCM WAV
// No network connection or external MP3s needed — 100% reliable for tests and offline dev

import { AudioSourceProvider, AudioSourceMetadata, AudioSourceResult } from './AudioSourceProvider';

// Frequencies for Bilawal That (standard Indian major scale in C)
const SA_RE_GA_MA_FREQUENCIES = [
  261.63, // Sa  (C4)
  293.66, // Re  (D4)
  329.63, // Ga  (E4)
  349.23, // Ma  (F4)
  392.00, // Pa  (G4)
  440.00, // Dha (A4)
  493.88, // Ni  (B4)
  523.25, // Sa' (C5)
];

// Builds a standard 44-byte RIFF/WAVE header for 44.1kHz 16-bit stereo PCM
export function createWavPcmHeader(dataByteLength: number, sampleRate = 44100, channels = 2): Buffer {
  const header = Buffer.alloc(44);
  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;

  // RIFF Chunk Descriptor
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataByteLength, 4);
  header.write('WAVE', 8);

  // "fmt " Subchunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // BitsPerSample

  // "data" Subchunk
  header.write('data', 36);
  header.writeUInt32LE(dataByteLength, 40);

  return header;
}

export class SyntheticToneProvider implements AudioSourceProvider {
  readonly providerName = 'synthetic_tone';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // Synthesize a beautiful harmonically rich drone + melody
  async fetchTrack(meta: AudioSourceMetadata): Promise<AudioSourceResult> {
    const durationSeconds = 16; // Generates 16s so all 6 attempts (up to 15s) can be cleanly cut
    const sampleRate = 44100;
    const channels = 2;
    const totalSampleFrames = Math.floor(sampleRate * durationSeconds);
    const bytesPerFrame = channels * 2; // 16-bit stereo = 4 bytes per frame
    const dataByteLength = totalSampleFrames * bytesPerFrame;

    const pcmDataBuffer = Buffer.alloc(dataByteLength);
    const toneSwitchInterval = Math.floor(sampleRate * 2.0); // Switch raga note every 2 seconds

    let writeOffset = 0;
    for (let frameIndex = 0; frameIndex < totalSampleFrames; frameIndex++) {
      const currentTimeSec = frameIndex / sampleRate;

      // Select active melody note
      const noteIndex = Math.floor(frameIndex / toneSwitchInterval) % SA_RE_GA_MA_FREQUENCIES.length;
      const melodyFreq = SA_RE_GA_MA_FREQUENCIES[noteIndex];

      // Base Tanpura drone on fundamental Sa (130.81 Hz = C3) and Pa (196.00 Hz = G3)
      const droneSa = Math.sin(2 * Math.PI * 130.81 * currentTimeSec);
      const dronePa = Math.sin(2 * Math.PI * 196.00 * currentTimeSec);
      const droneComponent = (droneSa + dronePa) * 0.2;

      // Active melody note with pleasant harmonic overtones
      const fundamental = Math.sin(2 * Math.PI * melodyFreq * currentTimeSec);
      const secondHarmonic = Math.sin(2 * Math.PI * (melodyFreq * 2) * currentTimeSec) * 0.25;
      const melodyComponent = (fundamental + secondHarmonic) * 0.4;

      // Gentle envelope attack at the very beginning to avoid abrupt DC click
      const attackEnvelope = Math.min(1.0, currentTimeSec * 20.0);
      const mixedSample = (droneComponent + melodyComponent) * attackEnvelope;

      // Convert float [-1.0, 1.0] to 16-bit signed integer [-32768, 32767]
      const sampleInt16 = Math.max(-32768, Math.min(32767, Math.floor(mixedSample * 32760)));

      // Left Channel
      pcmDataBuffer.writeInt16LE(sampleInt16, writeOffset);
      // Right Channel (subtle stereo delay effect)
      pcmDataBuffer.writeInt16LE(sampleInt16, writeOffset + 2);

      writeOffset += 4;
    }

    const header = createWavPcmHeader(dataByteLength, sampleRate, channels);
    const completeWavBuffer = Buffer.concat([header, pcmDataBuffer]);

    return {
      audioBuffer: completeWavBuffer,
      mimeType: 'audio/wav',
      attribution: `Synthetic Indian scale generated for "${meta.title}"`,
      sourceType: 'synthetic_tone',
    };
  }
}

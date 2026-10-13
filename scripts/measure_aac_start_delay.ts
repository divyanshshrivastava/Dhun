// Diagnostic script to measure AAC-LC encoder priming delay / start offset
// Compares an impulse audio signal in uncompressed PCM WAV vs decoded AAC

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createWavPcmHeader } from '../src/services/audioSources/SyntheticToneProvider';

const execFileAsync = promisify(execFile);

function getFfmpegPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticBin = require('ffmpeg-static');
    if (staticBin && fs.existsSync(staticBin)) return staticBin;
  } catch {
    // ignore
  }
  return 'ffmpeg';
}

export async function measureAacDelay(): Promise<{
  primingSamples: number;
  delayMs: number;
  recommendedTrimFilter?: string;
}> {
  const ffmpeg = getFfmpegPath();
  const tmpDir = path.join(process.cwd(), 'scratch', 'aac_measure');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const sampleRate = 44100;
  const channels = 2;
  const durationSec = 2;
  const totalFrames = sampleRate * durationSec;
  const pcmBuffer = Buffer.alloc(totalFrames * channels * 2);

  // Put a sharp, unmistakable 1kHz sine wave starting immediately at sample frame 0 (time = 0.000s)
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;
    const sample = Math.floor(Math.sin(2 * Math.PI * 1000 * t) * 30000);
    pcmBuffer.writeInt16LE(sample, i * 4);
    pcmBuffer.writeInt16LE(sample, i * 4 + 2);
  }

  const wavHeader = createWavPcmHeader(pcmBuffer.length, sampleRate, channels);
  const inputWav = path.join(tmpDir, 'source_instant_start.wav');
  fs.writeFileSync(inputWav, Buffer.concat([wavHeader, pcmBuffer]));

  // Encode to AAC-LC in MP4 container (same flags used in AudioCutterService)
  const aacOutput = path.join(tmpDir, 'encoded.m4a');
  await execFileAsync(ffmpeg, [
    '-y',
    '-i', inputWav,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    aacOutput,
  ]);

  // Decode the AAC back to raw PCM WAV so we can inspect sample-by-sample
  const decodedWav = path.join(tmpDir, 'decoded_aac.wav');
  await execFileAsync(ffmpeg, [
    '-y',
    '-i', aacOutput,
    '-c:a', 'pcm_s16le',
    decodedWav,
  ]);

  const decodedData = fs.readFileSync(decodedWav).subarray(44); // Skip 44-byte WAV header

  // Scan for the first sample with significant energy (> 1000 amplitude)
  let firstAudibleFrame = 0;
  for (let frame = 0; frame < totalFrames; frame++) {
    const val = decodedData.readInt16LE(frame * 4);
    if (Math.abs(val) > 1000) {
      firstAudibleFrame = frame;
      break;
    }
  }

  const delayMs = (firstAudibleFrame / sampleRate) * 1000;
  console.log(`AAC-LC Priming Delay Measured:`);
  console.log(`- Samples offset: ${firstAudibleFrame} samples`);
  console.log(`- Time offset: ${delayMs.toFixed(3)} ms`);

  // Cleanup
  try {
    fs.unlinkSync(inputWav);
    fs.unlinkSync(aacOutput);
    fs.unlinkSync(decodedWav);
  } catch {
    // ignore
  }

  return {
    primingSamples: firstAudibleFrame,
    delayMs,
  };
}

if (require.main === module || process.argv[1]?.includes('measure_aac_start_delay.ts')) {
  measureAacDelay().then(res => {
    console.log('Result:', res);
  }).catch(err => {
    console.error('Measurement failed:', err);
    process.exit(1);
  });
}

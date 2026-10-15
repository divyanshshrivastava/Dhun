// Core audio cutting & loudness normalization service for Dhun
// Handles single-pass master loudness normalization (-16 LUFS)
// and frame-accurate slicing into 6 cumulative clips

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { GAME_CONFIG, ClipAttemptConfig } from '../config/gameConfig';
import { getServerSecret } from '../config/env';

const execFileAsync = promisify(execFile);

// Resolve ffmpeg binary from ffmpeg-static or fallback to system PATH
function getFfmpegBinaryPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const directPath = path.join(
    process.cwd(),
    'node_modules',
    'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  );
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticBin = require('ffmpeg-static');
    if (staticBin && typeof staticBin === 'string' && fs.existsSync(staticBin)) {
      return staticBin;
    }
  } catch {
    // ignore
  }
  return 'ffmpeg';
}

export interface CutClipResult {
  attemptIndex: number;
  durationMs: number;
  format: 'wav' | 'm4a' | 'opus';
  storageKey: string;
  fileSizeBytes: number;
  buffer: Buffer;
  startOffsetSeconds?: number;
}

export interface SlicingOptions {
  songId: string;
  serverSecret?: string;
  outputDirectory?: string;
  startOffsetSeconds?: number;
  autoTrimSilence?: boolean;
  fastNormalize?: boolean;
}
import { generateOpaqueClipKey } from '@/lib/security/clipKey';
export { generateOpaqueClipKey };

export class AudioCutterService {
  private readonly ffmpegPath: string;
  private readonly tempDir: string;

  constructor(customTempDir?: string) {
    this.ffmpegPath = getFfmpegBinaryPath();
    this.tempDir = customTempDir || path.join(process.cwd(), 'scratch', 'ffmpeg_tmp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Detects leading silence (dB threshold) at the beginning of an audio file
  async detectLeadingSilence(audioPath: string, thresholdDb = -45, minDuration = 0.3): Promise<number> {
    try {
      const args = [
        '-y',
        '-i', audioPath,
        '-af', `silencedetect=noise=${thresholdDb}dB:d=${minDuration}`,
        '-f', 'null',
        '-',
      ];
      let output = '';
      try {
        const res = await execFileAsync(this.ffmpegPath, args);
        output = (res.stderr || res.stdout || '').toString();
      } catch (err: unknown) {
        const stderr = (err as { stderr?: string }).stderr;
        output = stderr ? stderr.toString() : '';
      }

      // Check if silence starts at or near 0:00 (<= 0.15s)
      const startMatch = output.match(/silence_start:\s*([0-9.]+)/);
      const endMatch = output.match(/silence_end:\s*([0-9.]+)/);

      if (startMatch && parseFloat(startMatch[1]) <= 0.15 && endMatch) {
        const silenceEnd = parseFloat(endMatch[1]);
        if (silenceEnd >= minDuration) {
          return silenceEnd;
        }
      }
      return 0;
    } catch {
      return 0;
    }
  }

  // Slices a master track into the 6 configured cumulative clips
  async sliceTrack(
    masterAudioBuffer: Buffer,
    inputExt = 'wav',
    options: SlicingOptions
  ): Promise<CutClipResult[]> {
    const uniqueJobId = crypto.randomUUID();
    const tempInputFile = path.join(this.tempDir, `master_in_${uniqueJobId}.${inputExt}`);
    const tempNormalizedMaster = path.join(this.tempDir, `master_norm_${uniqueJobId}.wav`);

    const temporaryFilesCreated: string[] = [tempInputFile, tempNormalizedMaster];

    try {
      // 1. Write the incoming master audio buffer to disk
      fs.writeFileSync(tempInputFile, masterAudioBuffer);

      // 2. Normalization: single-pass for fast on-demand requests, or two-pass for mastering/ingestion
      let twoPassApplied = false;
      const enableTwoPass = !options.fastNormalize && process.env.DHUN_FAST_SLICING !== 'true';

      if (enableTwoPass) {
        try {
          const measureArgs = [
            '-y',
            '-i', tempInputFile,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json',
            '-f', 'null',
            '-',
          ];

          // In ffmpeg, audio filter stats are output to stderr
          let measureOutput = '';
          try {
            const res = await execFileAsync(this.ffmpegPath, measureArgs);
            measureOutput = (res.stderr || res.stdout || '').toString();
          } catch (err: unknown) {
            // Even if exit code is non-zero, ffmpeg prints filter JSON to stderr
            const stderr = (err as { stderr?: string }).stderr;
            measureOutput = stderr ? stderr.toString() : '';
          }

          const jsonMatch = measureOutput.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
          if (jsonMatch) {
            const stats = JSON.parse(jsonMatch[0]);
            const linearArgs = [
              '-y',
              '-i', tempInputFile,
              '-af',
              `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`,
              '-map_metadata', '-1',
              '-ar', '44100',
              '-ac', '2',
              tempNormalizedMaster,
            ];
            await execFileAsync(this.ffmpegPath, linearArgs);
            twoPassApplied = true;
          }
        } catch (measureErr) {
          // Fallback to single-pass if measure extraction failed
          console.warn('Bhai two-pass loudnorm measurement fell back to single pass:', (measureErr as Error).message);
        }
      }

      if (!twoPassApplied) {
        const fallbackArgs = [
          '-y',
          '-i', tempInputFile,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
          '-map_metadata', '-1',
          '-ar', '44100',
          '-ac', '2',
          tempNormalizedMaster,
        ];
        await execFileAsync(this.ffmpegPath, fallbackArgs);
      }

      // Determine cue start offset:
      // 1. Explicit manual startOffsetSeconds from options (e.g. skip intro dialogues/monologues)
      // 2. Or auto-detect leading dead silence if autoTrimSilence is enabled
      let effectiveOffset = Math.max(0, options.startOffsetSeconds || 0);

      if (effectiveOffset === 0 && options.autoTrimSilence) {
        const detectedSilence = await this.detectLeadingSilence(tempNormalizedMaster);
        if (detectedSilence > 0) {
          effectiveOffset = detectedSilence;
        }
      }

      const generatedSlices: CutClipResult[] = [];

      // 3. Cut each of the 6 cumulative attempts from the normalized master
      for (const attempt of GAME_CONFIG.clipAttempts) {
        const durationSeconds = (attempt.durationMs / 1000).toFixed(3);
        const fileExt = attempt.format === 'wav' ? 'wav' : 'm4a';
        const tempSliceOutput = path.join(
          this.tempDir,
          `slice_${uniqueJobId}_att_${attempt.attemptIndex}.${fileExt}`
        );
        temporaryFilesCreated.push(tempSliceOutput);

        const sliceArgs: string[] = [
          '-y',
          '-ss', effectiveOffset.toFixed(3),
          '-t', durationSeconds,
          '-i', tempNormalizedMaster,
          '-map_metadata', '-1', // Strip ID3 metadata
        ];

        if (attempt.format === 'wav') {
          // Uncompressed 16-bit PCM WAV for attempts 0, 1, 2
          sliceArgs.push('-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', tempSliceOutput);
        } else {
          // High-efficiency AAC-LC in MP4 container for attempts 3, 4, 5
          sliceArgs.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2', tempSliceOutput);
        }

        await execFileAsync(this.ffmpegPath, sliceArgs);

        const sliceBuffer = fs.readFileSync(tempSliceOutput);
        const storageKey = generateOpaqueClipKey(
          options.songId,
          attempt.attemptIndex,
          fileExt,
          options.serverSecret
        );

        // If a permanent output directory was specified, save it there too
        if (options.outputDirectory) {
          const destPath = path.join(options.outputDirectory, storageKey);
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.writeFileSync(destPath, sliceBuffer);
        }

        generatedSlices.push({
          attemptIndex: attempt.attemptIndex,
          durationMs: attempt.durationMs,
          format: attempt.format,
          storageKey,
          fileSizeBytes: sliceBuffer.byteLength,
          buffer: sliceBuffer,
          startOffsetSeconds: effectiveOffset,
        });
      }

      return generatedSlices;
    } finally {
      // Clean up temporary files so we don't leak disk space
      for (const tempFile of temporaryFilesCreated) {
        if (fs.existsSync(/*turbopackIgnore: true*/ tempFile)) {
          try {
            fs.unlinkSync(tempFile);
          } catch {
            // ignore cleanup errors
          }
        }
      }
    }
  }
}

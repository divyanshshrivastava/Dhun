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
}

export interface SlicingOptions {
  songId: string;
  serverSecret?: string;
  outputDirectory?: string;
}

// Generates an unguessable opaque filename so users cannot inspect network requests
export function generateOpaqueClipKey(
  songId: string,
  attemptIndex: number,
  format: string,
  secret = getServerSecret()
): string {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(`${songId}_attempt_${attemptIndex}_dhun_audio`)
    .digest('hex');
  return `clips/${hash}.${format}`;
}

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

      // 2. Two-pass linear EBU R128 loudness normalization
      // Pass 1: Measure loudness statistics of the master track
      let twoPassApplied = false;
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
          '-ss', '00:00:00.000',
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

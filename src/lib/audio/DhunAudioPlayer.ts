// Web Audio API playback engine for Dhun
// Guarantees:
// 1. Immediate pre-fetch and decode on clip arrival (immune to 60s token expiration once decoded)
// 2. Hardware timing via AudioBufferSourceNode.onended (NO setTimeout drift)
// 3. iOS Safari Silent switch bypass & user gesture audio context unlock
// 4. Page Visibility API support (pauses immediately when tab is hidden)
// 5. Automatic token refresh callback if token expires before fetch completes

export type AudioPlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

export interface PlayerCallbacks {
  onStatusChange?: (status: AudioPlayerStatus) => void;
  onProgress?: (progressFraction: number, currentTimeMs: number, totalDurationMs: number) => void;
  onEnded?: () => void;
  onError?: (errorMessage: string) => void;
}

export class DhunAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  private status: AudioPlayerStatus = 'idle';
  private callbacks: PlayerCallbacks = {};

  private playbackStartTime: number = 0;
  private pauseOffsetSec: number = 0;
  private clipDurationMs: number = 0;
  private animFrameId: number | null = null;
  private isUnlocked: boolean = false;
  private currentAttemptIndex: number = 0;
  private tokenRefreshCallback: ((attemptIndex: number) => Promise<string>) | null = null;
  private bufferCache: Map<number, AudioBuffer> = new Map();
  private abortController: AbortController | null = null;

  constructor(callbacks?: PlayerCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }

    // Attach Page Visibility listener to pause playback when tab is backgrounded
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  clearBufferCache(): void {
    this.bufferCache.clear();
  }

  // Ensures AudioContext is created and unlocked via user gesture
  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Configure iOS audio session for playback category to bypass hardware silent switch
      if ('audioSession' in navigator && (navigator as unknown as { audioSession: { type: string } }).audioSession) {
        try {
          (navigator as unknown as { audioSession: { type: string } }).audioSession.type = 'playback';
        } catch {
          // ignore
        }
      }

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  // Explicit user unlock gesture handler (e.g. on first tap/click anywhere)
  async unlockAudio(): Promise<void> {
    if (this.isUnlocked || typeof window === 'undefined') return;
    try {
      const ctx = this.ensureAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play 1 silent sample to prime the hardware DAC on iOS
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      this.isUnlocked = true;
    } catch {
      // ignore
    }
  }

  setTokenRefreshCallback(cb: (attemptIndex: number) => Promise<string>): void {
    this.tokenRefreshCallback = cb;
  }

  // Immediately fetches and decodes an audio slice into memory with client-side caching
  async loadClip(
    clipStreamUrl: string,
    attemptIndex: number,
    durationMs: number,
    refreshTokenCallback?: () => Promise<string>
  ): Promise<boolean> {
    this.stop();
    this.currentAttemptIndex = attemptIndex;
    this.clipDurationMs = durationMs;
    this.pauseOffsetSec = 0;

    // Fast path: If this attempt is already decoded in memory, switch to it immediately in 0ms!
    if (this.bufferCache.has(attemptIndex)) {
      this.currentBuffer = this.bufferCache.get(attemptIndex)!;
      if (this.currentBuffer.duration > 0) {
        this.clipDurationMs = Math.round(this.currentBuffer.duration * 1000);
      }
      this.setStatus('ready');
      return true;
    }

    this.setStatus('loading');

    // Abort previous in-flight request if user quickly skipped
    if (this.abortController) {
      try { this.abortController.abort(); } catch {}
    }
    const controller = new AbortController();
    this.abortController = controller;
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 10000); // 10s maximum network timeout to guarantee no infinite loading

    let targetUrl = clipStreamUrl;
    const effectiveRefresh =
      refreshTokenCallback ||
      (this.tokenRefreshCallback ? () => this.tokenRefreshCallback!(attemptIndex) : undefined);

    try {
      let response: Response;
      try {
        response = await fetch(targetUrl, { signal: controller.signal });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          // If aborted by a newer skip, don't trigger error
          return false;
        }
        throw fetchErr;
      }

      // If token expired (410 Gone), try refreshing once automatically
      if ((response.status === 410 || response.status === 403) && effectiveRefresh) {
        try {
          targetUrl = await effectiveRefresh();
          response = await fetch(targetUrl, { signal: controller.signal });
        } catch {
          // fallback to error
        }
      }

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData?.error) errorDetail = errData.error;
        } catch {}
        throw new Error(`Failed to load audio slice: ${errorDetail}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      clearTimeout(timeoutId);

      const ctx = this.ensureAudioContext();

      // Decode PCM WAV or AAC audio data asynchronously into an in-memory AudioBuffer
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.currentBuffer = decodedBuffer;
      this.bufferCache.set(attemptIndex, decodedBuffer);

      if (this.currentBuffer.duration > 0) {
        this.clipDurationMs = Math.round(this.currentBuffer.duration * 1000);
      }
      this.setStatus('ready');
      return true;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if ((err as any)?.name === 'AbortError') {
        return false;
      }
      const errorMsg = err instanceof Error ? err.message : 'Audio decode failed';
      this.setStatus('error');
      this.callbacks.onError?.(errorMsg);
      return false;
    }
  }

  // Convenience helper that derives standard cumulative duration if not provided
  async loadAndDecodeClip(
    clipStreamUrl: string,
    attemptIndex: number,
    durationMs?: number
  ): Promise<boolean> {
    const CUMULATIVE_DURATIONS_MS = [100, 500, 1500, 4000, 8000, 15000];
    const resolvedDuration =
      durationMs ?? CUMULATIVE_DURATIONS_MS[attemptIndex] ?? 15000;
    return this.loadClip(clipStreamUrl, attemptIndex, resolvedDuration);
  }

  // Hardware-timed playback using AudioBufferSourceNode.onended (NO setTimeout)
  async play(): Promise<void> {
    if (!this.currentBuffer) {
      this.callbacks.onError?.("Audio clip is loading or unavailable. Please click Retry Audio.");
      return;
    }
    const ctx = this.ensureAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    if (this.status === 'playing') return;

    // Disconnect any existing source
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }

    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    source.connect(this.gainNode || ctx.destination);

    // Hardware Web Audio onended callback
    source.onended = () => {
      // Only fire if we didn't pause/stop manually
      if (this.status === 'playing') {
        this.stopAnimation();
        this.pauseOffsetSec = 0;
        this.setStatus('ready');
        this.callbacks.onProgress?.(1.0, this.clipDurationMs, this.clipDurationMs);
        this.callbacks.onEnded?.();
      }
    };

    const startOffset = Math.max(0, this.pauseOffsetSec);
    this.playbackStartTime = ctx.currentTime - startOffset;
    source.start(0, startOffset);
    this.currentSource = source;

    this.setStatus('playing');
    this.startProgressAnimation();
  }

  pause(): void {
    if (this.status !== 'playing' || !this.currentSource || !this.audioCtx) return;

    this.pauseOffsetSec = this.audioCtx.currentTime - this.playbackStartTime;
    try {
      this.currentSource.onended = null;
      this.currentSource.stop();
      this.currentSource.disconnect();
    } catch {
      // ignore
    }
    this.currentSource = null;
    this.stopAnimation();
    this.setStatus('paused');
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }
    this.stopAnimation();
    this.pauseOffsetSec = 0;
    if (this.status !== 'idle' && this.status !== 'loading' && this.status !== 'error') {
      this.setStatus('ready');
    }
    this.callbacks.onProgress?.(0, 0, this.clipDurationMs);
  }

  // Page Visibility API handler
  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.hidden) {
      if (this.status === 'playing') {
        this.pause();
      }
    }
  };

  private startProgressAnimation(): void {
    this.stopAnimation();
    const durationSec = this.clipDurationMs / 1000;

    const tick = () => {
      if (this.status !== 'playing' || !this.audioCtx) return;

      const elapsedSec = this.audioCtx.currentTime - this.playbackStartTime;
      const progressFraction = Math.min(1.0, Math.max(0, elapsedSec / durationSec));
      const currentTimeMs = Math.min(this.clipDurationMs, elapsedSec * 1000);

      this.callbacks.onProgress?.(progressFraction, currentTimeMs, this.clipDurationMs);

      if (elapsedSec < durationSec) {
        this.animFrameId = requestAnimationFrame(tick);
      }
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopAnimation(): void {
    if (this.animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private setStatus(newStatus: AudioPlayerStatus): void {
    this.status = newStatus;
    this.callbacks.onStatusChange?.(newStatus);
  }

  getStatus(): AudioPlayerStatus {
    return this.status;
  }

  getCurrentAttemptIndex(): number {
    return this.currentAttemptIndex;
  }

  getClipDurationMs(): number {
    return this.clipDurationMs;
  }

  destroy(): void {
    this.stop();
    if (this.abortController) {
      try { this.abortController.abort(); } catch {}
      this.abortController = null;
    }
    this.bufferCache.clear();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
    }
    this.audioCtx = null;
    this.currentBuffer = null;
  }

  dispose(): void {
    this.destroy();
  }
}

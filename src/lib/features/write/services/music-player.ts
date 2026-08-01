/**
 * MusicPlayer - Implementation for music playback in Write tab
 */

/** Safari's legacy prefixed AudioContext (no `unknown` double-cast needed). */
interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export class MusicPlayer {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private initialized = false;
  private errorListener: ((message: string) => void) | null = null;
  private timeListener:
    | ((currentMs: number, durationMs: number) => void)
    | null = null;
  private loadedListener: ((durationMs: number) => void) | null = null;
  private endedListener: (() => void) | null = null;
  private currentFilename: string | undefined;

  constructor() {}

  /** Playback position/duration updates (ms). Pass null to clear. */
  onTimeUpdate(
    listener: ((currentMs: number, durationMs: number) => void) | null
  ): void {
    this.timeListener = listener;
  }

  /** Fires once the track's duration (ms) is known. Pass null to clear. */
  onLoadedMetadata(listener: ((durationMs: number) => void) | null): void {
    this.loadedListener = listener;
  }

  /** Fires when the track finishes. Pass null to clear. */
  onEnded(listener: (() => void) | null): void {
    this.endedListener = listener;
  }

  get filename(): string | undefined {
    return this.currentFilename;
  }

  /**
   * Register a callback invoked whenever playback or loading fails, with a
   * human-readable message. Consumers wire this into their UI state (e.g.
   * `MusicPlayerState.error`) so failures surface instead of only hitting the
   * console. Pass `null` to clear.
   */
  onError(listener: ((message: string) => void) | null): void {
    this.errorListener = listener;
  }

  private emitError(message: string): void {
    this.errorListener?.(message);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Web Audio API context
      const AudioContextClass =
        window.AudioContext ??
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API unavailable in this browser");
      }
      this.audioContext = new AudioContextClass();

      // Resume audio context if suspended (required for user interaction)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.initialized = true;
    } catch (error) {
      console.error(
        "❌ MusicPlayer: Failed to initialize audio context:",
        error
      );
      // Fallback to basic HTML audio without Web Audio API
      this.initialized = true;
    }
  }

  cleanup(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.teardownAudioEventListeners();
      this.currentAudio = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.initialized = false;
    this.currentFilename = undefined;
  }

  async play(track: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Stop current audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.teardownAudioEventListeners();
      }

      // Create new audio element
      this.currentAudio = new Audio(track);
      this.setupAudioEventListeners();

      // Start playback
      await this.currentAudio.play();
    } catch (error) {
      console.error("❌ MusicPlayer: Failed to play track:", error);
      this.emitError(`Failed to play track: ${track}`);
      throw new Error(`Failed to play track: ${track}`);
    }
  }

  async pause(): Promise<void> {
    if (!this.currentAudio) {
      return;
    }

    this.currentAudio.pause();
  }

  async stop(): Promise<void> {
    if (!this.currentAudio) {
      return;
    }

    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
  }

  /** Load a track WITHOUT auto-playing — wires listeners so the UI state stays
   * live. Use `playLoaded()` to start. */
  async load(url: string, filename: string): Promise<void> {
    await this.ensureInitialized();

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.teardownAudioEventListeners();
    }

    this.currentAudio = new Audio(url);
    this.currentFilename = filename;
    this.setupAudioEventListeners();
  }

  /** Resume/play the currently-loaded track (from `load`). */
  async playLoaded(): Promise<void> {
    if (!this.currentAudio) return;
    await this.ensureInitialized();
    try {
      await this.currentAudio.play();
    } catch (error) {
      console.error("❌ MusicPlayer: Failed to play loaded track:", error);
      this.emitError("Failed to play the loaded track.");
      throw error;
    }
  }

  /** Seek the loaded track to `ms` milliseconds. */
  seek(ms: number): void {
    if (this.currentAudio) this.currentAudio.currentTime = ms / 1000;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private setupAudioEventListeners(): void {
    if (!this.currentAudio) return;

    this.currentAudio.addEventListener(
      "loadedmetadata",
      this.handleLoadedMetadata
    );
    this.currentAudio.addEventListener("timeupdate", this.handleTimeUpdate);
    this.currentAudio.addEventListener("ended", this.handleEnded);
    this.currentAudio.addEventListener("error", this.handleError);
  }

  private teardownAudioEventListeners(): void {
    if (!this.currentAudio) return;
    this.currentAudio.removeEventListener(
      "loadedmetadata",
      this.handleLoadedMetadata
    );
    this.currentAudio.removeEventListener("timeupdate", this.handleTimeUpdate);
    this.currentAudio.removeEventListener("ended", this.handleEnded);
    this.currentAudio.removeEventListener("error", this.handleError);
  }

  private durationMs(): number {
    const d = this.currentAudio?.duration ?? 0;
    return Number.isFinite(d) ? d * 1000 : 0;
  }

  private handleLoadedMetadata = (): void => {
    this.loadedListener?.(this.durationMs());
  };

  private handleTimeUpdate = (): void => {
    if (!this.currentAudio) return;
    this.timeListener?.(
      this.currentAudio.currentTime * 1000,
      this.durationMs()
    );
  };

  private handleEnded = (): void => {
    this.endedListener?.();
  };

  private handleError = (event: Event): void => {
    console.error("❌ MusicPlayer: Audio error:", event);

    // Translate the MediaError code into a readable message and surface it so
    // the UI can show the failure rather than silently dropping it.
    const mediaError = (event.target as HTMLAudioElement | null)?.error;
    const message = this.describeMediaError(mediaError);
    this.emitError(message);
  };

  private describeMediaError(error: MediaError | null | undefined): string {
    switch (error?.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return "Playback was aborted.";
      case MediaError.MEDIA_ERR_NETWORK:
        return "A network error interrupted the audio download.";
      case MediaError.MEDIA_ERR_DECODE:
        return "The audio could not be decoded.";
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return "This audio format or source is not supported.";
      default:
        return "An unknown audio error occurred.";
    }
  }
}

/**
 * MusicPlayer - Implementation for music playback in Write tab
 */
export class MusicPlayer {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private initialized = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Web Audio API context
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
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
      this.currentAudio.removeEventListener(
        "loadedmetadata",
        this.handleLoadedMetadata
      );
      this.currentAudio.removeEventListener(
        "timeupdate",
        this.handleTimeUpdate
      );
      this.currentAudio.removeEventListener("ended", this.handleEnded);
      this.currentAudio.removeEventListener("error", this.handleError);
      this.currentAudio = null;
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
      this.audioContext = null;
    }

    this.initialized = false;
  }

  async play(track: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Stop current audio if playing
      if (this.currentAudio) {
        this.currentAudio.pause();
      }

      // Create new audio element
      this.currentAudio = new Audio(track);
      this.setupAudioEventListeners();

      // Start playback
      await this.currentAudio.play();
    } catch (error) {
      console.error("❌ MusicPlayer: Failed to play track:", error);
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

  private handleLoadedMetadata = (): void => {
    // Metadata loaded - could emit events here for UI updates
  };

  private handleTimeUpdate = (): void => {
    // Could emit events here for UI updates
  };

  private handleEnded = (): void => {
    // Track ended - could emit events here for UI updates
  };

  private handleError = (event: Event): void => {
    console.error("❌ MusicPlayer: Audio error:", event);
  };
}

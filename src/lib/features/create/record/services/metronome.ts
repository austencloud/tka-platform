/**
 * Metronome
 *
 * Provides metronome functionality using Web Audio API.
 * Creates click sounds synced with beat progression timing.
 */

export class Metronome {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private nextClickTime: number = 0;
  private scheduleAheadTime: number = 0.1; // Schedule clicks 100ms ahead
  private timerID: number | null = null;

  constructor() {
    // Initialize AudioContext on first user interaction
    // (browsers require user gesture before audio can play)
  }

  /**
   * Initialize audio context if not already initialized.
   * Construction can throw (unsupported browser, exhausted audio resources),
   * so failures leave audioContext null for the caller to detect.
   */
  private initializeAudioContext(): void {
    if (!this.audioContext) {
      try {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        this.audioContext = new AudioContextConstructor();
      } catch (err) {
        console.error("Failed to construct audio context:", err);
        this.audioContext = null;
      }
    }
  }

  /**
   * Create a metronome click sound
   */
  private createClick(time: number, isAccent: boolean = false): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Accented beat (first beat) vs regular beat
    if (isAccent) {
      oscillator.frequency.value = 1200; // Higher pitch for accented beat
      gainNode.gain.value = 0.3;
    } else {
      oscillator.frequency.value = 800; // Regular pitch
      gainNode.gain.value = 0.2;
    }

    // Short click sound
    oscillator.start(time);
    oscillator.stop(time + 0.05); // 50ms click

    // Fade out to avoid clicking
    gainNode.gain.setValueAtTime(gainNode.gain.value, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
  }

  /**
   * Start the metronome
   * @param bpm - Beats per minute
   * @param onStep - Callback called on each beat with beat index
   * @returns false when the audio context could not be initialized, so the
   *          caller can surface the failure to the user; true otherwise.
   */
  start(bpm: number, onStep?: (stepNumber: number) => void): boolean {
    this.initializeAudioContext();

    if (!this.audioContext) {
      console.error("Failed to initialize audio context");
      return false;
    }

    const beatsPerSecond = bpm / 60;
    const secondsPerBeat = 1 / beatsPerSecond;

    this.nextClickTime = this.audioContext.currentTime;
    let stepIndex = 0;

    const scheduler = () => {
      if (!this.audioContext) return;

      // Schedule clicks ahead of time
      while (
        this.nextClickTime <
        this.audioContext.currentTime + this.scheduleAheadTime
      ) {
        if (this.isEnabled) {
          // Accent every 4th beat (typical measure)
          const isAccent = stepIndex % 4 === 0;
          this.createClick(this.nextClickTime, isAccent);
        }

        if (onStep) {
          // Schedule callback at the same time as the click
          const callbackDelay =
            (this.nextClickTime - this.audioContext.currentTime) * 1000;
          setTimeout(() => onStep(stepIndex), Math.max(0, callbackDelay));
        }

        this.nextClickTime += secondsPerBeat;
        stepIndex++;
      }

      this.timerID = window.setTimeout(scheduler, 25);
    };

    scheduler();
    return true;
  }

  /**
   * Stop the metronome
   */
  stop(): void {
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  /**
   * Enable or disable metronome sound
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if metronome is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }
}

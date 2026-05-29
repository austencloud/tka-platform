/**
 * WakeWordDetector
 *
 * Two-mode speech listener:
 *
 * 1. Wake word mode (default): Listens for "hey tika [command]" and emits
 *    the command portion. If just "hey tika" is said alone, fires the
 *    onWakeWord callback (used to enter command mode).
 *
 * 2. Command mode: Every recognized utterance is emitted as a command
 *    (no wake word prefix needed). Used for rapid-fire voice control.
 *
 * Automatically restarts recognition when it ends (browser silence timeout),
 * giving a continuous-listening experience in both modes.
 *
 * Plays a short audio cue when entering command mode so the user knows
 * the mic is hot without looking at the screen.
 */

import type { WakeWordEvent, WakeWordState } from "../domain/voice-command-types";

/** Normalized forms of the wake phrase that speech recognition might produce */
const WAKE_PHRASES = [
  "hey tika",
  "hey teca",
  "hey tica",
  "hey teeka",
  "hey tikka",
  "hey tika,",
];

/** Max restart attempts before giving up (resets on successful start) */
const _MAX_RESTART_ATTEMPTS = 5;

/** Base delay for restart backoff (ms) - used when start() itself fails */
const RESTART_BASE_DELAY_MS = 300;

/**
 * Delay before restarting after a silence timeout (no results in the session).
 * Mobile browsers end recognition quickly even with continuous=true. A longer
 * delay here prevents the rapid start/stop cycle that causes repeated browser
 * audio indicators on mobile.
 */
const SILENCE_RESTART_DELAY_MS = 2000;

/**
 * After this many consecutive silent restarts (sessions that ended without
 * any speech results), stop auto-restarting. The user probably walked away
 * or isn't actively using voice. They can re-tap the mic to resume.
 */
const MAX_CONSECUTIVE_SILENT_RESTARTS = 8;

/**
 * Returns the SpeechRecognition constructor if available, or null.
 * Handles vendor-prefixed variants (Chrome uses webkitSpeechRecognition).
 */
function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class WakeWordDetector {
  private recognition: SpeechRecognition | null = null;
  private listening = false;
  private commandMode = false;
  private state: WakeWordState = "idle";
  private commandCallbacks = new Set<(event: WakeWordEvent) => void>();
  private wakeWordCallbacks = new Set<() => void>();
  private stateCallbacks = new Set<(state: WakeWordState) => void>();
  private intentionallyStopped = false;

  /** Monotonic ID to prevent stale onend handlers from restarting */
  private sessionId = 0;

  /** Current consecutive restart failure count (start() itself failed) */
  private restartAttempts = 0;

  /** Whether the current recognition session received any speech results */
  private hadResultsInSession = false;

  /**
   * Consecutive sessions that ended without any speech results.
   * NOT reset by start() succeeding - only reset when we actually get speech.
   * This is what prevents the infinite restart loop on mobile.
   */
  private consecutiveSilentRestarts = 0;

  /** AudioContext for the command mode entry chime */
  private audioContext: AudioContext | null = null;

  // ── Public API ──────────────────────────────────────────────

  start(): void {
    if (this.listening) return;
    if (!this.isSupported()) {
      console.warn("[HeyTika] Web Speech API not supported in this browser");
      this.setState("error");
      return;
    }

    this.intentionallyStopped = false;
    this.restartAttempts = 0;
    this.consecutiveSilentRestarts = 0;
    this.warmUpAudioContext();
    this.startRecognition();
  }

  stop(): void {
    this.intentionallyStopped = true;
    this.listening = false;
    this.commandMode = false;
    this.sessionId++;
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    // Clean up gesture listeners if still registered
    if (this.gestureHandler) {
      window.removeEventListener("click", this.gestureHandler);
      window.removeEventListener("touchstart", this.gestureHandler);
      window.removeEventListener("keydown", this.gestureHandler);
      this.gestureHandler = null;
    }
    this.setState("idle");
  }

  isListening(): boolean {
    return this.listening;
  }

  isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  setCommandMode(enabled: boolean): void {
    const wasCommandMode = this.commandMode;
    this.commandMode = enabled;
    if (this.listening) {
      this.setState(enabled ? "command_mode" : "listening");
    }
    // Play audio cue when entering command mode (not when exiting)
    if (enabled && !wasCommandMode) {
      this.playCommandModeChime();
    }
  }

  isCommandMode(): boolean {
    return this.commandMode;
  }

  onCommand(callback: (event: WakeWordEvent) => void): () => void {
    this.commandCallbacks.add(callback);
    return () => this.commandCallbacks.delete(callback);
  }

  onWakeWord(callback: () => void): () => void {
    this.wakeWordCallbacks.add(callback);
    return () => this.wakeWordCallbacks.delete(callback);
  }

  onStateChange(callback: (state: WakeWordState) => void): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  // ── Internals ───────────────────────────────────────────────

  private setState(next: WakeWordState): void {
    if (next === this.state) return;
    this.state = next;
    for (const cb of this.stateCallbacks) cb(next);
  }

  private emitCommand(command: string, confidence: number): void {
    this.setState("processing");
    const event: WakeWordEvent = {
      command,
      confidence,
      timestamp: Date.now(),
    };
    for (const cb of this.commandCallbacks) cb(event);
    // Return to appropriate listening state
    this.setState(this.commandMode ? "command_mode" : "listening");
  }

  private emitWakeWordOnly(): void {
    for (const cb of this.wakeWordCallbacks) cb();
  }

  /**
   * Create a new recognition instance and start it.
   * Bumps the session ID so stale onend handlers are ignored.
   */
  private startRecognition(): void {
    // Bump session ID to invalidate any pending onend from old sessions
    this.sessionId++;
    const mySessionId = this.sessionId;
    this.hadResultsInSession = false;

    const Ctor = getSpeechRecognitionCtor()!;
    const rec = new Ctor();

    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      this.hadResultsInSession = true;
      this.consecutiveSilentRestarts = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;

        const alternative = result[0];
        if (!alternative) continue;
        const transcript = alternative.transcript.trim().toLowerCase();
        const confidence = alternative.confidence;

        if (this.commandMode) {
          // In command mode, everything is a command.
          // But if they say the wake word again, still strip it.
          const stripped = this.stripWakePhrase(transcript);
          const commandText = stripped !== null ? stripped : transcript;
          if (commandText.length > 0) {
            this.emitCommand(commandText, confidence);
          }
        } else {
          // Wake word mode: require "hey tika" prefix
          const wakeResult = this.checkWakePhrase(transcript);
          if (wakeResult === "command_with_wake") {
            const command = this.stripWakePhrase(transcript)!;
            this.emitCommand(command, confidence);
          } else if (wakeResult === "wake_only") {
            this.emitWakeWordOnly();
          }
          // Otherwise: not a wake word transcript, ignore
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are normal lifecycle events, not real errors
      if (event.error === "no-speech" || event.error === "aborted") return;

      console.warn(`[HeyTika] Speech recognition error: ${event.error}`);
      this.setState("error");

      // Network/audio errors are transient - restart will be attempted via onend
    };

    rec.onend = () => {
      // Ignore onend from stale sessions (a newer session has already started)
      if (mySessionId !== this.sessionId) return;

      if (!this.intentionallyStopped && this.listening) {
        this.scheduleRestart();
      }
    };

    this.recognition = rec;

    try {
      rec.start();
      this.listening = true;
      this.restartAttempts = 0; // Reset on successful start
      this.setState(this.commandMode ? "command_mode" : "listening");
    } catch (e) {
      console.warn("[HeyTika] Failed to start recognition:", e);
      this.listening = false;
      this.setState("error");
    }
  }

  /**
   * Schedule a restart, with different strategies for silence vs active sessions.
   *
   * Mobile browsers kill recognition sessions frequently even with continuous=true.
   * Without this distinction, the detector enters a tight start→silence→restart loop
   * that triggers the browser's audio indicator on every cycle - the "cha-ching" bug.
   */
  private scheduleRestart(): void {
    if (this.intentionallyStopped || !this.listening) return;

    if (this.hadResultsInSession) {
      // Session had speech - restart quickly to keep the conversation flowing.
      // Reset silent counter since the user is actively speaking.
      this.consecutiveSilentRestarts = 0;
      setTimeout(() => {
        if (this.intentionallyStopped || !this.listening) return;
        this.startRecognition();
      }, RESTART_BASE_DELAY_MS);
      return;
    }

    // Session ended without any speech results (silence timeout).
    this.consecutiveSilentRestarts++;

    if (this.consecutiveSilentRestarts > MAX_CONSECUTIVE_SILENT_RESTARTS) {
      this.listening = false;
      this.setState("idle");
      return;
    }

    // Use a longer delay for silent restarts to avoid the rapid on/off cycle
    // that causes browser audio indicators on mobile.
    const delay = SILENCE_RESTART_DELAY_MS;
    setTimeout(() => {
      if (this.intentionallyStopped || !this.listening) return;
      this.startRecognition();
    }, delay);
  }

  /**
   * Check if transcript contains a wake phrase.
   * Returns:
   * - "command_with_wake" if wake phrase + command text follows
   * - "wake_only" if just the wake phrase with nothing after
   * - null if no wake phrase detected
   */
  private checkWakePhrase(transcript: string): "command_with_wake" | "wake_only" | null {
    for (const phrase of WAKE_PHRASES) {
      if (transcript.startsWith(phrase)) {
        const remainder = transcript.slice(phrase.length).trim();
        return remainder.length > 0 ? "command_with_wake" : "wake_only";
      }
    }
    return null;
  }

  /**
   * Strip the wake phrase and return the command portion, or null if
   * no wake phrase found or no command after it.
   */
  private stripWakePhrase(transcript: string): string | null {
    for (const phrase of WAKE_PHRASES) {
      if (transcript.startsWith(phrase)) {
        const remainder = transcript.slice(phrase.length).trim();
        if (remainder.length > 0) return remainder;
        return null;
      }
    }
    return null;
  }

  // ── Audio Cue ─────────────────────────────────────────────

  /** One-time gesture listener bound reference (for cleanup) */
  private gestureHandler: (() => void) | null = null;

  /**
   * Register a one-time click/touch/keydown listener to unlock the AudioContext.
   * Chrome blocks AudioContext until a user gesture occurs. Since speech recognition
   * doesn't count as a gesture, we pre-create the context and unlock it on the
   * first real interaction so it's ready when the chime needs to play.
   */
  private warmUpAudioContext(): void {
    if (typeof window === "undefined") return;
    if (this.audioContext) return; // Already created

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext)();
    } catch {
      return; // AudioContext not available
    }

    // If already running (unlikely on first create), nothing to do
    if (this.audioContext.state === "running") return;

    // Register a one-time gesture handler to resume the context
    this.gestureHandler = () => {
      if (this.audioContext?.state === "suspended") {
        this.audioContext.resume();
      }
      // Clean up all listeners after first gesture
      window.removeEventListener("click", this.gestureHandler!);
      window.removeEventListener("touchstart", this.gestureHandler!);
      window.removeEventListener("keydown", this.gestureHandler!);
      this.gestureHandler = null;
    };

    window.addEventListener("click", this.gestureHandler, { once: false });
    window.addEventListener("touchstart", this.gestureHandler, { once: false });
    window.addEventListener("keydown", this.gestureHandler, { once: false });
  }

  /**
   * Play a short two-tone rising chime when entering command mode.
   * Uses the Web Audio API - no external audio files needed.
   * Silently no-ops if AudioContext is unavailable or still suspended.
   */
  private playCommandModeChime(): void {
    try {
      const ctx = this.audioContext;
      if (ctx?.state !== "running") return;

      const now = ctx.currentTime;

      // Two short tones: C5 → E5 (major third, sounds friendly/affirmative)
      this.playTone(ctx, 523.25, now, 0.08, 0.15);       // C5
      this.playTone(ctx, 659.25, now + 0.09, 0.08, 0.15); // E5
    } catch {
      // AudioContext error - silent fallback
    }
  }

  /** Play a single sine tone at the given frequency and time */
  private playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}

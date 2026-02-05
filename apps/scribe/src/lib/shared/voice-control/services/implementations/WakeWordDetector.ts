/**
 * WakeWordDetector
 *
 * Listens continuously via the Web Speech API for transcripts that begin
 * with the wake phrase "hey tika". Strips the wake phrase and emits
 * the remaining text as a command.
 *
 * Automatically restarts recognition when it ends (browser timeout),
 * giving a continuous-listening experience.
 */

import type { IWakeWordDetector } from "../contracts/IWakeWordDetector";
import type { WakeWordEvent, WakeWordState } from "../../domain/voice-command-types";

/** Normalized forms of the wake phrase that speech recognition might produce */
const WAKE_PHRASES = [
  "hey tika",
  "hey teca",
  "hey tica",
  "hey teeka",
  "hey tikka",
  "a tika",
  "hey tika,",
];

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

export class WakeWordDetector implements IWakeWordDetector {
  private recognition: SpeechRecognition | null = null;
  private listening = false;
  private state: WakeWordState = "idle";
  private commandCallbacks = new Set<(event: WakeWordEvent) => void>();
  private stateCallbacks = new Set<(state: WakeWordState) => void>();
  private intentionallyStopped = false;

  // ── Public API ──────────────────────────────────────────────

  start(): void {
    if (this.listening) return;
    if (!this.isSupported()) {
      console.warn("[HeyTika] Web Speech API not supported in this browser");
      this.setState("error");
      return;
    }

    this.intentionallyStopped = false;
    this.createRecognition();
    this.recognition!.start();
    this.listening = true;
    this.setState("listening");
    console.log("[HeyTika] Wake word detector started");
  }

  stop(): void {
    this.intentionallyStopped = true;
    this.listening = false;
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    this.setState("idle");
    console.log("[HeyTika] Wake word detector stopped");
  }

  isListening(): boolean {
    return this.listening;
  }

  isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  onCommand(callback: (event: WakeWordEvent) => void): () => void {
    this.commandCallbacks.add(callback);
    return () => this.commandCallbacks.delete(callback);
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

  private createRecognition(): void {
    const Ctor = getSpeechRecognitionCtor()!;
    const rec = new Ctor();

    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (event: SpeechRecognitionEvent) => {
      // Process only new results since last check
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;

        const alternative = result[0];
        if (!alternative) continue;
        const transcript = alternative.transcript.trim().toLowerCase();
        const confidence = alternative.confidence;

        const command = this.stripWakePhrase(transcript);
        if (command !== null) {
          console.log(
            `[HeyTika] Wake word detected, command: "${command}" (confidence: ${confidence.toFixed(2)})`
          );
          this.setState("processing");
          const wakeEvent: WakeWordEvent = {
            command,
            confidence,
            timestamp: Date.now(),
          };
          for (const cb of this.commandCallbacks) cb(wakeEvent);
          // Return to listening after processing
          this.setState("listening");
        }
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" and "aborted" are normal operational events, not errors
      if (event.error === "no-speech" || event.error === "aborted") return;

      console.warn(`[HeyTika] Speech recognition error: ${event.error}`);
      this.setState("error");

      // Attempt auto-recovery for transient errors
      if (event.error === "network" || event.error === "audio-capture") {
        this.scheduleRestart();
      }
    };

    rec.onend = () => {
      // Browser ends recognition after silence timeout.
      // Auto-restart unless we intentionally stopped.
      if (!this.intentionallyStopped && this.listening) {
        this.scheduleRestart();
      }
    };

    this.recognition = rec;
  }

  private scheduleRestart(): void {
    // Small delay to avoid rapid restart loops
    setTimeout(() => {
      if (this.intentionallyStopped || !this.listening) return;
      try {
        this.createRecognition();
        this.recognition!.start();
        this.setState("listening");
      } catch (e) {
        console.warn("[HeyTika] Failed to restart recognition:", e);
        this.setState("error");
      }
    }, 300);
  }

  /**
   * If the transcript starts with a recognized wake phrase, return
   * the remaining text (the command). Otherwise return null.
   */
  private stripWakePhrase(transcript: string): string | null {
    for (const phrase of WAKE_PHRASES) {
      if (transcript.startsWith(phrase)) {
        const remainder = transcript.slice(phrase.length).trim();
        // Require actual command text after the wake word
        if (remainder.length > 0) return remainder;
      }
    }
    return null;
  }
}

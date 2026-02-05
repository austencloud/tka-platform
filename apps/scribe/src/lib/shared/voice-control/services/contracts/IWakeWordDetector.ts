/**
 * IWakeWordDetector
 *
 * Listens for the "Hey Tika" wake word via the Web Speech API.
 * Strips the wake phrase and emits the remaining command text.
 */

import type { WakeWordEvent, WakeWordState } from "../../domain/voice-command-types";

export interface IWakeWordDetector {
  /** Start listening for the wake word */
  start(): void;

  /** Stop listening */
  stop(): void;

  /** Whether the detector is currently listening */
  isListening(): boolean;

  /** Whether the Web Speech API is available in this browser */
  isSupported(): boolean;

  /** Subscribe to command events (after wake word detected). Returns unsubscribe fn. */
  onCommand(callback: (event: WakeWordEvent) => void): () => void;

  /** Subscribe to state changes. Returns unsubscribe fn. */
  onStateChange(callback: (state: WakeWordState) => void): () => void;
}

/**
 * IWakeWordDetector
 *
 * Listens for the "Hey Tika" wake word via the Web Speech API.
 *
 * Two modes:
 * - Wake word mode (default): Only emits commands when "Hey Tika [command]" is detected.
 *   If just "Hey Tika" is said with no command, fires the onWakeWord callback.
 * - Command mode: Every recognized utterance is emitted as a command (no wake word needed).
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

  /**
   * Toggle command mode. When enabled, all speech is treated as commands
   * (no wake word prefix needed). When disabled, reverts to wake word mode.
   */
  setCommandMode(enabled: boolean): void;

  /** Whether command mode is currently active */
  isCommandMode(): boolean;

  /** Subscribe to command events (after wake word stripped, or all speech in command mode). Returns unsubscribe fn. */
  onCommand(callback: (event: WakeWordEvent) => void): () => void;

  /** Subscribe to wake-word-only events (user said "Hey Tika" with no command after). Returns unsubscribe fn. */
  onWakeWord(callback: () => void): () => void;

  /** Subscribe to state changes. Returns unsubscribe fn. */
  onStateChange(callback: (state: WakeWordState) => void): () => void;
}

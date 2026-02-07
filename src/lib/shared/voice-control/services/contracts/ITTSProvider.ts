/**
 * ITTSProvider
 *
 * Contract for text-to-speech output. Phase 4 uses Web Speech API (free).
 * Upgrade path to ElevenLabs or other providers if quality needs improvement.
 */

export interface ITTSProvider {
  /** Speak the given text aloud. Returns when speech completes or is cancelled. */
  speak(text: string): Promise<void>;
  /** Stop any currently playing speech. */
  cancel(): void;
  /** Whether TTS is supported in this browser. */
  isSupported(): boolean;
  /** Whether speech is currently playing. */
  isSpeaking(): boolean;
}

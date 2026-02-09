/**
 * Records voice command sessions for analysis.
 *
 * Holds the current session in memory during recording.
 * HeyTikaListener calls recordEvent() at each pipeline stage.
 * The session is finalized on endSession() with computed stats.
 */

import type {
  VoiceSession,
  VoiceSessionEvent,
  ResolutionTier,
  LLMResolutionDetails,
  ChatResponseDetails,
} from "../../domain/voice-session-types";
import type { VoiceCommand, CommandResult } from "../../domain/voice-command-types";

export interface RecordEventParams {
  transcript: string;
  speechConfidence: number;
  tier: ResolutionTier;
  interpretedCommand: VoiceCommand | null;
  dispatchResult: CommandResult | null;
  context: { module: string; tab: string };
  latencyMs: number;
  llmDetails?: LLMResolutionDetails;
  chatDetails?: ChatResponseDetails;
}

/** Callback fired when a session ends. Used by HeyTikaListener for auto-save. */
export type SessionEndedCallback = (session: VoiceSession) => void;

export interface IVoiceSessionRecorder {
  /** Start a new recording session. No-op if already recording. */
  startSession(): void;

  /** End the current session and return the finalized session with stats. Returns null if not recording. */
  endSession(): VoiceSession | null;

  /** Whether a session is currently being recorded. */
  isRecording(): boolean;

  /** Get the current in-progress session (events so far, no final stats). Returns null if not recording. */
  getCurrentSession(): { events: VoiceSessionEvent[]; startedAt: Date } | null;

  /** Record a single command event into the current session. No-op if not recording. */
  recordEvent(params: RecordEventParams): void;

  /** Register a callback that fires when a session ends. Used for auto-save. */
  onSessionEnded(callback: SessionEndedCallback | null): void;
}

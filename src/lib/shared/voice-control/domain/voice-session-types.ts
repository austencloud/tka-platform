import type { VoiceCommand, VoiceCommandCategory, CommandResult } from "./voice-command-types";

/**
 * Which tier resolved the command:
 * - tier1_regex: Local regex chain matched (0ms, $0)
 * - tier2_llm: LLM resolved via Haiku (~400ms, ~$0.0004)
 * - tier3_chat: Question routed to TIKA chat (streaming, variable cost)
 * - unresolved: No tier could handle it
 */
export type ResolutionTier = "tier1_regex" | "tier2_llm" | "tier3_chat" | "unresolved";

/** Details captured when Tier 2 LLM is invoked */
export interface LLMResolutionDetails {
  /** Whether the LLM escalated to Tier 3 chat */
  escalatedToChat: boolean;
  /** LLM confidence score (0-1) */
  confidence: number;
  /** Number of commands the LLM resolved from the transcript */
  commandCount: number;
}

/** Details captured when Tier 3 chat is invoked */
export interface ChatResponseDetails {
  /** The AI's spoken response (truncated to 500 chars for storage) */
  responseText: string;
  /** Whether TTS spoke the response */
  spokeTTS: boolean;
}

/**
 * One command's full lifecycle within a voice session.
 */
export interface VoiceSessionEvent {
  /** Auto-incrementing index within the session */
  index: number;
  /** Milliseconds since session start */
  offsetMs: number;
  /** Raw speech transcript from the detector */
  transcript: string;
  /** Speech recognition confidence (0-1) */
  speechConfidence: number;
  /** Which tier resolved this command */
  tier: ResolutionTier;
  /** The interpreted VoiceCommand (null if unresolved) */
  interpretedCommand: VoiceCommand | null;
  /** The dispatch result (null if unresolved or Tier 3 chat) */
  dispatchResult: CommandResult | null;
  /** App context at the time of the command */
  context: {
    module: string;
    tab: string;
  };
  /** Time from transcript receipt to final result */
  latencyMs: number;
  /** Tier 2 details (only present when LLM was invoked) */
  llmDetails?: LLMResolutionDetails;
  /** Tier 3 details (only present when chat was invoked) */
  chatDetails?: ChatResponseDetails;
}

/** Aggregate statistics computed when a session ends */
export interface VoiceSessionStats {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  unresolvedCount: number;
  tierBreakdown: Record<ResolutionTier, number>;
  categoryBreakdown: Record<VoiceCommandCategory | "none", number>;
  avgLatencyMs: number;
  avgLatencyByTier: Partial<Record<ResolutionTier, number>>;
}

/**
 * A complete voice command session with all events.
 */
export interface VoiceSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date;
  /** Duration in milliseconds */
  durationMs: number;
  events: VoiceSessionEvent[];
  stats: VoiceSessionStats;
}

/**
 * Lightweight preview for list views (no events array).
 */
export interface VoiceSessionPreview {
  id: string;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  stats: VoiceSessionStats;
}

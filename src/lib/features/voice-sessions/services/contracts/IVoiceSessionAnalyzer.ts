/**
 * Cross-session pattern analysis for voice command data.
 *
 * Aggregates multiple VoiceSessions to surface actionable insights:
 * which transcripts fail most, which T2 hits should become T1 regex,
 * how success rates trend over time, and where latency spikes.
 */

import type {
  VoiceSession,
  ResolutionTier,
} from "$lib/shared/voice-control/domain/voice-session-types";
import type { VoiceCommandCategory } from "$lib/shared/voice-control/domain/voice-command-types";

// ============================================================================
// Analysis Result Types
// ============================================================================

/** A transcript that failed (unresolved) across multiple sessions */
export interface FailingTranscript {
  /** Normalized transcript text (lowercased, trimmed) */
  transcript: string;
  /** How many times this transcript appeared */
  occurrences: number;
  /** Which tier it landed in each time */
  tierHistory: ResolutionTier[];
  /** Most recent session ID where it appeared */
  lastSeenSessionId: string;
}

/**
 * A transcript that consistently hits T2 LLM with the same interpretation.
 * Prime candidate for promotion to T1 regex.
 */
export interface Tier2Candidate {
  /** Normalized transcript text */
  transcript: string;
  /** The command it consistently resolves to */
  resolvedCategory: VoiceCommandCategory;
  resolvedAction: string;
  resolvedTarget: string;
  /** How many times T2 resolved this the same way */
  consistentHits: number;
  /** Session IDs where this occurred */
  sessionIds: string[];
  /** Average LLM confidence across hits */
  avgConfidence: number;
}

/** Success rate for a single session, used for trend analysis */
export interface SessionSuccessPoint {
  sessionId: string;
  date: Date;
  successRate: number;
  totalEvents: number;
}

/** Average latency grouped by tier */
export interface LatencyByTier {
  tier: ResolutionTier;
  avgMs: number;
  minMs: number;
  maxMs: number;
  sampleCount: number;
}

/** A recurring unresolved transcript pattern */
export interface UnresolvedPattern {
  /** Normalized transcript */
  transcript: string;
  /** Number of occurrences across all sessions */
  occurrences: number;
  /** Module/tab context where it most commonly appears */
  primaryContext: { module: string; tab: string };
}

/** Complete analysis result across multiple sessions */
export interface SessionAnalysis {
  /** Sessions analyzed */
  sessionCount: number;
  /** Total events across all sessions */
  totalEvents: number;
  /** Transcripts that fail most often (sorted by occurrences desc) */
  topFailingTranscripts: FailingTranscript[];
  /** T2 transcripts that resolve consistently - candidates for T1 regex */
  tier2Candidates: Tier2Candidate[];
  /** Per-session success rate over time */
  successRateTrend: SessionSuccessPoint[];
  /** Latency statistics grouped by tier */
  latencyByTier: LatencyByTier[];
  /** Common unresolved transcript patterns */
  unresolvedPatterns: UnresolvedPattern[];
}

// ============================================================================
// Interface
// ============================================================================

export interface IVoiceSessionAnalyzer {
  /** Analyze multiple sessions and return aggregated insights */
  analyzeSessions(sessions: VoiceSession[]): SessionAnalysis;
}

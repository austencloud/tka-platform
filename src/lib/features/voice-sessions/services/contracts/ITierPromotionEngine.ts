/**
 * Auto-generates T1 regex pattern candidates from recurring T2 LLM hits.
 *
 * When a transcript consistently reaches T2 and the LLM resolves it to
 * the same command 5+ times, this engine generates a regex pattern that
 * would catch it at T1. The candidate includes the suggested regex,
 * target command, and which sub-interpreter file to add it to.
 *
 * This does NOT auto-apply patterns. Candidates are reviewed by the
 * /voice-review Claude skill or by a human.
 */

import type { VoiceSession } from "$lib/shared/voice-control/domain/voice-session-types";
import type { PromotionCandidate } from "../../domain/promotion-types";

export interface ITierPromotionEngine {
  /** Analyze sessions and find transcripts that should be promoted from T2 to T1 */
  findPromotionCandidates(sessions: VoiceSession[]): PromotionCandidate[];
}

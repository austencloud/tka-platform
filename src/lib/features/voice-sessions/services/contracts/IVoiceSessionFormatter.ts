/**
 * Formats voice sessions as structured markdown for Claude analysis.
 *
 * Output includes:
 * - Session summary (duration, tier breakdown, success rate, avg latency)
 * - Per-event detail (transcript, tier, command, result, timing)
 * - Analysis prompt asking Claude to identify failure patterns
 */

import type { VoiceSession } from "$lib/shared/voice-control/domain/voice-session-types";

export interface IVoiceSessionFormatter {
  /** Format a complete session for Claude to analyze. */
  formatForAnalysis(session: VoiceSession): string;
}

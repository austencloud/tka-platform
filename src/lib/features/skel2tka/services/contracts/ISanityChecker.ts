/**
 * ISanityChecker - Automated pre-verification checks
 *
 * Runs a battery of automated checks on phase output before
 * presenting it to the user for manual verification.
 * Catches obvious problems early (missing hands, teleporting positions,
 * too few beats) so the user doesn't waste time reviewing garbage data.
 */

import type { Phase1Result } from "../../domain/models";
import type { SanityCheckReport } from "../../domain/verification-models";

export interface ISanityChecker {
  /**
   * Run all sanity checks for Phase 1 (hand tracking) output.
   *
   * Checks:
   * - Both hands detected in >80% of frames
   * - Average confidence >0.6
   * - No teleportation jumps (hand position changes too fast)
   * - At least 2 beats detected
   * - No beat shorter than 200ms
   * - No beat longer than 10s (stuck detection)
   *
   * @returns Report with individual check results and overall severity
   */
  checkPhase1(result: Phase1Result): SanityCheckReport;
}

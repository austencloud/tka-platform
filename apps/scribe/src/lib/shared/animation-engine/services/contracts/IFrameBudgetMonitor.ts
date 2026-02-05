/**
 * Frame Budget Monitor Interface
 *
 * Monitors frame times and provides quality hints for adaptive rendering.
 * Uses rolling averages and hysteresis to prevent oscillation.
 */

import type { QualityHints, QualityAdaptationConfig } from "../../domain/types/QualityTypes";

export interface IFrameBudgetMonitor {
  /**
   * Mark the beginning of a frame. Call at the start of each render().
   * Returns a timestamp to pass to endFrame().
   */
  beginFrame(): number;

  /**
   * Mark the end of a frame. Pass the value returned by beginFrame().
   * Updates rolling frame time averages and may trigger tier changes.
   */
  endFrame(startTime: number): void;

  /**
   * Get current quality hints for renderers.
   * These reflect the current tier and its associated parameters.
   */
  getQualityHints(): QualityHints;

  /**
   * Override the adaptation config at runtime
   */
  setConfig(config: Partial<QualityAdaptationConfig>): void;

  /**
   * Reset to initial state (e.g., on sequence change)
   */
  reset(): void;
}

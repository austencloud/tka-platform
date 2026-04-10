import type { PoseDefinition } from "../../domain/types";

/**
 * Generates the canonical enumeration of poses for a given mode.
 *
 * The order is deterministic so "pose 47 of 192" means the same thing
 * between sessions, tests, and exported JSON files.
 */
export interface IPoseEnumerator {
  /**
   * Enumerate all diamond-mode in/out two-hand poses:
   * 3 planes × (4 cardinals × 2 orientations)² = 192 poses.
   */
  enumerateDiamondInOut(): PoseDefinition[];
}

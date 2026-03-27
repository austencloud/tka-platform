import type { GridTopology } from "$lib/shared/multi-grid/domain/models/GridTopology";
import type { JunctionOverlap, PropPlacement } from "../../domain/types";

/**
 * Detects when both props occupy refs that resolve to the same junction point.
 *
 * Works with any topology size (2-grid, 3-grid, N-grid) because it iterates
 * over the topology's junction list rather than assuming a fixed layout.
 */
export interface IJunctionOverlapDetector {
  detectOverlaps(topology: GridTopology, placement: PropPlacement): JunctionOverlap[];
}

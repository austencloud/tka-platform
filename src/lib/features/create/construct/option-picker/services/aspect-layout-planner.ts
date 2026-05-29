/**
 * Aspect Layout Planner
 *
 * Determines row arrangement for grouped sections based on aspect ratio.
 * Extracted from OptionViewer456Group.svelte's calculateOptimalLayout function.
 */

import type { LayoutRow, TypeCount } from "./types";

// Aspect ratio thresholds
const PORTRAIT_MAX = 0.6;
const LANDSCAPE_MIN = 1.6;

/**
 * Calculate optimal layout based on container aspect ratio.
 */
export function calculateOptimalLayout(
  typeCounts: TypeCount[],
  containerWidth: number,
  containerHeight: number
): LayoutRow[] {
  const hasMultipleTypes = typeCounts.length > 1;

  // Single type: always use full width
  if (!hasMultipleTypes) {
    return [
      {
        types: typeCounts.map((item) => item.type),
        containerWidth,
        layout: "single",
      },
    ];
  }

  const aspectRatio = containerWidth / containerHeight;

  /**
   * ASPECT RATIO LAYOUT STRATEGY:
   *
   * Portrait (aspectRatio < 0.6): Stack vertically (3 rows)
   * - Type 4 on top
   * - Type 5 in middle
   * - Type 6 on bottom
   *
   * Square-ish (0.6 <= aspectRatio < 1.6): 2-row layout
   * - Row 1: Type 4 (full width)
   * - Row 2: Types 5 & 6 (side by side)
   *
   * Wide/Landscape (aspectRatio >= 1.6): Single row
   * - Type 4 | Type 5 | Type 6 (left to right)
   */

  if (aspectRatio < PORTRAIT_MAX) {
    // Portrait: Stack vertically (only for very tall layouts)
    return typeCounts.map((item) => ({
      types: [item.type],
      containerWidth,
      layout: "vertical" as const,
    }));
  }

  if (aspectRatio < LANDSCAPE_MIN) {
    // Square-ish: 2-row layout (Type 4 on top, Types 5&6 below)
    return [
      {
        types: [typeCounts[0]?.type || "Type4"],
        containerWidth,
        layout: "row-1" as const,
      },
      {
        types: typeCounts.slice(1).map((item) => item.type),
        containerWidth,
        layout: "row-2" as const,
      },
    ];
  }

  // Wide/Landscape: Single horizontal row
  return [
    {
      types: typeCounts.map((item) => item.type),
      containerWidth,
      layout: "horizontal" as const,
    },
  ];
}

/**
 * Get aspect ratio thresholds used for layout decisions.
 */
export function getThresholds(): { portraitMax: number; landscapeMin: number } {
  return {
    portraitMax: PORTRAIT_MAX,
    landscapeMin: LANDSCAPE_MIN,
  };
}

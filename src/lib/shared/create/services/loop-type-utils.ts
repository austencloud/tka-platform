/**
 * LOOP Type Utility Functions
 *
 * Standalone pure functions extracted from the deleted LOOPTypeResolver class.
 * - parseLoopComponents: parse a LOOPType string into a Set of LOOPComponents
 * - generateLOOPType: map a Set of LOOPComponents back to a LOOPType enum value
 * - formatLOOPTypeForDisplay: human-readable formatting of a LOOPType string
 */

import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";

/**
 * Parse a LOOPType string into a Set of LOOPComponent values.
 * Uses substring matching against the 6 transformation primitives.
 */
export function parseLoopComponents(loopType: LOOPType | string | null | undefined): Set<LOOPComponent> {
  const components = new Set<LOOPComponent>();
  if (!loopType) return components;

  if (loopType.includes("rotated")) components.add(LOOPComponent.ROTATED);
  if (loopType.includes("mirrored")) components.add(LOOPComponent.MIRRORED);
  if (loopType.includes("flipped")) components.add(LOOPComponent.FLIPPED);
  if (loopType.includes("swapped")) components.add(LOOPComponent.SWAPPED);
  if (loopType.includes("inverted")) components.add(LOOPComponent.INVERTED);
  if (loopType.includes("rewound")) components.add(LOOPComponent.REWOUND);

  return components;
}

/**
 * Map a set of LOOPComponents to a LOOPType enum value.
 * Returns LOOPType.ROTATED as fallback for unrecognized combinations.
 */
export function generateLOOPType(components: Set<LOOPComponent>): LOOPType {
  if (components.size === 0) return LOOPType.ROTATED;

  const sorted = Array.from(components).sort();

  if (sorted.length === 1) {
    switch (sorted[0]) {
      case LOOPComponent.ROTATED:
        return LOOPType.ROTATED;
      case LOOPComponent.MIRRORED:
        return LOOPType.MIRRORED;
      case LOOPComponent.FLIPPED:
        return LOOPType.FLIPPED;
      case LOOPComponent.SWAPPED:
        return LOOPType.SWAPPED;
      case LOOPComponent.INVERTED:
        return LOOPType.INVERTED;
      case LOOPComponent.REWOUND:
        return LOOPType.STRICT_REWOUND;
    }
  }

  if (sorted.length === 2) {
    const [first, second] = sorted;
    if (first === LOOPComponent.INVERTED && second === LOOPComponent.MIRRORED)
      return LOOPType.MIRRORED_INVERTED;
    if (first === LOOPComponent.INVERTED && second === LOOPComponent.ROTATED)
      return LOOPType.ROTATED_INVERTED;
    if (first === LOOPComponent.INVERTED && second === LOOPComponent.SWAPPED)
      return LOOPType.SWAPPED_INVERTED;
    if (first === LOOPComponent.MIRRORED && second === LOOPComponent.ROTATED)
      return LOOPType.MIRRORED_ROTATED;
    if (first === LOOPComponent.MIRRORED && second === LOOPComponent.SWAPPED)
      return LOOPType.MIRRORED_SWAPPED;
    if (first === LOOPComponent.ROTATED && second === LOOPComponent.SWAPPED)
      return LOOPType.ROTATED_SWAPPED;
  }

  if (sorted.length === 3) {
    const componentSet = new Set(sorted);
    if (
      componentSet.has(LOOPComponent.MIRRORED) &&
      componentSet.has(LOOPComponent.INVERTED) &&
      componentSet.has(LOOPComponent.ROTATED)
    ) {
      return LOOPType.MIRRORED_INVERTED_ROTATED;
    }
    if (
      componentSet.has(LOOPComponent.MIRRORED) &&
      componentSet.has(LOOPComponent.ROTATED) &&
      componentSet.has(LOOPComponent.SWAPPED)
    ) {
      return LOOPType.MIRRORED_ROTATED_SWAPPED;
    }
  }

  if (sorted.length === 4) {
    const componentSet = new Set(sorted);
    if (
      componentSet.has(LOOPComponent.MIRRORED) &&
      componentSet.has(LOOPComponent.INVERTED) &&
      componentSet.has(LOOPComponent.ROTATED) &&
      componentSet.has(LOOPComponent.SWAPPED)
    ) {
      return LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED;
    }
  }

  // Fallback for unrecognized combinations
  return LOOPType.ROTATED;
}

/**
 * Format a LOOPType string for human-readable UI display.
 */
export function formatLOOPTypeForDisplay(loopType: LOOPType | string): string {
  const readable = loopType
    .replace(/^strict_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());

  if (readable.length > 20) {
    const parts = readable.split(" ");
    if (parts.length > 2) {
      return `${parts[0]} + ${parts.length - 1} more`;
    }
  }

  return readable;
}

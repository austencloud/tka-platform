import { LOOPType } from "../../../circular/domain/models/circular-models";
import { LOOPComponent } from "../../domain/models/generate-models";
import type { ILOOPTypeResolver } from "../contracts/ILOOPTypeResolver";

/**
 * Service implementing LOOP type parsing and generation algorithms
 *
 * Extracted from LOOPCard.svelte (lines 70-123, 172-185) to separate pure
 * algorithmic logic from UI concerns. This service contains the complex
 * conditional logic for mapping between component sets and LOOP type enums.
 */
export class LOOPTypeResolver implements ILOOPTypeResolver {
  /**
   * Parse LOOP type to extract components
   * Handles all 6 primitives: rotated, mirrored, flipped, swapped, inverted, rewound
   */
  parseComponents(loopType: LOOPType): Set<LOOPComponent> {
    const components = new Set<LOOPComponent>();

    // Guard against undefined/null loopType
    if (!loopType) {
      return components;
    }

    // Parse all 6 primitives from the loopType string
    if (loopType.includes("rotated")) components.add(LOOPComponent.ROTATED);
    if (loopType.includes("mirrored")) components.add(LOOPComponent.MIRRORED);
    if (loopType.includes("flipped")) components.add(LOOPComponent.FLIPPED);
    if (loopType.includes("swapped")) components.add(LOOPComponent.SWAPPED);
    if (loopType.includes("inverted")) components.add(LOOPComponent.INVERTED);
    if (loopType.includes("rewound")) components.add(LOOPComponent.REWOUND);

    return components;
  }

  /**
   * Check if a LOOP type combination is implemented
   */
  isImplemented(components: Set<LOOPComponent>): boolean {
    if (components.size === 0) return true;

    const sorted = Array.from(components).sort();

    // All single components are implemented
    if (sorted.length === 1) return true;

    // Two components
    if (sorted.length === 2) {
      // All 2-component combinations are now implemented (including MIRRORED_ROTATED)
      return true;
    }

    // Three components
    if (sorted.length === 3) {
      const componentSet = new Set(sorted);
      const hasMirrored = componentSet.has(LOOPComponent.MIRRORED);
      const hasInverted = componentSet.has(LOOPComponent.INVERTED);
      const hasRotated = componentSet.has(LOOPComponent.ROTATED);

      // Only Mirrored + Inverted + Rotated is implemented
      if (hasMirrored && hasInverted && hasRotated) {
        return true;
      }
      return false; // Other 3-component combinations not yet implemented
    }

    // Four components
    if (sorted.length === 4) {
      const componentSet = new Set(sorted);
      const hasMirrored = componentSet.has(LOOPComponent.MIRRORED);
      const hasInverted = componentSet.has(LOOPComponent.INVERTED);
      const hasRotated = componentSet.has(LOOPComponent.ROTATED);
      const hasSwapped = componentSet.has(LOOPComponent.SWAPPED);

      // Only Mirrored + Inverted + Rotated + Swapped is implemented
      if (hasMirrored && hasInverted && hasRotated && hasSwapped) {
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Generate LOOP type from selected components
   * EXACT ORIGINAL LOGIC from LOOPCard.svelte lines 82-123
   */
  generateLOOPType(components: Set<LOOPComponent>): LOOPType {
    if (components.size === 0) return LOOPType.ROTATED;

    const sorted = Array.from(components).sort();

    // Single components (strict)
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

    // Two components
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

    // Three components
    if (sorted.length === 3) {
      const componentSet = new Set(sorted);
      // Only Mirrored + Inverted + Rotated is implemented
      if (
        componentSet.has(LOOPComponent.MIRRORED) &&
        componentSet.has(LOOPComponent.INVERTED) &&
        componentSet.has(LOOPComponent.ROTATED)
      ) {
        return LOOPType.MIRRORED_INVERTED_ROTATED;
      }
    }

    // Four components
    if (sorted.length === 4) {
      const componentSet = new Set(sorted);
      // Only Mirrored + Inverted + Rotated + Swapped is implemented
      if (
        componentSet.has(LOOPComponent.MIRRORED) &&
        componentSet.has(LOOPComponent.INVERTED) &&
        componentSet.has(LOOPComponent.ROTATED) &&
        componentSet.has(LOOPComponent.SWAPPED)
      ) {
        return LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED;
      }
    }

    // Fallback for unimplemented combinations
    return LOOPType.ROTATED;
  }

  /**
   * Format LOOP type for display in UI
   * EXACT ORIGINAL LOGIC from LOOPCard.svelte lines 172-185
   */
  formatForDisplay(loopType: LOOPType): string {
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
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopTypeResolver = new LOOPTypeResolver();

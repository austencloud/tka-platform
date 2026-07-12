/**
 * LOOP Validator Implementation
 *
 * Validates which LOOP (Linked Orbital Offset Pattern) types are available
 * for a given position pair based on position symmetry rules.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { LOOPExecutorSelector } from "$lib/features/create/generate/circular/services/loop-executor-selector";
import {
  LOOPType,
  LOOP_TYPE_LABELS,
  Period,
} from "$lib/shared/foundation/domain/models/generation/circular-models";

/**
 * Describes a single LOOP option available for extension
 */
export interface LOOPOption {
  /** The LOOP type */
  loopType: LOOPType;
  /** Human-readable name */
  name: string;
  /** Short description of what this LOOP does */
  description: string;
  /** Icon class (FontAwesome) */
  icon: string;
}

/**
 * Result of validating LOOP options for a position pair
 */
export interface LOOPValidationResult {
  /** LOOP options that are valid for this position pair */
  available: LOOPOption[];
  /** LOOP options that exist but aren't valid for this position pair */
  unavailable: LOOPOption[];
}
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "$lib/shared/foundation/domain/models/generation/circular-position-maps";
import {
  MIRRORED_LOOP_VALIDATION_SET,
  FLIPPED_LOOP_VALIDATION_SET,
  SWAPPED_LOOP_VALIDATION_SET,
  INVERTED_LOOP_VALIDATION_SET,
  MIRRORED_SWAPPED_VALIDATION_SET,
  ROTATED_SWAPPED_QUARTERED_VALIDATION_SET,
  ROTATED_SWAPPED_HALVED_VALIDATION_SET,
} from "$lib/features/create/generate/circular/domain/constants/strict-loop-position-maps";

/**
 * LOOP options with icons and descriptions for UI display.
 * LOOP = Linked Orbital Offset Pattern (TKA's algorithmic extension patterns)
 */
const LOOP_OPTION_CONFIG: Record<
  LOOPType,
  { icon: string; description: string }
> = {
  [LOOPType.ROTATED]: {
    icon: "fa-rotate",
    description: "Rotates positions around the grid",
  },
  [LOOPType.MIRRORED]: {
    icon: "fa-reflect-horizontal",
    description: "Mirrors positions vertically",
  },
  [LOOPType.FLIPPED]: {
    icon: "fa-arrows-up-down",
    description: "Mirrors positions horizontally",
  },
  [LOOPType.SWAPPED]: {
    icon: "fa-shuffle",
    description: "Swaps blue and red props",
  },
  [LOOPType.INVERTED]: {
    icon: "fa-arrows-up-down",
    description: "Inverts motion directions",
  },
  [LOOPType.SWAPPED_INVERTED]: {
    icon: "fa-arrows-rotate",
    description: "Swaps colors with inverted motion",
  },
  [LOOPType.ROTATED_INVERTED]: {
    icon: "fa-rotate-left",
    description: "Rotates with inverted motion",
  },
  [LOOPType.MIRRORED_SWAPPED]: {
    icon: "fa-clone",
    description: "Mirrors with color swap",
  },
  [LOOPType.MIRRORED_INVERTED]: {
    icon: "fa-arrows-to-line",
    description: "Mirrors with inverted motion",
  },
  [LOOPType.ROTATED_SWAPPED]: {
    icon: "fa-recycle",
    description: "Rotates with color swap",
  },
  [LOOPType.MIRRORED_ROTATED]: {
    icon: "fa-repeat",
    description: "Combines mirroring and rotation",
  },
  [LOOPType.MIRRORED_INVERTED_ROTATED]: {
    icon: "fa-diagram-project",
    description: "Mirror, invert, and rotate",
  },
  [LOOPType.MIRRORED_SWAPPED_INVERTED]: {
    icon: "fa-arrows-spin",
    description: "Mirror, swap colors, and invert motion",
  },
  [LOOPType.MIRRORED_ROTATED_SWAPPED]: {
    icon: "fa-object-group",
    description: "Mirror, rotate, and swap colors",
  },
  [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED]: {
    icon: "fa-circle-nodes",
    description: "All four transformations combined",
  },
  [LOOPType.STRICT_REWOUND]: {
    icon: "fa-backward",
    description: "Appends reversed sequence to double length",
  },
};

/** All supported LOOP types in display order */
const ALL_LOOP_TYPES = [
  LOOPType.ROTATED,
  LOOPType.MIRRORED,
  LOOPType.FLIPPED,
  LOOPType.SWAPPED,
  LOOPType.INVERTED,
  LOOPType.SWAPPED_INVERTED,
  LOOPType.ROTATED_INVERTED,
  LOOPType.MIRRORED_SWAPPED,
  LOOPType.MIRRORED_INVERTED,
  LOOPType.ROTATED_SWAPPED,
  LOOPType.MIRRORED_ROTATED,
  LOOPType.MIRRORED_INVERTED_ROTATED,
  LOOPType.MIRRORED_SWAPPED_INVERTED,
  LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
  LOOPType.STRICT_REWOUND,
];

export class LOOPValidator {
  constructor(private loopExecutorSelector: LOOPExecutorSelector) {}

  /**
   * Get LOOP options filtered by validity for a position pair
   */
  getLOOPOptionsForPositionPair(
    startPosition: GridPosition,
    endPosition: GridPosition,
    period: Period
  ): LOOPValidationResult {
    const available: LOOPOption[] = [];
    const unavailable: LOOPOption[] = [];
    const positionPair = `${startPosition},${endPosition}`;

    for (const loopType of ALL_LOOP_TYPES) {
      if (!this.loopExecutorSelector.isSupported(loopType)) {
        continue;
      }

      const config = LOOP_OPTION_CONFIG[loopType];
      const option: LOOPOption = {
        loopType,
        name: LOOP_TYPE_LABELS[loopType],
        description: config.description,
        icon: config.icon,
      };

      if (this.isLOOPValidForPositionPair(loopType, positionPair, period)) {
        available.push(option);
      } else {
        unavailable.push(option);
      }
    }

    return { available, unavailable };
  }

  /**
   * Check if a LOOP type is valid for a given position pair
   */
  isLOOPValidForPositionPair(
    loopType: LOOPType,
    positionPair: string,
    period: Period
  ): boolean {
    // Rotated LOOPs use rotation-based validation
    const rotationSet =
      period === Period.QUARTERED ? QUARTERED_LOOPS : HALVED_LOOPS;

    // Rotated+Swapped LOOPs need composed validation (rotation THEN swap)
    const rotatedSwappedSet =
      period === Period.QUARTERED
        ? ROTATED_SWAPPED_QUARTERED_VALIDATION_SET
        : ROTATED_SWAPPED_HALVED_VALIDATION_SET;

    switch (loopType) {
      // Pure rotation-based LOOPs (no swap component)
      case LOOPType.ROTATED:
      case LOOPType.ROTATED_INVERTED:
        return rotationSet.has(positionPair);

      // Rotated + Swapped: end must be SWAPPED(ROTATED(start))
      case LOOPType.ROTATED_SWAPPED:
        return rotatedSwappedSet.has(positionPair);

      // Pure mirror-based LOOPs (no rotation component)
      case LOOPType.MIRRORED:
      case LOOPType.MIRRORED_INVERTED:
        return MIRRORED_LOOP_VALIDATION_SET.has(positionPair);

      // Flipped LOOP (N ↔ S)
      case LOOPType.FLIPPED:
        return FLIPPED_LOOP_VALIDATION_SET.has(positionPair);

      // Mirrored + Swapped (uses composed validation set)
      case LOOPType.MIRRORED_SWAPPED:
        return MIRRORED_SWAPPED_VALIDATION_SET.has(positionPair);

      // Compound LOOPs containing ROTATED - need BOTH mirror AND rotation validation
      case LOOPType.MIRRORED_ROTATED:
      case LOOPType.MIRRORED_INVERTED_ROTATED:
      case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
        return (
          MIRRORED_LOOP_VALIDATION_SET.has(positionPair) &&
          rotationSet.has(positionPair)
        );

      // Swap-based LOOPs
      case LOOPType.SWAPPED:
      case LOOPType.SWAPPED_INVERTED:
        return SWAPPED_LOOP_VALIDATION_SET.has(positionPair);

      // Invert-only LOOP (needs same start/end position)
      case LOOPType.INVERTED:
        return INVERTED_LOOP_VALIDATION_SET.has(positionPair);

      // Mirrored + Swapped + Inverted: inverted dominates positionally —
      // the sequence must return to its start (same rule its executor enforces)
      case LOOPType.MIRRORED_SWAPPED_INVERTED:
        return INVERTED_LOOP_VALIDATION_SET.has(positionPair);

      // Rewound LOOP - always valid (works on any sequence regardless of positions)
      case LOOPType.STRICT_REWOUND:
        return true;

      default:
        // Unknown LOOP type - assume not valid
        return false;
    }
  }

  /**
   * Get all supported LOOP options (regardless of position validity)
   */
  getAllSupportedLOOPOptions(): LOOPOption[] {
    const options: LOOPOption[] = [];

    for (const loopType of ALL_LOOP_TYPES) {
      if (this.loopExecutorSelector.isSupported(loopType)) {
        const config = LOOP_OPTION_CONFIG[loopType];
        options.push({
          loopType,
          name: LOOP_TYPE_LABELS[loopType],
          description: config.description,
          icon: config.icon,
        });
      }
    }

    return options;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { loopExecutorSelector } from "$lib/features/create/generate/circular/services/loop-executor-selector";

export const loopValidator = new LOOPValidator(loopExecutorSelector);

import type { Period } from "$lib/features/create/generate/circular/domain/models/circular-models";

/**
 * Base LOOP component ID
 */
export type ComponentId =
  | "rotated"
  | "swapped"
  | "mirrored"
  | "flipped"
  | "inverted"
  | "rewound"
  | "repeated"
  | "modular";

/**
 * LOOP designation for a sequence or section
 */
export interface LOOPDesignation {
  components: ComponentId[];
  loopType: string | null;
  period?: Period | null; // Only relevant when "rotated" component is selected
}

/**
 * Section designation for a subset of steps
 */
export interface SectionDesignation {
  steps: number[]; // Beat numbers in this section
  components: ComponentId[];
  loopType: string | null;
  period?: Period | null; // Only relevant when "rotated" component is selected
}

/**
 * Service for formatting and managing LOOP designations
 */
export interface ILOOPDesignator {
  /**
   * Format a designation for display
   */
  formatDesignation(designation: LOOPDesignation | SectionDesignation): string;

  /**
   * Format section steps for display (e.g., "1-4" or "1,3,5")
   */
  formatSectionSteps(steps: number[]): string;

  /**
   * Check if a designation is a duplicate of existing designations
   */
  isDuplicateDesignation(
    designation: LOOPDesignation,
    existing: LOOPDesignation[]
  ): boolean;
}

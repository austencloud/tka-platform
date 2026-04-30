import type { SectionDesignation } from "../../domain/models/section-models";
import type { TransformationIntervals } from "../../domain/models/label-models";
import type { ComponentId } from "../../domain/constants/loop-components";
import type { Period } from "$lib/features/create/generate/circular/domain/models/circular-models";

export interface LOOPDesignationInput {
  components: ComponentId[];
  loopType: string | null;
  period?: Period | null;
  transformationIntervals?: TransformationIntervals;
}

/**
 * Formats LOOP designations and section step ranges for display.
 */
export interface ILabelFormatter {
  /**
   * Format a designation for display.
   * Works with both LOOPDesignationInput and SectionDesignation.
   */
  formatDesignation(d: LOOPDesignationInput | SectionDesignation): string;

  /**
   * Format a list of step numbers for display (e.g., "Steps 1-4" or "Steps 1, 3, 5").
   */
  formatSectionSteps(steps: number[]): string;
}

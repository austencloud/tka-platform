/**
 * Service contract for generating LOOP transformation explanation text
 */

import type { LOOPComponent } from "../../domain/models/generate-models";

/**
 * Generates user-friendly explanation text for LOOP transformations
 */
export interface ILOOPExplanationTextGenerator {
  /**
   * Generate explanation text based on selected LOOP components
   * @param selectedComponents Set of selected LOOP components
   * @returns Human-readable explanation text
   */
  generateExplanationText(selectedComponents: Set<LOOPComponent>): string;
}

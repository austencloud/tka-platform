/**
 * LOOPExplanationTextGenerator - Generates explanation text for LOOP transformations
 */

import { LOOPComponent } from "../../domain/models/generate-models";
import { LOOP_COMPONENTS } from "../../domain/constants/loop-constants";
import type { ILOOPExplanationTextGenerator } from "../contracts/ILOOPExplanationTextGenerator";

/**
 * Service for generating user-friendly explanation text for LOOP transformations
 */
export class LOOPExplanationTextGenerator implements ILOOPExplanationTextGenerator {
  /**
   * Descriptions for each LOOP transformation type
   * Kept in the service layer as they're only used for explanation generation
   */
  private readonly descriptions: Record<LOOPComponent, string> = {
    [LOOPComponent.ROTATED]:
      "Rotates the sequence 180 degrees, flipping all movements to their opposite positions.",
    [LOOPComponent.MIRRORED]:
      "Mirrors the sequence horizontally, creating a reflection of all movements.",
    [LOOPComponent.SWAPPED]:
      "Swaps the left and right hand movements throughout the sequence.",
    [LOOPComponent.INVERTED]:
      "Applies inverted transformations to create variations of the base sequence.",
  };

  /**
   * Generate explanation text based on selected components
   */
  public generateExplanationText(
    selectedComponents: Set<LOOPComponent>
  ): string {
    const selected = Array.from(selectedComponents);

    if (selected.length === 0) {
      return "Select one or more LOOP types to transform your sequence. You can combine multiple transformations for complex variations.";
    }

    if (selected.length === 1) {
      const component = selected[0]!;
      const componentInfo = LOOP_COMPONENTS.find(
        (c) => c.component === component
      )!;
      const description = this.descriptions[component];
      return `Your sequence will be ${componentInfo.label.toLowerCase()}: ${description}`;
    }

    const labels = selected
      .map((c) => LOOP_COMPONENTS.find((comp) => comp.component === c)!.label)
      .join(" + ");
    return `Your sequence will combine ${labels}: This creates a complex transformation by applying all selected operations in sequence.`;
  }
}

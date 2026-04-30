/**
 * Turn Color Interpreter
 *
 * Determines which color (blue or red) to apply to top and bottom turn numbers
 * based on the letter type and motion arrangement.
 *
 * Color is determined by which key ("blue"/"red") a motion lives under in
 * pictographData.motions - NOT by the motion.color property, which is often
 * undefined when data is deserialized from storage.
 *
 * Ported from legacy TurnsTupleInterpreter logic.
 */

import type { PictographData } from "../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import { getMotionColor } from "../../../../utils/svg-color-utils";
import { MotionColor } from "../../../shared/domain/enums/pictograph-enums";

export type TurnNumberColor = string; // Color hex string from getMotionColor

export interface TurnColors {
  top: TurnNumberColor;
  bottom: TurnNumberColor;
}

type LetterType =
  | "TYPE1_HYBRID"
  | "TYPE1_NON_HYBRID"
  | "TYPE2"
  | "TYPE3"
  | "TYPE4"
  | "TYPE5"
  | "TYPE6";

const BLUE_HEX: TurnNumberColor = getMotionColor(MotionColor.BLUE, "dark");
const RED_HEX: TurnNumberColor = getMotionColor(MotionColor.RED, "dark");

export class TurnColorInterpreter {
  /**
   * Determine the colors for top and bottom turn numbers.
   *
   * Color assignment is based on which motions object key ("blue"/"red")
   * the motion was extracted from - NOT motion.color, which is unreliable
   * for data loaded from storage.
   */
  interpretTurnColors(
    letter: string | null | undefined,
    pictographData?: PictographData | null
  ): TurnColors {
    if (!letter || !pictographData) {
      // Default: top = blue, bottom = red
      return { top: BLUE_HEX, bottom: RED_HEX };
    }

    const letterType = this.determineLetterType(letter);
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;

    if (!blueMotion || !redMotion) {
      return { top: BLUE_HEX, bottom: RED_HEX };
    }

    // Helper: returns the correct hex color based on whether the motion
    // is the blue-hand or red-hand motion (identity comparison).
    const colorOf = (motion: MotionData): TurnNumberColor =>
      motion === blueMotion ? BLUE_HEX : RED_HEX;

    switch (letterType) {
      case "TYPE2": {
        // Top = Shift motion, Bottom = Static motion
        const shiftMotion = this.isShiftMotion(blueMotion)
          ? blueMotion
          : redMotion;
        const staticMotion = this.isShiftMotion(blueMotion)
          ? redMotion
          : blueMotion;
        return {
          top: colorOf(shiftMotion),
          bottom: colorOf(staticMotion),
        };
      }

      case "TYPE1_HYBRID": {
        // Top = Pro motion, Bottom = Anti motion
        const blueActualType = this.getActualMotionType(blueMotion);

        const proMotion = blueActualType === "pro" ? blueMotion : redMotion;
        const antiMotion = blueActualType === "anti" ? blueMotion : redMotion;

        return {
          top: colorOf(proMotion),
          bottom: colorOf(antiMotion),
        };
      }

      case "TYPE3": {
        // Top = Shift motion, Bottom = Dash motion
        const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
        const shiftMotion = isDashBlue ? redMotion : blueMotion;
        const dashMotion = isDashBlue ? blueMotion : redMotion;
        return {
          top: colorOf(shiftMotion),
          bottom: colorOf(dashMotion),
        };
      }

      case "TYPE4": {
        // Top = Dash motion, Bottom = Static motion
        const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
        const dashMotion = isDashBlue ? blueMotion : redMotion;
        const staticMotion = isDashBlue ? redMotion : blueMotion;
        return {
          top: colorOf(dashMotion),
          bottom: colorOf(staticMotion),
        };
      }

      case "TYPE5":
      case "TYPE6":
      default: {
        // Top = Blue motion, Bottom = Red motion
        return {
          top: BLUE_HEX,
          bottom: RED_HEX,
        };
      }
    }
  }

  /**
   * Determine letter type based on letter pattern
   */
  private determineLetterType(letter: string): LetterType {
    // TYPE5: Dash-Static letters with suffix (Φ-, Ψ-, Λ-)
    if (["Φ-", "Ψ-", "Λ-"].includes(letter)) {
      return "TYPE5";
    }

    // TYPE6: Beta letters (α, β, γ)
    if (["α", "β", "γ"].includes(letter)) {
      return "TYPE6";
    }

    // TYPE3: Cross-Shift letters (ending with '-' except TYPE5)
    if (letter.endsWith("-")) {
      return "TYPE3";
    }

    // TYPE4: Dash letters (Φ, Ψ, Λ)
    if (["Φ", "Ψ", "Λ"].includes(letter)) {
      return "TYPE4";
    }

    // TYPE2: Shift-only letters (W, X, Y, Z, Σ, Δ, Θ, Ω)
    if (["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"].includes(letter)) {
      return "TYPE2";
    }

    // TYPE1 Hybrid: Specific shift-static letters
    if (["C", "F", "I", "L", "O", "R", "U", "V"].includes(letter)) {
      return "TYPE1_HYBRID";
    }

    // TYPE1 Non-Hybrid: All other standard letters
    return "TYPE1_NON_HYBRID";
  }

  /**
   * Get the actual motion type, considering prefloat motion type for float motions
   */
  private getActualMotionType(motion: MotionData): string {
    const motionType = (motion as unknown as Record<string, unknown>)
      .motionType;
    const motionTypeStr =
      typeof motionType === "string" ? motionType.toLowerCase() : "";

    // If it's a float motion, use the prefloatMotionType instead
    if (motionTypeStr === "float") {
      const prefloatType = (motion as unknown as Record<string, unknown>)
        .prefloatMotionType;
      if (typeof prefloatType === "string") {
        return prefloatType.toLowerCase();
      }
    }
    return motionTypeStr;
  }

  /**
   * Check if a motion is a shift motion (pro/anti/float)
   */
  private isShiftMotion(motion: MotionData): boolean {
    const motionType = (motion as unknown as Record<string, unknown>)
      .motionType;
    const motionTypeStr =
      typeof motionType === "string" ? motionType.toLowerCase() : "";
    return ["pro", "anti", "float"].includes(motionTypeStr);
  }
}

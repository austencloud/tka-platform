/**
 * Turn Color Interpreter
 *
 * Determines which color (blue or red) to apply to top and bottom turn numbers
 * based on the letter type and motion arrangement.
 */

import type { PictographData, MotionData } from "@tka/types";
import { MotionColor } from "@tka/types";
import { getMotionColor } from "../../../utils/svg-color-utils";
import type {
  ITurnColorInterpreter,
  TurnColors,
  TurnNumberColor,
} from "../contracts/ITurnColorInterpreter";

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

export class TurnColorInterpreter implements ITurnColorInterpreter {
  interpretTurnColors(
    letter: string | null | undefined,
    pictographData?: PictographData
  ): TurnColors {
    if (!letter || !pictographData) {
      return { top: BLUE_HEX, bottom: RED_HEX };
    }

    const letterType = this.determineLetterType(letter);
    const blueMotion = pictographData.motions?.blue;
    const redMotion = pictographData.motions?.red;

    if (!blueMotion || !redMotion) {
      return { top: BLUE_HEX, bottom: RED_HEX };
    }

    const blueColor = this.resolveMotionColor(blueMotion.color);
    const redColor = this.resolveMotionColor(redMotion.color);

    switch (letterType) {
      case "TYPE2": {
        const shiftMotion = this.isShiftMotion(blueMotion)
          ? blueMotion
          : redMotion;
        const staticMotion = this.isShiftMotion(blueMotion)
          ? redMotion
          : blueMotion;
        return {
          top: this.resolveMotionColor(shiftMotion.color),
          bottom: this.resolveMotionColor(staticMotion.color),
        };
      }

      case "TYPE1_HYBRID": {
        const blueActualType = this.getActualMotionType(blueMotion);
        const proMotion = blueActualType === "pro" ? blueMotion : redMotion;
        const antiMotion = blueActualType === "anti" ? blueMotion : redMotion;
        return {
          top: this.resolveMotionColor(proMotion.color),
          bottom: this.resolveMotionColor(antiMotion.color),
        };
      }

      case "TYPE3": {
        const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
        const shiftMotion = isDashBlue ? redMotion : blueMotion;
        const dashMotion = isDashBlue ? blueMotion : redMotion;
        return {
          top: this.resolveMotionColor(shiftMotion.color),
          bottom: this.resolveMotionColor(dashMotion.color),
        };
      }

      case "TYPE4": {
        const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
        const dashMotion = isDashBlue ? blueMotion : redMotion;
        const staticMotion = isDashBlue ? redMotion : blueMotion;
        return {
          top: this.resolveMotionColor(dashMotion.color),
          bottom: this.resolveMotionColor(staticMotion.color),
        };
      }

      case "TYPE5":
      case "TYPE6":
      default: {
        return { top: blueColor, bottom: redColor };
      }
    }
  }

  private determineLetterType(letter: string): LetterType {
    if (["Φ-", "Ψ-", "Λ-"].includes(letter)) return "TYPE5";
    if (["α", "β", "γ"].includes(letter)) return "TYPE6";
    if (letter.endsWith("-")) return "TYPE3";
    if (["Φ", "Ψ", "Λ"].includes(letter)) return "TYPE4";
    if (["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"].includes(letter)) return "TYPE2";
    if (["C", "F", "I", "L", "O", "R", "U", "V"].includes(letter)) return "TYPE1_HYBRID";
    return "TYPE1_NON_HYBRID";
  }

  private getActualMotionType(motion: MotionData): string {
    const motionType = (motion as unknown as Record<string, unknown>).motionType;
    const motionTypeStr = typeof motionType === "string" ? motionType.toLowerCase() : "";

    if (motionTypeStr === "float") {
      const prefloatType = (motion as unknown as Record<string, unknown>).prefloatMotionType;
      if (typeof prefloatType === "string") return prefloatType.toLowerCase();
    }
    return motionTypeStr;
  }

  private isShiftMotion(motion: MotionData): boolean {
    const motionType = (motion as unknown as Record<string, unknown>).motionType;
    const motionTypeStr = typeof motionType === "string" ? motionType.toLowerCase() : "";
    return ["pro", "anti", "float"].includes(motionTypeStr);
  }

  private resolveMotionColor(color: string | undefined): TurnNumberColor {
    if (!color) return BLUE_HEX;
    const normalized = color.toLowerCase();
    if (normalized === "blue" || normalized.includes("blue")) return BLUE_HEX;
    if (normalized === "red" || normalized.includes("red")) return RED_HEX;
    return BLUE_HEX;
  }
}

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

import type { PictographData } from "../../shared/domain/models/PictographData";
import type { MotionData } from "../../shared/domain/models/MotionData";
import { getMotionColor } from "../../../utils/svg-color-utils";
import { MotionColor } from "../../shared/domain/enums/pictograph-enums";

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

export const BLUE_HEX: TurnNumberColor = getMotionColor(MotionColor.BLUE, "dark");
export const RED_HEX: TurnNumberColor = getMotionColor(MotionColor.RED, "dark");

function determineLetterType(letter: string): LetterType {
  if (["Φ-", "Ψ-", "Λ-"].includes(letter)) return "TYPE5";
  if (["α", "β", "γ"].includes(letter)) return "TYPE6";
  if (letter.endsWith("-")) return "TYPE3";
  if (["Φ", "Ψ", "Λ"].includes(letter)) return "TYPE4";
  if (["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"].includes(letter)) return "TYPE2";
  if (["C", "F", "I", "L", "O", "R", "U", "V"].includes(letter)) return "TYPE1_HYBRID";
  return "TYPE1_NON_HYBRID";
}

function getActualMotionType(motion: MotionData): string {
  const motionType = (motion as unknown as Record<string, unknown>).motionType;
  const motionTypeStr = typeof motionType === "string" ? motionType.toLowerCase() : "";

  if (motionTypeStr === "float") {
    const prefloatType = (motion as unknown as Record<string, unknown>).prefloatMotionType;
    if (typeof prefloatType === "string") {
      return prefloatType.toLowerCase();
    }
  }
  return motionTypeStr;
}

function isShiftMotion(motion: MotionData): boolean {
  const motionType = (motion as unknown as Record<string, unknown>).motionType;
  const motionTypeStr = typeof motionType === "string" ? motionType.toLowerCase() : "";
  return ["pro", "anti", "float"].includes(motionTypeStr);
}

/**
 * Determine the colors for top and bottom turn numbers.
 *
 * Color assignment is based on which motions object key ("blue"/"red")
 * the motion was extracted from - NOT motion.color, which is unreliable
 * for data loaded from storage.
 */
export function interpretTurnColors(
  letter: string | null | undefined,
  pictographData?: PictographData | null
): TurnColors {
  if (!letter || !pictographData) {
    return { top: BLUE_HEX, bottom: RED_HEX };
  }

  const letterType = determineLetterType(letter);
  const blueMotion = pictographData.motions.blue;
  const redMotion = pictographData.motions.red;

  if (!blueMotion || !redMotion) {
    return { top: BLUE_HEX, bottom: RED_HEX };
  }

  const colorOf = (motion: MotionData): TurnNumberColor =>
    motion === blueMotion ? BLUE_HEX : RED_HEX;

  switch (letterType) {
    case "TYPE2": {
      const shiftMotion = isShiftMotion(blueMotion) ? blueMotion : redMotion;
      const staticMotion = isShiftMotion(blueMotion) ? redMotion : blueMotion;
      return {
        top: colorOf(shiftMotion),
        bottom: colorOf(staticMotion),
      };
    }

    case "TYPE1_HYBRID": {
      const blueActualType = getActualMotionType(blueMotion);
      const proMotion = blueActualType === "pro" ? blueMotion : redMotion;
      const antiMotion = blueActualType === "anti" ? blueMotion : redMotion;
      return {
        top: colorOf(proMotion),
        bottom: colorOf(antiMotion),
      };
    }

    case "TYPE3": {
      const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
      const shiftMotion = isDashBlue ? redMotion : blueMotion;
      const dashMotion = isDashBlue ? blueMotion : redMotion;
      return {
        top: colorOf(shiftMotion),
        bottom: colorOf(dashMotion),
      };
    }

    case "TYPE4": {
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
      return {
        top: BLUE_HEX,
        bottom: RED_HEX,
      };
    }
  }
}

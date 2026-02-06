/**
 * Turns Tuple Generator
 *
 * Generates turns tuple strings for looking up special placement data.
 * Handles all 6 letter types with exact logic from legacy desktop app.
 */

import type { MotionData, PictographData } from "@tka/types";
import { PropRotationStateTracker } from "./PropRotationStateTracker";

type LetterType =
  | "TYPE1_HYBRID"
  | "TYPE1_NON_HYBRID"
  | "TYPE2"
  | "TYPE3"
  | "TYPE4"
  | "TYPE5"
  | "TYPE6";

export class TurnsTupleGenerator {
  private propRotationService: PropRotationStateTracker;

  constructor() {
    this.propRotationService = new PropRotationStateTracker();
  }

  generateTurnsTuple(pictographData: PictographData): string {
    try {
      const blueMotion = pictographData.motions?.blue;
      const redMotion = pictographData.motions?.red;

      if (!blueMotion || !redMotion) return "(0, 0)";

      const letterType = this.determineLetterType(pictographData.letter || undefined);

      switch (letterType) {
        case "TYPE1_HYBRID":
          return this.generateType1HybridTuple(blueMotion, redMotion);
        case "TYPE1_NON_HYBRID":
          return this.generateType1NonHybridTuple(blueMotion, redMotion);
        case "TYPE2":
          return this.generateType2Tuple(blueMotion, redMotion);
        case "TYPE3":
          return this.generateType3Tuple(blueMotion, redMotion);
        case "TYPE4":
          return this.generateType4Tuple(blueMotion, redMotion, pictographData.letter ?? undefined);
        case "TYPE5":
          return this.generateType5Tuple(blueMotion, redMotion, pictographData.letter ?? undefined);
        case "TYPE6":
          return this.generateType6Tuple(blueMotion, redMotion, pictographData.letter ?? undefined);
        default:
          return this.generateType1NonHybridTuple(blueMotion, redMotion);
      }
    } catch {
      return "(0, 0)";
    }
  }

  private determineLetterType(letter?: string): LetterType {
    if (!letter) return "TYPE1_NON_HYBRID";
    if (["Φ-", "Ψ-", "Λ-"].includes(letter)) return "TYPE5";
    if (["α", "β", "γ"].includes(letter)) return "TYPE6";
    if (letter.endsWith("-")) return "TYPE3";
    if (["Φ", "Ψ", "Λ"].includes(letter)) return "TYPE4";
    if (["W", "X", "Y", "Z", "Σ", "Δ", "Θ", "Ω"].includes(letter)) return "TYPE2";
    if (["C", "F", "I", "L", "O", "R", "U", "V"].includes(letter)) return "TYPE1_HYBRID";
    return "TYPE1_NON_HYBRID";
  }

  private generateType1HybridTuple(blueMotion: MotionData, redMotion: MotionData): string {
    const hasFloat =
      blueMotion.motionType.toLowerCase() === "float" ||
      redMotion.motionType.toLowerCase() === "float";

    if (hasFloat) {
      return `(${this.formatTurns(this.normalizeTurns(blueMotion))}, ${this.formatTurns(this.normalizeTurns(redMotion))})`;
    }

    const proMotion = blueMotion.motionType.toLowerCase() === "pro" ? blueMotion : redMotion;
    const antiMotion = blueMotion.motionType.toLowerCase() === "anti" ? blueMotion : redMotion;
    return `(${proMotion.turns}, ${antiMotion.turns})`;
  }

  private generateType1NonHybridTuple(blueMotion: MotionData, redMotion: MotionData): string {
    return `(${this.formatTurns(this.normalizeTurns(blueMotion))}, ${this.formatTurns(this.normalizeTurns(redMotion))})`;
  }

  private generateType2Tuple(blueMotion: MotionData, redMotion: MotionData): string {
    const isShift = (motion: MotionData) =>
      ["pro", "anti", "float"].includes(motion.motionType.toLowerCase());

    const shiftMotion = isShift(blueMotion) ? blueMotion : redMotion;
    const staticMotion = isShift(blueMotion) ? redMotion : blueMotion;

    const shiftType = shiftMotion.motionType.toLowerCase();
    const shiftTurns = this.normalizeTurns(shiftMotion);
    const staticTurns = this.normalizeTurns(staticMotion);

    const staticHasTurnsAndRotation =
      typeof staticTurns === "number" && staticTurns !== 0 &&
      staticMotion.rotationDirection.toLowerCase() !== "norotation";

    if ((shiftType === "pro" || shiftType === "anti") && staticHasTurnsAndRotation) {
      const direction = staticMotion.rotationDirection.toLowerCase() === shiftMotion.rotationDirection.toLowerCase() ? "s" : "o";
      return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
    }

    if (shiftType === "float" && staticHasTurnsAndRotation) {
      const prefloatRotDir = shiftMotion.prefloatRotationDirection?.toLowerCase() || "norotation";
      const direction = staticMotion.rotationDirection.toLowerCase() === prefloatRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
    }

    return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
  }

  private generateType3Tuple(blueMotion: MotionData, redMotion: MotionData): string {
    const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
    const shiftMotion = isDashBlue ? redMotion : blueMotion;
    const dashMotion = isDashBlue ? blueMotion : redMotion;

    const shiftType = shiftMotion.motionType.toLowerCase();
    const shiftTurns = this.normalizeTurns(shiftMotion);
    const dashTurns = this.normalizeTurns(dashMotion);
    const dashRotDir = dashMotion.rotationDirection.toLowerCase() || "norotation";

    if (shiftType === "pro" || shiftType === "anti") {
      const shiftRotDir = shiftMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = dashRotDir === shiftRotDir ? "s" : "o";
      if (typeof dashTurns === "number" && dashTurns > 0) {
        return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
      }
      return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
    }

    if (shiftType === "float") {
      if (typeof dashTurns === "number" && dashTurns !== 0 && dashRotDir !== "norotation") {
        const prefloatRotDir = shiftMotion.prefloatRotationDirection?.toLowerCase() || "norotation";
        const direction = dashRotDir === prefloatRotDir ? "s" : "o";
        return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
      }
      return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
    }

    return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
  }

  private generateType4Tuple(blueMotion: MotionData, redMotion: MotionData, letter?: string): string {
    const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
    const dashMotion = isDashBlue ? blueMotion : redMotion;
    const staticMotion = isDashBlue ? redMotion : blueMotion;
    const dashTurns = this.normalizeTurns(dashMotion);
    const staticTurns = this.normalizeTurns(staticMotion);

    if (letter === "Λ") {
      return this.generateLambdaTuple(dashMotion, staticMotion, dashTurns, staticTurns);
    }

    if (dashTurns === 0 && staticTurns === 0) {
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    } else if (dashTurns === 0 || staticTurns === 0) {
      const turningMotion = dashTurns !== 0 ? dashMotion : staticMotion;
      return `(${turningMotion.rotationDirection.toLowerCase() || "cw"}, ${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    } else {
      const direction = dashMotion.rotationDirection.toLowerCase() === staticMotion.rotationDirection.toLowerCase() ? "s" : "o";
      return `(${direction}, ${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    }
  }

  private generateLambdaTuple(
    dashMotion: MotionData, staticMotion: MotionData,
    dashTurns: number | "fl", staticTurns: number | "fl"
  ): string {
    if (dashTurns === 0 && staticTurns === 0) {
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    } else if (dashTurns === 0 && typeof staticTurns === "number" && staticTurns > 0) {
      const oc = this.propRotationService.getStaticState(dashMotion.endLocation, staticMotion.endLocation, staticMotion.rotationDirection);
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)}, ${oc})`;
    } else if (typeof dashTurns === "number" && dashTurns > 0 && staticTurns === 0) {
      const oc = this.propRotationService.getDashState(dashMotion.endLocation, staticMotion.endLocation, dashMotion.rotationDirection);
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)}, ${oc})`;
    } else if (typeof staticTurns === "number" && staticTurns > 0 && typeof dashTurns === "number" && dashTurns > 0) {
      const staticOc = this.propRotationService.getStaticState(dashMotion.endLocation, staticMotion.endLocation, staticMotion.rotationDirection);
      const dashOc = this.propRotationService.getDashState(dashMotion.endLocation, staticMotion.endLocation, dashMotion.rotationDirection);
      const direction = staticMotion.rotationDirection === dashMotion.rotationDirection ? "s" : "o";
      return `(${direction}, ${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)}, ${dashOc}, ${staticOc})`;
    }
    return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
  }

  private generateType5Tuple(blueMotion: MotionData, redMotion: MotionData, letter?: string): string {
    const blueTurns = this.normalizeTurns(blueMotion);
    const redTurns = this.normalizeTurns(redMotion);

    if (letter === "Λ-") {
      return this.generateLambdaDashTuple(blueMotion, redMotion, blueTurns, redTurns);
    }

    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (blueTurns === 0 || redTurns === 0) {
      const turningMotion = blueTurns !== 0 ? blueMotion : redMotion;
      return `(${turningMotion.rotationDirection.toLowerCase() || "cw"}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else {
      const direction = blueMotion.rotationDirection.toLowerCase() === redMotion.rotationDirection.toLowerCase() ? "s" : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    }
  }

  private generateLambdaDashTuple(
    blueMotion: MotionData, redMotion: MotionData,
    blueTurns: number | "fl", redTurns: number | "fl"
  ): string {
    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (blueTurns === 0 && typeof redTurns === "number" && redTurns > 0) {
      const oc = this.propRotationService.getRedState(blueMotion.endLocation, redMotion.endLocation, redMotion.rotationDirection);
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${oc})`;
    } else if (typeof blueTurns === "number" && blueTurns > 0 && redTurns === 0) {
      const oc = this.propRotationService.getBlueState(blueMotion.endLocation, redMotion.endLocation, blueMotion.rotationDirection);
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${oc})`;
    } else if (typeof redTurns === "number" && redTurns > 0 && typeof blueTurns === "number" && blueTurns > 0) {
      const redOc = this.propRotationService.getRedState(blueMotion.endLocation, redMotion.endLocation, redMotion.rotationDirection);
      const blueOc = this.propRotationService.getBlueState(blueMotion.endLocation, redMotion.endLocation, blueMotion.rotationDirection);
      const direction = blueMotion.rotationDirection === redMotion.rotationDirection ? "s" : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${blueOc}, ${redOc})`;
    }
    return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
  }

  private generateType6Tuple(blueMotion: MotionData, redMotion: MotionData, letter?: string): string {
    const blueTurns = this.normalizeTurns(blueMotion);
    const redTurns = this.normalizeTurns(redMotion);

    if (letter === "γ") {
      return this.generateGammaTuple(blueMotion, redMotion, blueTurns, redTurns);
    }

    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (blueTurns === 0 || redTurns === 0) {
      const turningMotion = blueTurns !== 0 ? blueMotion : redMotion;
      return `(${turningMotion.rotationDirection.toLowerCase() || "cw"}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else {
      const direction = blueMotion.rotationDirection.toLowerCase() === redMotion.rotationDirection.toLowerCase() ? "s" : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    }
  }

  private generateGammaTuple(
    blueMotion: MotionData, redMotion: MotionData,
    blueTurns: number | "fl", redTurns: number | "fl"
  ): string {
    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (blueTurns === 0 && typeof redTurns === "number" && redTurns > 0) {
      const oc = this.propRotationService.getRedState(blueMotion.endLocation, redMotion.endLocation, redMotion.rotationDirection);
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${oc})`;
    } else if (typeof blueTurns === "number" && blueTurns > 0 && redTurns === 0) {
      const oc = this.propRotationService.getBlueState(blueMotion.endLocation, redMotion.endLocation, blueMotion.rotationDirection);
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${oc})`;
    } else if (typeof redTurns === "number" && redTurns > 0 && typeof blueTurns === "number" && blueTurns > 0) {
      const redOc = this.propRotationService.getRedState(blueMotion.endLocation, redMotion.endLocation, redMotion.rotationDirection);
      const blueOc = this.propRotationService.getBlueState(blueMotion.endLocation, redMotion.endLocation, blueMotion.rotationDirection);
      const direction = blueMotion.rotationDirection === redMotion.rotationDirection ? "s" : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${blueOc}, ${redOc})`;
    }
    return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
  }

  private normalizeTurns(motion: MotionData): number | "fl" {
    const turns = motion.turns;
    const motionType = motion.motionType.toLowerCase();
    if (motionType === "float" || turns === "fl") return "fl";
    if (typeof turns === "number") return turns === Math.floor(turns) ? Math.floor(turns) : turns;
    return 0;
  }

  private formatTurns(turns: number | "fl"): string {
    if (typeof turns === "number") return turns === Math.floor(turns) ? Math.floor(turns).toString() : turns.toString();
    return turns;
  }
}

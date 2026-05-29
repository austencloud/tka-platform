/**
 * Turns Tuple Generator Service
 *
 * Generates turns tuple strings for looking up special placement data.
 * Handles all 6 letter types with exact logic from legacy desktop app.
 */

import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../shared/domain/models/PictographData";
import {
  getBlueState,
  getRedState,
  getDashState,
  getStaticState,
} from "./prop-rotation-state-tracker";


type LetterType =
  | "TYPE1_HYBRID"
  | "TYPE1_NON_HYBRID"
  | "TYPE2"
  | "TYPE3"
  | "TYPE4"
  | "TYPE5"
  | "TYPE6";

export class TurnsTupleGenerator {
  constructor() {}

  /**
   * Generate turns tuple string matching the legacy turns_tuple_generator logic.
   *
   * Formats:
   * - TYPE1 Hybrid: "(pro_turns, anti_turns)" or "(blue_turns, red_turns)" if has float
   * - TYPE1 Non-Hybrid: "(blue_turns, red_turns)"
   * - TYPE2: "(shift_turns, static_turns)" or "(direction, shift_turns, static_turns)"
   * - TYPE3: "(direction, shift_turns, dash_turns)"
   * - TYPE4: "(direction, dash_turns, static_turns)" or with prop rotation for Λ
   * - TYPE5: "(direction, blue_turns, red_turns)" or with prop rotation for Λ-
   * - TYPE6: "(direction, blue_turns, red_turns)" or with prop rotation for γ
   */
  generateTurnsTuple(pictographData: PictographData): string {
    try {
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;

      if (!blueMotion || !redMotion) {
        return "(0, 0)";
      }

      const letterType = this.determineLetterType(
        pictographData.letter || undefined
      );

      if (letterType === "TYPE1_HYBRID") {
        return this.generateType1HybridTuple(blueMotion, redMotion);
      }

      if (letterType === "TYPE1_NON_HYBRID") {
        return this.generateType1NonHybridTuple(blueMotion, redMotion);
      }

      if (letterType === "TYPE2") {
        return this.generateType2Tuple(blueMotion, redMotion);
      }

      if (letterType === "TYPE3") {
        return this.generateType3Tuple(blueMotion, redMotion);
      }

      if (letterType === "TYPE4") {
        return this.generateType4Tuple(
          blueMotion,
          redMotion,
          pictographData.letter ?? undefined
        );
      }

      if (letterType === "TYPE5") {
        return this.generateType5Tuple(
          blueMotion,
          redMotion,
          pictographData.letter ?? undefined
        );
      }

      if (letterType === "TYPE6") {
        return this.generateType6Tuple(
          blueMotion,
          redMotion,
          pictographData.letter ?? undefined
        );
      }

      // Fallback
      return this.generateType1NonHybridTuple(blueMotion, redMotion);
    } catch {
      return "(0, 0)";
    }
  }

  /**
   * Determine letter type based on letter pattern
   */
  private determineLetterType(letter?: string): LetterType {
    if (!letter) {
      return "TYPE1_NON_HYBRID";
    }

    try {
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
    } catch {
      return "TYPE1_NON_HYBRID";
    }
  }

  /**
   * Generate TYPE1 Hybrid tuple: (pro_turns, anti_turns) or (blue_turns, red_turns)
   * Used for: C, F, I, L, O, R, U, V
   */
  private generateType1HybridTuple(
    blueMotion: MotionData,
    redMotion: MotionData
  ): string {
    // Check if one motion is float
    const hasFloat =
      blueMotion.motionType.toLowerCase() === "float" ||
      redMotion.motionType.toLowerCase() === "float";

    if (hasFloat) {
      // If has float, use blue/red ordering
      return `(${this.formatTurns(this.normalizeTurns(blueMotion))}, ${this.formatTurns(this.normalizeTurns(redMotion))})`;
    } else {
      // If no float, use pro/anti ordering
      const proMotion =
        blueMotion.motionType.toLowerCase() === "pro" ? blueMotion : redMotion;
      const antiMotion =
        blueMotion.motionType.toLowerCase() === "anti" ? blueMotion : redMotion;

      return `(${proMotion.turns}, ${antiMotion.turns})`;
    }
  }

  /**
   * Generate TYPE1 Non-Hybrid tuple: (blue_turns, red_turns)
   * Used for: A, B, D, E, G, H, J, K, M, N, P, Q, S, T
   */
  private generateType1NonHybridTuple(
    blueMotion: MotionData,
    redMotion: MotionData
  ): string {
    const blueTurns = this.normalizeTurns(blueMotion);
    const redTurns = this.normalizeTurns(redMotion);

    return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
  }

  /**
   * Generate TYPE2 tuple: (shift_turns, static_turns) or (direction, shift_turns, static_turns)
   * Used for: W, X, Y, Z, Σ, Δ, Θ, Ω
   */
  private generateType2Tuple(
    blueMotion: MotionData,
    redMotion: MotionData
  ): string {
    // Identify which is shift and which is static
    const isShift = (motion: MotionData) => {
      const motionType = motion.motionType.toLowerCase();
      return ["pro", "anti", "float"].includes(motionType || "");
    };

    const shiftMotion = isShift(blueMotion) ? blueMotion : redMotion;
    const staticMotion = isShift(blueMotion) ? redMotion : blueMotion;

    const shiftType = shiftMotion.motionType.toLowerCase();
    const shiftTurns = this.normalizeTurns(shiftMotion);
    const staticTurns = this.normalizeTurns(staticMotion);

    // Handle PRO/ANTI shift motions
    if (shiftType === "pro" || shiftType === "anti") {
      const staticHasTurnsAndRotation =
        typeof staticTurns === "number" &&
        staticTurns !== 0 &&
        staticMotion.rotationDirection.toLowerCase() !== "norotation";

      if (staticHasTurnsAndRotation) {
        const staticRotDir =
          staticMotion.rotationDirection.toLowerCase() || "norotation";
        const shiftRotDir =
          shiftMotion.rotationDirection.toLowerCase() || "norotation";
        const direction = staticRotDir === shiftRotDir ? "s" : "o";
        return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
      } else {
        return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
      }
    }

    // Handle FLOAT shift motions
    if (shiftType === "float") {
      const staticHasTurnsAndRotation =
        typeof staticTurns === "number" &&
        staticTurns !== 0 &&
        staticMotion.rotationDirection.toLowerCase() !== "norotation";

      if (staticHasTurnsAndRotation) {
        const staticRotDir =
          staticMotion.rotationDirection.toLowerCase() || "norotation";
        const prefloatRotDir =
          shiftMotion.prefloatRotationDirection?.toLowerCase() || "norotation";
        const direction = staticRotDir === prefloatRotDir ? "s" : "o";
        return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
      } else {
        return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
      }
    }

    // Fallback
    return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(staticTurns)})`;
  }

  /**
   * Generate TYPE3 tuple: (direction, shift_turns, dash_turns)
   * Used for Cross-Shift letters (W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-)
   */
  private generateType3Tuple(
    blueMotion: MotionData,
    redMotion: MotionData
  ): string {
    // Identify shift and dash motions
    const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
    const shiftMotion = isDashBlue ? redMotion : blueMotion;
    const dashMotion = isDashBlue ? blueMotion : redMotion;

    const shiftType = shiftMotion.motionType.toLowerCase();
    const shiftTurns = this.normalizeTurns(shiftMotion);
    const dashTurns = this.normalizeTurns(dashMotion);
    const dashRotDir =
      dashMotion.rotationDirection.toLowerCase() || "norotation";

    // Handle PRO/ANTI shift motions
    if (shiftType === "pro" || shiftType === "anti") {
      const shiftRotDir =
        shiftMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = dashRotDir === shiftRotDir ? "s" : "o";

      if (typeof dashTurns === "number" && dashTurns > 0) {
        return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
      } else {
        return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
      }
    }

    // Handle FLOAT shift motions
    if (shiftType === "float") {
      if (
        typeof dashTurns === "number" &&
        dashTurns !== 0 &&
        dashRotDir !== "norotation"
      ) {
        const prefloatRotDir =
          shiftMotion.prefloatRotationDirection?.toLowerCase() || "norotation";
        const direction = dashRotDir === prefloatRotDir ? "s" : "o";
        return `(${direction}, ${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
      } else {
        return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
      }
    }

    // Fallback
    return `(${this.formatTurns(shiftTurns)}, ${this.formatTurns(dashTurns)})`;
  }

  /**
   * Generate TYPE4 tuple: (direction, dash_turns, static_turns)
   * Used for Dash letters (Φ, Ψ, Λ)
   *
   * Special case for Λ (Lambda): includes prop rotation state (opening/closing)
   */
  private generateType4Tuple(
    blueMotion: MotionData,
    redMotion: MotionData,
    letter?: string
  ): string {
    // Identify dash and static motions
    const isDashBlue = blueMotion.motionType.toLowerCase() === "dash";
    const dashMotion = isDashBlue ? blueMotion : redMotion;
    const staticMotion = isDashBlue ? redMotion : blueMotion;

    const dashTurns = this.normalizeTurns(dashMotion);
    const staticTurns = this.normalizeTurns(staticMotion);

    // Lambda (Λ) requires prop rotation state
    if (letter === "Λ") {
      return this.generateLambdaTuple(
        dashMotion,
        staticMotion,
        dashTurns,
        staticTurns
      );
    }

    // Standard TYPE4 logic for Φ, Ψ
    if (dashTurns === 0 && staticTurns === 0) {
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    } else if (dashTurns === 0 || staticTurns === 0) {
      const turningMotion = dashTurns !== 0 ? dashMotion : staticMotion;
      const turningRotDir =
        turningMotion.rotationDirection.toLowerCase() || "cw";
      return `(${turningRotDir}, ${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    } else {
      const dashRotDir =
        dashMotion.rotationDirection.toLowerCase() || "norotation";
      const staticRotDir =
        staticMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = dashRotDir === staticRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    }
  }

  /**
   * Generate Lambda (Λ) specific tuple with prop rotation state.
   * Format: (direction, dash_turns, static_turns, dash_open_close, static_open_close)
   */
  private generateLambdaTuple(
    dashMotion: MotionData,
    staticMotion: MotionData,
    dashTurns: number | "fl",
    staticTurns: number | "fl"
  ): string {
    if (dashTurns === 0 && staticTurns === 0) {
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    } else if (
      dashTurns === 0 &&
      typeof staticTurns === "number" &&
      staticTurns > 0
    ) {
      const staticOpenClose = getStaticState(
        dashMotion.endLocation,
        staticMotion.endLocation,
        staticMotion.rotationDirection
      );
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)}, ${staticOpenClose})`;
    } else if (
      typeof dashTurns === "number" &&
      dashTurns > 0 &&
      staticTurns === 0
    ) {
      const dashOpenClose = getDashState(
        dashMotion.endLocation,
        staticMotion.endLocation,
        dashMotion.rotationDirection
      );
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)}, ${dashOpenClose})`;
    } else if (
      typeof staticTurns === "number" &&
      staticTurns > 0 &&
      typeof dashTurns === "number" &&
      dashTurns > 0
    ) {
      const staticOpenClose = getStaticState(
        dashMotion.endLocation,
        staticMotion.endLocation,
        staticMotion.rotationDirection
      );
      const dashOpenClose = getDashState(
        dashMotion.endLocation,
        staticMotion.endLocation,
        dashMotion.rotationDirection
      );
      const direction =
        staticMotion.rotationDirection === dashMotion.rotationDirection
          ? "s"
          : "o";
      return `(${direction}, ${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)}, ${dashOpenClose}, ${staticOpenClose})`;
    } else {
      return `(${this.formatTurns(dashTurns)}, ${this.formatTurns(staticTurns)})`;
    }
  }

  /**
   * Generate TYPE5 tuple: (direction, blue_turns, red_turns)
   * Used for Dash-Static letters with suffix (Φ-, Ψ-, Λ-)
   *
   * Special case for Λ- (Lambda Dash): includes prop rotation state (opening/closing)
   *
   * Logic from legacy Type56TurnsTupleGenerator:
   * - Both turns 0: (blue_turns, red_turns)
   * - One turn 0: (rotation_direction, blue_turns, red_turns)
   * - Both turns non-zero: (direction, blue_turns, red_turns) where direction = 's' if same, 'o' if opposite
   */
  private generateType5Tuple(
    blueMotion: MotionData,
    redMotion: MotionData,
    letter?: string
  ): string {
    const blueTurns = this.normalizeTurns(blueMotion);
    const redTurns = this.normalizeTurns(redMotion);

    // Lambda Dash (Λ-) requires prop rotation state
    if (letter === "Λ-") {
      return this.generateLambdaDashTuple(
        blueMotion,
        redMotion,
        blueTurns,
        redTurns
      );
    }

    // Standard TYPE5 logic for Φ-, Ψ-
    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (blueTurns === 0 || redTurns === 0) {
      const turningMotion = blueTurns !== 0 ? blueMotion : redMotion;
      const turningRotDir =
        turningMotion.rotationDirection.toLowerCase() || "cw";
      return `(${turningRotDir}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else {
      const blueRotDir =
        blueMotion.rotationDirection.toLowerCase() || "norotation";
      const redRotDir =
        redMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = blueRotDir === redRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    }
  }

  /**
   * Generate Lambda Dash (Λ-) specific tuple with prop rotation state.
   * Format: (direction, blue_turns, red_turns, blue_open_close, red_open_close)
   */
  private generateLambdaDashTuple(
    blueMotion: MotionData,
    redMotion: MotionData,
    blueTurns: number | "fl",
    redTurns: number | "fl"
  ): string {
    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (
      blueTurns === 0 &&
      typeof redTurns === "number" &&
      redTurns > 0
    ) {
      const redOpenClose = getRedState(
        blueMotion.endLocation,
        redMotion.endLocation,
        redMotion.rotationDirection
      );
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${redOpenClose})`;
    } else if (
      typeof blueTurns === "number" &&
      blueTurns > 0 &&
      redTurns === 0
    ) {
      const blueOpenClose = getBlueState(
        blueMotion.endLocation,
        redMotion.endLocation,
        blueMotion.rotationDirection
      );
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${blueOpenClose})`;
    } else if (
      typeof redTurns === "number" &&
      redTurns > 0 &&
      typeof blueTurns === "number" &&
      blueTurns > 0
    ) {
      const redOpenClose = getRedState(
        blueMotion.endLocation,
        redMotion.endLocation,
        redMotion.rotationDirection
      );
      const blueOpenClose = getBlueState(
        blueMotion.endLocation,
        redMotion.endLocation,
        blueMotion.rotationDirection
      );
      const direction =
        blueMotion.rotationDirection === redMotion.rotationDirection
          ? "s"
          : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${blueOpenClose}, ${redOpenClose})`;
    } else {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    }
  }

  /**
   * Generate TYPE6 tuple: (direction, blue_turns, red_turns)
   * Used for Beta letters (α, β, γ)
   *
   * Special case for γ (Gamma): includes prop rotation state (opening/closing)
   * For α and β: uses standard TYPE5 logic
   */
  private generateType6Tuple(
    blueMotion: MotionData,
    redMotion: MotionData,
    letter?: string
  ): string {
    const blueTurns = this.normalizeTurns(blueMotion);
    const redTurns = this.normalizeTurns(redMotion);

    // Gamma (γ) requires prop rotation state
    if (letter === "γ") {
      return this.generateGammaTuple(
        blueMotion,
        redMotion,
        blueTurns,
        redTurns
      );
    }

    // Standard TYPE5/TYPE6 logic for α, β
    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (blueTurns === 0 || redTurns === 0) {
      const turningMotion = blueTurns !== 0 ? blueMotion : redMotion;
      const turningRotDir =
        turningMotion.rotationDirection.toLowerCase() || "cw";
      return `(${turningRotDir}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else {
      const blueRotDir =
        blueMotion.rotationDirection.toLowerCase() || "norotation";
      const redRotDir =
        redMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = blueRotDir === redRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    }
  }

  /**
   * Generate Gamma (γ) specific tuple with prop rotation state.
   * Format: (direction, blue_turns, red_turns, blue_open_close, red_open_close)
   */
  private generateGammaTuple(
    blueMotion: MotionData,
    redMotion: MotionData,
    blueTurns: number | "fl",
    redTurns: number | "fl"
  ): string {
    if (blueTurns === 0 && redTurns === 0) {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    } else if (
      blueTurns === 0 &&
      typeof redTurns === "number" &&
      redTurns > 0
    ) {
      const redOpenClose = getRedState(
        blueMotion.endLocation,
        redMotion.endLocation,
        redMotion.rotationDirection
      );
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${redOpenClose})`;
    } else if (
      typeof blueTurns === "number" &&
      blueTurns > 0 &&
      redTurns === 0
    ) {
      const blueOpenClose = getBlueState(
        blueMotion.endLocation,
        redMotion.endLocation,
        blueMotion.rotationDirection
      );
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${blueOpenClose})`;
    } else if (
      typeof redTurns === "number" &&
      redTurns > 0 &&
      typeof blueTurns === "number" &&
      blueTurns > 0
    ) {
      const redOpenClose = getRedState(
        blueMotion.endLocation,
        redMotion.endLocation,
        redMotion.rotationDirection
      );
      const blueOpenClose = getBlueState(
        blueMotion.endLocation,
        redMotion.endLocation,
        blueMotion.rotationDirection
      );
      const direction =
        blueMotion.rotationDirection === redMotion.rotationDirection
          ? "s"
          : "o";
      return `(${direction}, ${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)}, ${blueOpenClose}, ${redOpenClose})`;
    } else {
      return `(${this.formatTurns(blueTurns)}, ${this.formatTurns(redTurns)})`;
    }
  }

  /**
   * Normalize turns value - exact port from legacy _normalize_turns()
   */
  private normalizeTurns(motion: MotionData): number | "fl" {
    const turns = motion.turns;
    const motionType = motion.motionType.toLowerCase();

    if (motionType === "float" || turns === "fl") {
      return "fl";
    }

    if (typeof turns === "number") {
      // Return int for whole numbers, float for half turns
      return turns === Math.floor(turns) ? Math.floor(turns) : turns;
    }

    return 0;
  }

  /**
   * Format turns value for string output
   */
  private formatTurns(turns: number | "fl"): string {
    if (typeof turns === "number") {
      return turns === Math.floor(turns)
        ? Math.floor(turns).toString()
        : turns.toString();
    }
    return turns; // Already a string ("fl")
  }
}

// DIRECT EXPORT - Use this instead of turnsTupleGenerator
// This avoids DI container rebuilds when this file changes
export const turnsTupleGenerator = new TurnsTupleGenerator();

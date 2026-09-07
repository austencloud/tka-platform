/**
 * Turns Tuple Generator Service
 *
 * Generates turns tuple strings for looking up special placement data.
 * Handles all 6 letter types with exact logic from legacy desktop app.
 */

import type { MotionData } from "../../../../shared/domain/models/motion-data";
import { isVisibleMotion } from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import {
  getLeftState,
  getRightState,
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
      const leftMotion = pictographData.motions.left;
      const rightMotion = pictographData.motions.right;

      // Invisible placeholder = hand not really there (both-required Step
      // shape): keep the "(0, 0)" fallback the old absent-hand path produced
      // (the tuple keys glyph caches + special-placement lookups).
      if (!isVisibleMotion(leftMotion) || !isVisibleMotion(rightMotion)) {
        return "(0, 0)";
      }

      const letterType = this.determineLetterType(
        pictographData.letter || undefined
      );

      if (letterType === "TYPE1_HYBRID") {
        return this.generateType1HybridTuple(leftMotion, rightMotion);
      }

      if (letterType === "TYPE1_NON_HYBRID") {
        return this.generateType1NonHybridTuple(leftMotion, rightMotion);
      }

      if (letterType === "TYPE2") {
        return this.generateType2Tuple(leftMotion, rightMotion);
      }

      if (letterType === "TYPE3") {
        return this.generateType3Tuple(leftMotion, rightMotion);
      }

      if (letterType === "TYPE4") {
        return this.generateType4Tuple(
          leftMotion,
          rightMotion,
          pictographData.letter ?? undefined
        );
      }

      if (letterType === "TYPE5") {
        return this.generateType5Tuple(
          leftMotion,
          rightMotion,
          pictographData.letter ?? undefined
        );
      }

      if (letterType === "TYPE6") {
        return this.generateType6Tuple(
          leftMotion,
          rightMotion,
          pictographData.letter ?? undefined
        );
      }

      // Fallback
      return this.generateType1NonHybridTuple(leftMotion, rightMotion);
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
    leftMotion: MotionData,
    rightMotion: MotionData
  ): string {
    // Check if one motion is float
    const hasFloat =
      leftMotion.motionType.toLowerCase() === "float" ||
      rightMotion.motionType.toLowerCase() === "float";

    if (hasFloat) {
      // If has float, use blue/red ordering
      return `(${this.formatTurns(this.normalizeTurns(leftMotion), leftMotion)}, ${this.formatTurns(this.normalizeTurns(rightMotion), rightMotion)})`;
    } else {
      // If no float, use pro/anti ordering
      const proMotion =
        leftMotion.motionType.toLowerCase() === "pro" ? leftMotion : rightMotion;
      const antiMotion =
        leftMotion.motionType.toLowerCase() === "anti" ? leftMotion : rightMotion;

      return `(${this.formatTurns(proMotion.turns, proMotion)}, ${this.formatTurns(antiMotion.turns, antiMotion)})`;
    }
  }

  /**
   * Generate TYPE1 Non-Hybrid tuple: (blue_turns, red_turns)
   * Used for: A, B, D, E, G, H, J, K, M, N, P, Q, S, T
   */
  private generateType1NonHybridTuple(
    leftMotion: MotionData,
    rightMotion: MotionData
  ): string {
    const leftTurns = this.normalizeTurns(leftMotion);
    const rightTurns = this.normalizeTurns(rightMotion);

    return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
  }

  /**
   * Generate TYPE2 tuple: (shift_turns, static_turns) or (direction, shift_turns, static_turns)
   * Used for: W, X, Y, Z, Σ, Δ, Θ, Ω
   */
  private generateType2Tuple(
    leftMotion: MotionData,
    rightMotion: MotionData
  ): string {
    // Identify which is shift and which is static
    const isShift = (motion: MotionData) => {
      const motionType = motion.motionType.toLowerCase();
      return ["pro", "anti", "float"].includes(motionType || "");
    };

    const shiftMotion = isShift(leftMotion) ? leftMotion : rightMotion;
    const staticMotion = isShift(leftMotion) ? rightMotion : leftMotion;

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
        return `(${direction}, ${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
      } else {
        return `(${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
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
        return `(${direction}, ${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
      } else {
        return `(${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
      }
    }

    // Fallback
    return `(${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
  }

  /**
   * Generate TYPE3 tuple: (direction, shift_turns, dash_turns)
   * Used for Cross-Shift letters (W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-)
   */
  private generateType3Tuple(
    leftMotion: MotionData,
    rightMotion: MotionData
  ): string {
    // Identify shift and dash motions
    const isDashBlue = leftMotion.motionType.toLowerCase() === "dash";
    const shiftMotion = isDashBlue ? rightMotion : leftMotion;
    const dashMotion = isDashBlue ? leftMotion : rightMotion;

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
        return `(${direction}, ${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(dashTurns, dashMotion)})`;
      } else {
        return `(${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(dashTurns, dashMotion)})`;
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
        return `(${direction}, ${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(dashTurns, dashMotion)})`;
      } else {
        return `(${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(dashTurns, dashMotion)})`;
      }
    }

    // Fallback
    return `(${this.formatTurns(shiftTurns, shiftMotion)}, ${this.formatTurns(dashTurns, dashMotion)})`;
  }

  /**
   * Generate TYPE4 tuple: (direction, dash_turns, static_turns)
   * Used for Dash letters (Φ, Ψ, Λ)
   *
   * Special case for Λ (Lambda): includes prop rotation state (opening/closing)
   */
  private generateType4Tuple(
    leftMotion: MotionData,
    rightMotion: MotionData,
    letter?: string
  ): string {
    // Identify dash and static motions
    const isDashBlue = leftMotion.motionType.toLowerCase() === "dash";
    const dashMotion = isDashBlue ? leftMotion : rightMotion;
    const staticMotion = isDashBlue ? rightMotion : leftMotion;

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
      return `(${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
    } else if (dashTurns === 0 || staticTurns === 0) {
      const turningMotion = dashTurns !== 0 ? dashMotion : staticMotion;
      const turningRotDir =
        turningMotion.rotationDirection.toLowerCase() || "cw";
      return `(${turningRotDir}, ${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
    } else {
      const dashRotDir =
        dashMotion.rotationDirection.toLowerCase() || "norotation";
      const staticRotDir =
        staticMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = dashRotDir === staticRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
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
      return `(${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
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
      return `(${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)}, ${staticOpenClose})`;
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
      return `(${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)}, ${dashOpenClose})`;
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
      return `(${direction}, ${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)}, ${dashOpenClose}, ${staticOpenClose})`;
    } else {
      return `(${this.formatTurns(dashTurns, dashMotion)}, ${this.formatTurns(staticTurns, staticMotion)})`;
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
    leftMotion: MotionData,
    rightMotion: MotionData,
    letter?: string
  ): string {
    const leftTurns = this.normalizeTurns(leftMotion);
    const rightTurns = this.normalizeTurns(rightMotion);

    // Lambda Dash (Λ-) requires prop rotation state
    if (letter === "Λ-") {
      return this.generateLambdaDashTuple(
        leftMotion,
        rightMotion,
        leftTurns,
        rightTurns
      );
    }

    // Standard TYPE5 logic for Φ-, Ψ-
    if (leftTurns === 0 && rightTurns === 0) {
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    } else if (leftTurns === 0 || rightTurns === 0) {
      const turningMotion = leftTurns !== 0 ? leftMotion : rightMotion;
      const turningRotDir =
        turningMotion.rotationDirection.toLowerCase() || "cw";
      return `(${turningRotDir}, ${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    } else {
      const leftRotDir =
        leftMotion.rotationDirection.toLowerCase() || "norotation";
      const rightRotDir =
        rightMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = leftRotDir === rightRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    }
  }

  /**
   * Generate Lambda Dash (Λ-) specific tuple with prop rotation state.
   * Format: (direction, blue_turns, red_turns, blue_open_close, red_open_close)
   */
  private generateLambdaDashTuple(
    leftMotion: MotionData,
    rightMotion: MotionData,
    leftTurns: number | "fl",
    rightTurns: number | "fl"
  ): string {
    if (leftTurns === 0 && rightTurns === 0) {
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    } else if (
      leftTurns === 0 &&
      typeof rightTurns === "number" &&
      rightTurns > 0
    ) {
      const rightOpenClose = getRightState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        rightMotion.rotationDirection
      );
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)}, ${rightOpenClose})`;
    } else if (
      typeof leftTurns === "number" &&
      leftTurns > 0 &&
      rightTurns === 0
    ) {
      const leftOpenClose = getLeftState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        leftMotion.rotationDirection
      );
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)}, ${leftOpenClose})`;
    } else if (
      typeof rightTurns === "number" &&
      rightTurns > 0 &&
      typeof leftTurns === "number" &&
      leftTurns > 0
    ) {
      const rightOpenClose = getRightState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        rightMotion.rotationDirection
      );
      const leftOpenClose = getLeftState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        leftMotion.rotationDirection
      );
      const direction =
        leftMotion.rotationDirection === rightMotion.rotationDirection
          ? "s"
          : "o";
      return `(${direction}, ${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)}, ${leftOpenClose}, ${rightOpenClose})`;
    } else {
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
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
    leftMotion: MotionData,
    rightMotion: MotionData,
    letter?: string
  ): string {
    const leftTurns = this.normalizeTurns(leftMotion);
    const rightTurns = this.normalizeTurns(rightMotion);

    // Gamma (γ) requires prop rotation state
    if (letter === "γ") {
      return this.generateGammaTuple(
        leftMotion,
        rightMotion,
        leftTurns,
        rightTurns
      );
    }

    // Standard TYPE5/TYPE6 logic for α, β
    if (leftTurns === 0 && rightTurns === 0) {
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    } else if (leftTurns === 0 || rightTurns === 0) {
      const turningMotion = leftTurns !== 0 ? leftMotion : rightMotion;
      const turningRotDir =
        turningMotion.rotationDirection.toLowerCase() || "cw";
      return `(${turningRotDir}, ${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    } else {
      const leftRotDir =
        leftMotion.rotationDirection.toLowerCase() || "norotation";
      const rightRotDir =
        rightMotion.rotationDirection.toLowerCase() || "norotation";
      const direction = leftRotDir === rightRotDir ? "s" : "o";
      return `(${direction}, ${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    }
  }

  /**
   * Generate Gamma (γ) specific tuple with prop rotation state.
   * Format: (direction, blue_turns, red_turns, blue_open_close, red_open_close)
   */
  private generateGammaTuple(
    leftMotion: MotionData,
    rightMotion: MotionData,
    leftTurns: number | "fl",
    rightTurns: number | "fl"
  ): string {
    if (leftTurns === 0 && rightTurns === 0) {
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
    } else if (
      leftTurns === 0 &&
      typeof rightTurns === "number" &&
      rightTurns > 0
    ) {
      const rightOpenClose = getRightState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        rightMotion.rotationDirection
      );
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)}, ${rightOpenClose})`;
    } else if (
      typeof leftTurns === "number" &&
      leftTurns > 0 &&
      rightTurns === 0
    ) {
      const leftOpenClose = getLeftState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        leftMotion.rotationDirection
      );
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)}, ${leftOpenClose})`;
    } else if (
      typeof rightTurns === "number" &&
      rightTurns > 0 &&
      typeof leftTurns === "number" &&
      leftTurns > 0
    ) {
      const rightOpenClose = getRightState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        rightMotion.rotationDirection
      );
      const leftOpenClose = getLeftState(
        leftMotion.endLocation,
        rightMotion.endLocation,
        leftMotion.rotationDirection
      );
      const direction =
        leftMotion.rotationDirection === rightMotion.rotationDirection
          ? "s"
          : "o";
      return `(${direction}, ${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)}, ${leftOpenClose}, ${rightOpenClose})`;
    } else {
      return `(${this.formatTurns(leftTurns, leftMotion)}, ${this.formatTurns(rightTurns, rightMotion)})`;
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
   * Format turns value for string output. This is the one seam every tuple
   * shape (2/3/5-part) funnels through, so it's also where the halved-motion
   * marker gets appended - one place, not forked per letter type.
   *
   * `motion` is optional because a few callers (Lambda/gamma open-close paths)
   * format a bare turns number without a motion in scope; those slots can't
   * be halved anyway (segment lives on the motion, not the derived turns
   * value) so omitting it just skips the marker.
   */
  private formatTurns(turns: number | "fl", motion?: MotionData): string {
    const base =
      typeof turns === "number"
        ? turns === Math.floor(turns)
          ? Math.floor(turns).toString()
          : turns.toString()
        : turns; // Already a string ("fl")

    // "/" = midpoint-halved ONLY. Per the ratified notation canon
    // (docs/superpowers/specs/2026-07-16-half-notation-canon-design.md §2),
    // v1's fraction scope is midpoint-only ({t0:0, t1:0.5}) — other segment
    // fractions (e.g. a future quarter-freeze) are deferred and must NOT
    // emit the mark yet.
    const isMidpointSegment =
      motion?.segment?.t0 === 0 && motion.segment.t1 === 0.5;
    return isMidpointSegment ? `${base}/` : base;
  }
}

// DIRECT EXPORT - Use this instead of turnsTupleGenerator
// This avoids DI container rebuilds when this file changes
export const turnsTupleGenerator = new TurnsTupleGenerator();

/**
 * Rotation Angle Override Key Generator
 *
 * Generates keys for looking up rotation angle overrides in special placement JSON data.
 * Direct TypeScript mirror of legacy rotation_angle_override_key_generator.py
 *
 * ROTATION OVERRIDE SYSTEM:
 * - For DASH and STATIC motions, certain specific pictographs require different rotation angles
 * - These overrides are stored in special placement JSON with keys like:
 *   - "dash_from_layer2_rot_angle_override": true
 *   - "static_from_layer1_rot_angle_override": true
 * - When override flag is present, arrow uses different rotation angle maps
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import { Orientation } from "../../../../../shared/domain/enums/pictograph-enums";


export interface IRotationAngleOverrideKeyGenerator {
  generateRotationAngleOverrideKey(
    motionData: MotionData,
    pictographData: PictographData
  ): string;
}

export class RotationAngleOverrideKeyGenerator implements IRotationAngleOverrideKeyGenerator {
  /**
   * Generate rotation angle override key for special placement lookup.
   *
   * Follows exact logic from legacy ArrowRotAngleOverrideKeyGenerator:
   * 1. Mixed orientation ALWAYS uses motion_type_from_layer (takes priority)
   * 2. Special letters (α, β, γ, Φ-, Ψ-, Λ-) in standard orientation use color-based key
   * 3. Standard→Mixed uses motion_type_from_layer
   * 4. Default uses motion_type only
   *
   * IMPORTANT: Mixed orientation check must happen BEFORE special letter check
   * because layer3 JSON files use layer-based keys even for special letters.
   */
  generateRotationAngleOverrideKey(
    motionData: MotionData,
    pictographData: PictographData
  ): string {
    const motionType = motionData.motionType.toLowerCase() || "";
    const letter = pictographData.letter || "";
    const color = motionData.color || "";

    // PRIORITY 1: Mixed orientation uses layer-based key (even for special letters)
    // This must be checked FIRST because layer3 JSON files use layer-based keys
    if (this.startsFromMixedOrientation(pictographData)) {
      const startOriLayer = this.getStartOriLayer(motionData);
      return `${motionType}_from_${startOriLayer}_rot_angle_override`;
    }

    // PRIORITY 2: Standard→Mixed uses layer-based key
    if (
      this.startsFromStandardOrientation(pictographData) &&
      this.endsInMixedOrientation(pictographData)
    ) {
      const startOriLayer = this.getStartOriLayer(motionData);
      return `${motionType}_from_${startOriLayer}_rot_angle_override`;
    }

    // PRIORITY 3: Special letters in standard orientation use color-based key
    const specialLetters = ["α", "β", "γ", "Φ-", "Ψ-", "Λ-"];
    if (specialLetters.includes(letter)) {
      return `${color}_rot_angle_override`;
    }

    // Default: just motion type
    return `${motionType}_rot_angle_override`;
  }

  private getStartOriLayer(motionData: MotionData): string {
    const startOri = motionData.startOrientation;
    if (startOri === Orientation.IN || startOri === Orientation.OUT) {
      return "layer1";
    } else if (
      startOri === Orientation.CLOCK ||
      startOri === Orientation.COUNTER
    ) {
      return "layer2";
    }
    return "layer1"; // Default fallback
  }

  private getEndOriLayer(motionData: MotionData): string {
    const endOri = motionData.endOrientation;
    if (endOri === Orientation.IN || endOri === Orientation.OUT) {
      return "layer1";
    } else if (endOri === Orientation.CLOCK || endOri === Orientation.COUNTER) {
      return "layer2";
    }
    return "layer1"; // Default fallback
  }

  private startsFromMixedOrientation(pictographData: PictographData): boolean {
    try {
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;

      if (!blueMotion || !redMotion) {
        return false;
      }

      const blueStart = blueMotion.startOrientation || "";
      const redStart = redMotion.startOrientation || "";

      // Mixed if one is layer1 (IN/OUT) and other is layer2 (CLOCK/COUNTER)
      const blueLayer1 =
        blueStart === Orientation.IN || blueStart === Orientation.OUT;
      const redLayer1 =
        redStart === Orientation.IN || redStart === Orientation.OUT;

      return blueLayer1 !== redLayer1;
    } catch {
      return false;
    }
  }

  private startsFromStandardOrientation(
    pictographData: PictographData
  ): boolean {
    return !this.startsFromMixedOrientation(pictographData);
  }

  private endsInMixedOrientation(pictographData: PictographData): boolean {
    try {
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;

      if (!blueMotion || !redMotion) {
        return false;
      }

      const blueEnd = blueMotion.endOrientation || "";
      const redEnd = redMotion.endOrientation || "";

      // Mixed if one is layer1 (IN/OUT) and other is layer2 (CLOCK/COUNTER)
      const blueLayer1 =
        blueEnd === Orientation.IN || blueEnd === Orientation.OUT;
      const redLayer1 = redEnd === Orientation.IN || redEnd === Orientation.OUT;

      return blueLayer1 !== redLayer1;
    } catch {
      return false;
    }
  }
}

// DIRECT EXPORT - Use this instead of rotationAngleOverrideKeyGenerator
// This avoids DI container rebuilds when this file changes
export const rotationAngleOverrideKeyGenerator = new RotationAngleOverrideKeyGenerator();

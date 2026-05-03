/**
 * Arrow Placement Key Service
 *
 * Generates placement keys for arrow positioning lookups.
 * Simplified version of the desktop PlacementKeyGenerator logic.
 */

import { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
export class ArrowPlacementKeyGenerator {
  // Letter condition mappings from desktop
  private readonly dashLetterConditions = {
    TYPE3: ["W-", "X-", "Y-", "Z-", "Σ-", "Δ-", "Θ-", "Ω-"],
    TYPE5: ["Φ-", "Ψ-", "Λ-"],
  };

  /**
   * Generate placement key based on motion data and pictograph context
   */
  private getRawMotionType(motionData: MotionData): MotionType {
    return motionData.motionType;
  }

  generatePlacementKey(
    motionData: MotionData,
    pictographData: PictographData,
    availableKeys: string[]
  ): string {
    const rawMotionType = this.getRawMotionType(motionData);
    const motionType = this.normalizeMotionType(rawMotionType);

    // Generate candidate keys in order of preference
    const candidateKeys = this.generateCandidateKeys(
      motionData,
      pictographData
    );

    // Select the first available key from candidates
    for (const key of candidateKeys) {
      if (availableKeys.includes(key)) {
        return key;
      }
    }

    // Fallback to motion type
    return motionType;
  }

  /**
   * Generate basic key for motion type (fallback)
   */
  generateBasicKey(motionType: MotionType): string {
    return motionType;
  }

  /**
   * Generate candidate keys - EXACT legacy _select_key() logic
   * Only tries: key_with_letter, key (no letter), motion_type
   */
  private generateCandidateKeys(
    motionData: MotionData,
    pictographData: PictographData
  ): string[] {
    const rawMotionType = this.getRawMotionType(motionData);
    const motionType = this.normalizeMotionType(rawMotionType).toLowerCase();
    const letter = pictographData.letter;

    const candidates: string[] = [];

    // Detect layer info using legacy logic
    const layerInfo = this.detectLayerInfo(pictographData);

    if (letter) {
      // Try key with letter suffix (matching legacy key_with_letter)
      const letterSuffix = this.getLetterSuffix(letter);
      const keyWithLetter = this.generateLegacyStyleKey(
        motionType,
        layerInfo,
        letterSuffix,
        motionData
      );
      if (keyWithLetter) {
        candidates.push(keyWithLetter);
      }
    }

    // Try key without letter (matching legacy key)
    const keyNoLetter = this.generateLegacyStyleKey(
      motionType,
      layerInfo,
      "",
      motionData
    );
    if (keyNoLetter) {
      candidates.push(keyNoLetter);
    }

    // Finally, just motion type (matching legacy fallback)
    candidates.push(motionType);

    return candidates;
  }

  /**
   * Get letter suffix for placement key
   */
  private getLetterSuffix(letter: string): string {
    if (!letter) {
      return "";
    }

    // Check if letter needs dash handling (TYPE3/TYPE5)
    const allDashLetters = [
      ...this.dashLetterConditions.TYPE3,
      ...this.dashLetterConditions.TYPE5,
    ];

    if (allDashLetters.includes(letter)) {
      // Remove dash and add "_dash" suffix: "W-" → "_W_dash"
      const baseString = letter.slice(0, -1);
      return `_${baseString}_dash`;
    }

    // Regular letter: "A" → "_A"
    return `_${letter}`;
  }

  /**
   * Detect layer information using legacy logic
   */
  private detectLayerInfo(pictographData: PictographData): {
    hasRadialProps: boolean;
    hasNonRadialProps: boolean;
    hasHybridOrientation: boolean;
    hasAlphaProps: boolean;
    hasBetaProps: boolean;
    hasGammaProps: boolean;
  } {
    const redEndOri = pictographData.motions.red?.endOrientation;
    const blueEndOri = pictographData.motions.blue?.endOrientation;

    const radialOrientations = ["in", "out"];
    const nonRadialOrientations = ["clock", "counter"];

    let hasRadialProps: boolean;
    let hasNonRadialProps: boolean;
    let hasHybridOrientation: boolean;

    if (!redEndOri || !blueEndOri) {
      // Single-hand case: use available hand's orientation for layer,
      // default to alpha position. This gives a valid key like
      // "pro_to_layer1_alpha" instead of bare "pro" (which has no JSON match).
      const availableOri = blueEndOri || redEndOri;
      if (!availableOri) {
        return {
          hasRadialProps: false,
          hasNonRadialProps: false,
          hasHybridOrientation: false,
          hasAlphaProps: false,
          hasBetaProps: false,
          hasGammaProps: false,
        };
      }
      hasRadialProps = radialOrientations.includes(availableOri);
      hasNonRadialProps = nonRadialOrientations.includes(availableOri);
      hasHybridOrientation = false;

      // Can't determine position without both hands - default to alpha
      return {
        hasRadialProps,
        hasNonRadialProps,
        hasHybridOrientation,
        hasAlphaProps: true,
        hasBetaProps: false,
        hasGammaProps: false,
      };
    }

    const redIsRadial = radialOrientations.includes(redEndOri);
    const redIsNonRadial = nonRadialOrientations.includes(redEndOri);
    const blueIsRadial = radialOrientations.includes(blueEndOri);
    const blueIsNonRadial = nonRadialOrientations.includes(blueEndOri);

    // Layer detection logic (matching legacy)
    hasRadialProps = redIsRadial && blueIsRadial;
    hasNonRadialProps = redIsNonRadial && blueIsNonRadial;
    hasHybridOrientation =
      (redIsRadial && blueIsNonRadial) || (redIsNonRadial && blueIsRadial);

    // Letter type detection (matching legacy letter_condition_mappings.py)
    // ALPHA_ENDING, BETA_ENDING, GAMMA_ENDING conditions from legacy
    const letter = pictographData.letter;
    const alphaLetters = [
      // Type1 letters A-F
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      // Type2 letters W, X
      "W",
      "X",
      // Type3 cross-shift
      "W-",
      "X-",
      // Type4 dash
      "Φ",
      // Type5 dual-dash
      "Φ-",
      // Type6 static - lowercase Greek alpha
      "α",
    ];
    const betaLetters = [
      // Type1 letters G-L
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      // Type2 letters Y, Z
      "Y",
      "Z",
      // Type3 cross-shift
      "Y-",
      "Z-",
      // Type4 dash
      "Ψ",
      // Type5 dual-dash
      "Ψ-",
      // Type6 static - lowercase Greek beta
      "β",
    ];
    const gammaLetters = [
      // Type1 letters M-V
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      // Type2 Greek letters
      "Σ",
      "Δ",
      "Θ",
      "Ω",
      // Type3 cross-shift Greek
      "Σ-",
      "Δ-",
      "Θ-",
      "Ω-",
      // Type4 dash
      "Λ",
      // Type5 dual-dash
      "Λ-",
      // Type6 static - uppercase Greek gamma and new letters
      "γ",
      "ζ",
      "η",
      "τ",
      "⊕",
      // Type1 with lowercase gamma
      "γ",
      // Type2 Mu and Nu
      "μ",
      "ν",
    ];

    const hasAlphaProps = letter ? alphaLetters.includes(letter) : false;
    const hasBetaProps = letter ? betaLetters.includes(letter) : false;
    const hasGammaProps = letter ? gammaLetters.includes(letter) : false;

    return {
      hasRadialProps,
      hasNonRadialProps,
      hasHybridOrientation,
      hasAlphaProps,
      hasBetaProps,
      hasGammaProps,
    };
  }

  /**
   * Generate legacy-style placement key
   */
  private generateLegacyStyleKey(
    motionType: string,
    layerInfo: {
      hasRadialProps: boolean;
      hasNonRadialProps: boolean;
      hasHybridOrientation: boolean;
      hasAlphaProps: boolean;
      hasBetaProps: boolean;
      hasGammaProps: boolean;
    },
    letterSuffix: string,
    motionData?: MotionData
  ): string | null {
    // Build the key middle part (matching legacy logic)
    let keyMiddle = "";
    if (layerInfo.hasRadialProps) {
      keyMiddle = "layer1";
    } else if (layerInfo.hasNonRadialProps) {
      keyMiddle = "layer2";
    } else if (layerInfo.hasHybridOrientation) {
      // For layer3 (hybrid orientation), determine if arrow goes TO radial or nonradial
      // Check the specific arrow's END orientation
      const radialOrientations = ["in", "out"];
      const endOrientation = motionData?.endOrientation || "in";
      const goesToRadial = radialOrientations.includes(endOrientation);

      if (goesToRadial) {
        keyMiddle = "radial_layer3";
      } else {
        keyMiddle = "nonradial_layer3";
      }
    }

    // Add prop type
    if (layerInfo.hasAlphaProps) {
      keyMiddle += "_alpha";
    } else if (layerInfo.hasBetaProps) {
      keyMiddle += "_beta";
    } else if (layerInfo.hasGammaProps) {
      keyMiddle += "_gamma";
    }

    // Construct the final key
    if (keyMiddle) {
      return `${motionType}_to_${keyMiddle}${letterSuffix}`;
    }

    return null;
  }

  /**
   * Normalize motion type to standard format
   */
  private normalizeMotionType(motionType: unknown): MotionType {
    if (typeof motionType === "string") {
      const normalized = motionType.toLowerCase();
      switch (normalized) {
        case "pro":
          return MotionType.PRO;
        case "anti":
          return MotionType.ANTI;
        case "float":
          return MotionType.FLOAT;
        case "dash":
          return MotionType.DASH;
        case "static":
          return MotionType.STATIC;
      }
    }
    console.warn(
      `Invalid motion type: ${String(motionType)}, defaulting to 'pro'`
    );
    return MotionType.PRO;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowPlacementKeyGenerator to avoid DI container rebuilds.
// ============================================================================

export const arrowPlacementKeyGenerator = new ArrowPlacementKeyGenerator();

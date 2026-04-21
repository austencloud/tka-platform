/**
 * Letter Derivation Service
 *
 * Derives TKA letters from motion data by comparing against known patterns.
 * This service reverse-engineers the letter from motion parameters.
 */

// import type { LetterDerivationResult } from "$create/domain";

// Temporary interface definition
interface LetterDerivationResult {
  letter: Letter | null;
  confidence: "exact" | "partial" | "none";
  matchedParameters: string[];
}

import { Letter } from "../../../../foundation/domain/models/Letter";
import { GridMode } from "../../../grid/domain/enums/grid-enums";
import { MotionType } from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../shared/domain/models/PictographData";
export class LetterDeriver {
  private readonly letterPatterns: Map<string, Letter> = new Map();

  constructor() {
    this.initializeLetterPatterns();
  }

  /**
   * Derive letter from blue and red motion data
   */
  deriveLetterFromMotions(
    blueMotion: MotionData,
    redMotion: MotionData,
    gridMode: GridMode = GridMode.DIAMOND
  ): LetterDerivationResult {
    // Create motion signature
    const signature = this.createMotionSignature(
      blueMotion,
      redMotion,
      gridMode
    );

    // Try exact match first
    const exactMatch = this.letterPatterns.get(signature);
    if (exactMatch) {
      return {
        letter: exactMatch,
        confidence: "exact",
        matchedParameters: ["all"],
      };
    }

    // Try partial matching for common patterns
    const partialMatch = this.findPartialMatch(blueMotion, redMotion);
    if (partialMatch) {
      return partialMatch;
    }

    return {
      letter: null,
      confidence: "none",
      matchedParameters: [],
    };
  }

  /**
   * Create a unique signature from motion data
   */
  private createMotionSignature(
    blueMotion: MotionData,
    redMotion: MotionData,
    gridMode: GridMode
  ): string {
    const parts = [
      `blue:${blueMotion.motionType}`,
      `red:${redMotion.motionType}`,
      `blueStart:${blueMotion.startLocation}`,
      `blueEnd:${blueMotion.endLocation}`,
      `redStart:${redMotion.startLocation}`,
      `redEnd:${redMotion.endLocation}`,
      `blueRot:${blueMotion.rotationDirection}`,
      `redRot:${redMotion.rotationDirection}`,
      `blueTurns:${blueMotion.turns}`,
      `redTurns:${redMotion.turns}`,
      `grid:${gridMode}`,
    ];

    return parts.join("|");
  }

  /**
   * Find partial matches based on common patterns
   */
  private findPartialMatch(
    blueMotion: MotionData,
    redMotion: MotionData
  ): LetterDerivationResult | null {
    const matchedParams: string[] = [];

    // Check for static motions (start positions)
    if (
      blueMotion.motionType === MotionType.STATIC &&
      redMotion.motionType === MotionType.STATIC
    ) {
      matchedParams.push("static_motions");

      // Map static positions to Greek letters
      const positionKey = `${blueMotion.startLocation}_${redMotion.startLocation}`;
      const staticLetterMap: Record<string, Letter> = {
        south_north: Letter.ALPHA,
        south_south: Letter.BETA,
        south_east: Letter.GAMMA,
      };

      const letter = staticLetterMap[positionKey];
      if (letter) {
        matchedParams.push("position_mapping");
        return {
          letter,
          confidence: "partial",
          matchedParameters: matchedParams,
        };
      }
    }

    // Check for common Type 1 patterns (dual shift)
    if (
      this.isShiftMotion(blueMotion.motionType) &&
      this.isShiftMotion(redMotion.motionType)
    ) {
      matchedParams.push("dual_shift");

      // Simple heuristic: map to common letters based on motion types
      if (
        blueMotion.motionType === MotionType.PRO &&
        redMotion.motionType === MotionType.PRO
      ) {
        return {
          letter: Letter.A, // Default to A for pro-pro patterns
          confidence: "partial",
          matchedParameters: matchedParams,
        };
      }
    }

    return null;
  }

  /**
   * Check if motion type is a shift motion
   */
  private isShiftMotion(motionType: MotionType): boolean {
    const shiftTypes: MotionType[] = [
      MotionType.PRO,
      MotionType.ANTI,
      MotionType.FLOAT,
    ];
    return shiftTypes.includes(motionType);
  }

  /**
   * Initialize known letter patterns
   * This would ideally be loaded from CSV data or a configuration file
   */
  private initializeLetterPatterns(): void {
    // Add some basic patterns - this should be expanded with actual CSV data

    // Alpha1 start position (south_north static)
    this.letterPatterns.set(
      "blue:static|red:static|blueStart:south|blueEnd:south|redStart:north|redEnd:north|blueRot:no_rotation|redRot:no_rotation|blueTurns:0|redTurns:0|grid:diamond",
      Letter.ALPHA
    );

    // Beta5 start position (south_south static)
    this.letterPatterns.set(
      "blue:static|red:static|blueStart:south|blueEnd:south|redStart:south|redEnd:south|blueRot:no_rotation|redRot:no_rotation|blueTurns:0|redTurns:0|grid:diamond",
      Letter.BETA
    );

    // Gamma11 start position (south_east static)
    this.letterPatterns.set(
      "blue:static|red:static|blueStart:south|blueEnd:south|redStart:east|redEnd:east|blueRot:no_rotation|redRot:no_rotation|blueTurns:0|redTurns:0|grid:diamond",
      Letter.GAMMA
    );

    // TODO: Add more patterns from CSV data
    // This should be expanded to include all known letter patterns
  }

  /**
   * Derive letter from pictograph data
   */
  deriveLetterFromPictograph(
    pictograph: PictographData
  ): LetterDerivationResult {
    if (!pictograph.motions.blue || !pictograph.motions.red) {
      return {
        letter: null,
        confidence: "none",
        matchedParameters: [],
      };
    }

    return this.deriveLetterFromMotions(
      pictograph.motions.blue,
      pictograph.motions.red
    );
  }

  /**
   * Validate if a letter matches the given motions
   */
  validateLetterMatch(
    letter: Letter,
    blueMotion: MotionData,
    redMotion: MotionData
  ): boolean {
    const result = this.deriveLetterFromMotions(blueMotion, redMotion);
    return result.letter === letter && result.confidence === "exact";
  }
}

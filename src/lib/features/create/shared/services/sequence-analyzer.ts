import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BetaDetector } from "$lib/shared/pictograph/prop/services/implementations/BetaDetector";

/**
 * Circular Sequence Type
 */
export type CircularType = "same" | "halved" | "quartered";

/**
 * LOOP (Linked Orbital Offset Pattern) Type
 */
export type StrictLoopType =
  | "rotated"
  | "mirrored"
  | "rotated-mirrored"
  | "static";

/**
 * Circularity Analysis Result
 */
export interface CircularityAnalysis {
  /** Whether the sequence forms a valid circular pattern */
  readonly isCircular: boolean;
  /** Type of circular relationship (same/halved/quartered) */
  readonly circularType: CircularType | null;
  /** Starting position of the sequence */
  readonly startPosition: GridPosition | null;
  /** Ending position of the sequence */
  readonly endPosition: GridPosition | null;
  /** Whether start position is a beta position */
  readonly startIsBeta: boolean;
  /** Whether end position is a beta position */
  readonly endIsBeta: boolean;
  /** Possible LOOP types this sequence could become */
  readonly possibleLoopTypes: readonly StrictLoopType[];
  /** Human-readable description of the circular relationship */
  readonly description: string;
}
import {
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} from "../../generate/circular/domain/constants/circular-position-maps";
import {
  SWAPPED_POSITION_MAP,
  VERTICAL_MIRROR_POSITION_MAP,
} from "../../generate/circular/domain/constants/strict-loop-position-maps";

/**
 * Sequence Analysis Service Implementation
 *
 * Analyzes sequences to detect circular patterns and LOOP (Linked Orbital Offset Pattern) potential.
 *
 * Key Concepts:
 * - Circular sequences can be "autocompleted" by applying LOOP transformations
 * - The start→end position relationship determines which LOOP types are possible
 * - Uses predefined position maps (quartered, halved, mirrored, swapped, inverted)
 * - Intermediate pictographs are irrelevant - only start/end positions matter
 */
export class SequenceAnalyzer {
  constructor(private readonly BetaDetector: BetaDetector) {}

  /**
   * Analyze a sequence for circular properties
   */
  analyzeCircularity(sequence: SequenceData): CircularityAnalysis {
    // Get start and end steps
    const startStep = this.getStartBeat(sequence);
    const endStep = this.getEndBeat(sequence);

    // Default non-circular result
    const defaultResult: CircularityAnalysis = {
      isCircular: false,
      circularType: null,
      startPosition: null,
      endPosition: null,
      startIsBeta: false,
      endIsBeta: false,
      possibleLoopTypes: [],
      description: "Not circular",
    };

    // Check if we have valid start and end steps
    if (!startStep || !endStep) {
      return defaultResult;
    }

    // Get start and end positions
    const startPosition = startStep.startPosition;
    const endPosition = endStep.endPosition;

    if (!startPosition || !endPosition) {
      return defaultResult;
    }

    // Check if both positions are in the same position group
    const sameGroup = this.areSamePositionGroup(startPosition, endPosition);
    const startIsBeta = this.isBetaPosition(startPosition);
    const endIsBeta = this.isBetaPosition(endPosition);

    if (!sameGroup) {
      return {
        ...defaultResult,
        startPosition,
        endPosition,
        startIsBeta,
        endIsBeta,
        description: "Positions are not in the same position group",
      };
    }

    // Determine circular type
    const circularType = this.getCircularType(startPosition, endPosition);

    if (!circularType) {
      return {
        ...defaultResult,
        startPosition,
        endPosition,
        startIsBeta,
        endIsBeta,
        description: "Invalid circular relationship",
      };
    }

    // Get possible LOOP types based on circular type
    const possibleLoopTypes =
      this.getPossibleLoopTypesForCircularType(circularType);

    return {
      isCircular: true,
      circularType,
      startPosition,
      endPosition,
      startIsBeta,
      endIsBeta,
      possibleLoopTypes,
      description: this.buildCircularDescription(
        startPosition,
        endPosition,
        circularType
      ),
    };
  }

  /**
   * Check if a sequence is circular-capable (simple boolean check)
   */
  isCircularCapable(sequence: SequenceData): boolean {
    const analysis = this.analyzeCircularity(sequence);
    return analysis.isCircular;
  }

  /**
   * Get possible LOOP types for a circular sequence
   */
  getPossibleLoopTypes(sequence: SequenceData): readonly StrictLoopType[] {
    const analysis = this.analyzeCircularity(sequence);
    return analysis.possibleLoopTypes;
  }

  /**
   * Determine the circular relationship between two positions
   *
   * Uses the predefined transformation maps to check if the start→end pair
   * exists in any of the LOOP validation sets:
   * - Same position → 'same' (inverted, mirrored, swapped)
   * - Quartered map → 'quartered' (90° rotation)
   * - Halved map → 'halved' (180° rotation)
   */
  getCircularType(
    startPosition: GridPosition,
    endPosition: GridPosition
  ): CircularType | null {
    const positionKey = `${startPosition},${endPosition}`;

    // Check if same position (inverted LOOP)
    if (startPosition === endPosition) {
      return "same";
    }

    // Check quartered LOOPs (90° rotation)
    if (QUARTERED_LOOPS.has(positionKey)) {
      return "quartered";
    }

    // Check halved LOOPs (180° rotation)
    if (HALVED_LOOPS.has(positionKey)) {
      return "halved";
    }

    // Check mirrored positions (also 'same' type)
    if (VERTICAL_MIRROR_POSITION_MAP[startPosition] === endPosition) {
      return "same";
    }

    // Check swapped positions (also 'halved' type since alpha1→alpha5 is both)
    if (SWAPPED_POSITION_MAP[startPosition] === endPosition) {
      return "halved";
    }

    return null;
  }

  /**
   * Check if a position is a beta position
   */
  isBetaPosition(position: GridPosition): boolean {
    return this.BetaDetector.isBetaPosition(position);
  }

  /**
   * Check if both positions are in the same position group
   */
  private areSamePositionGroup(
    pos1: GridPosition,
    pos2: GridPosition
  ): boolean {
    const info1 = this.extractPositionInfo(pos1);
    const info2 = this.extractPositionInfo(pos2);

    if (!info1 || !info2) return false;

    return info1.group === info2.group;
  }

  /**
   * Get the first beat with valid pictograph data (start beat)
   */
  getStartBeat(sequence: SequenceData): StepData | null {
    if (!sequence.steps || sequence.steps.length === 0) {
      return null;
    }

    // Find first beat with a start position
    for (const step of sequence.steps) {
      if (step.startPosition && !step.isBlank) {
        return step;
      }
    }

    return null;
  }

  /**
   * Get the last beat with valid pictograph data (end beat)
   */
  getEndBeat(sequence: SequenceData): StepData | null {
    if (!sequence.steps || sequence.steps.length === 0) {
      return null;
    }

    // Find last beat with an end position (iterate backwards)
    for (let i = sequence.steps.length - 1; i >= 0; i--) {
      const beat = sequence.steps[i];
      if (beat?.endPosition && !beat.isBlank) {
        return beat;
      }
    }

    return null;
  }

  /**
   * Get a human-readable description of the circular relationship
   */
  getCircularDescription(analysis: CircularityAnalysis): string {
    return analysis.description;
  }

  /**
   * Detect the actual LOOP type of a COMPLETED sequence
   *
   * Analyzes ALL consecutive beat transformations to determine what type
   * of completed LOOP pattern the sequence represents.
   */
  detectCompletedLoopTypes(sequence: SequenceData): readonly StrictLoopType[] {
    if (!sequence.steps || sequence.steps.length === 0) {
      return [];
    }

    // Filter out blank steps
    const validSteps = sequence.steps.filter(
      (step) => !step.isBlank && step.endPosition
    );

    if (validSteps.length === 0) {
      return [];
    }

    // Check 1: Static LOOP - all steps at the same position
    const allSamePosition = validSteps.every(
      (step) =>
        step.startPosition === validSteps[0]!.startPosition &&
        step.endPosition === validSteps[0]!.endPosition
    );

    if (allSamePosition) {
      return ["static"] as const;
    }

    // Build consecutive pairs: each beat's end → next beat's start
    const consecutivePairs: Array<{ from: GridPosition; to: GridPosition }> =
      [];

    for (let i = 0; i < validSteps.length; i++) {
      const currentStep = validSteps[i];
      const nextStep = validSteps[(i + 1) % validSteps.length]; // Wrap around to first beat

      if (
        currentStep &&
        nextStep &&
        currentStep.endPosition &&
        nextStep.startPosition
      ) {
        consecutivePairs.push({
          from: currentStep.endPosition,
          to: nextStep.startPosition,
        });
      }
    }

    if (consecutivePairs.length === 0) {
      return [];
    }

    // Check 2: Rotated LOOP - all consecutive pairs show 90° rotation
    const allQuartered = consecutivePairs.every((pair) => {
      const key = `${pair.from},${pair.to}`;
      return QUARTERED_LOOPS.has(key);
    });

    if (allQuartered) {
      return ["rotated"] as const;
    }

    // Check 3: Mirrored LOOP - all consecutive pairs show mirroring
    const allMirrored = consecutivePairs.every((pair) => {
      const key = `${pair.from},${pair.to}`;

      // Check halved caps (180° mirroring)
      if (HALVED_LOOPS.has(key)) {
        return true;
      }

      // Check vertical mirror map
      if (VERTICAL_MIRROR_POSITION_MAP[pair.from] === pair.to) {
        return true;
      }

      // Check swapped positions
      if (SWAPPED_POSITION_MAP[pair.from] === pair.to) {
        return true;
      }

      // Check if same position (like alpha1 → alpha1 with mirrored turns)
      if (pair.from === pair.to) {
        return true;
      }

      return false;
    });

    if (allMirrored) {
      return ["mirrored"] as const;
    }

    // If none of the patterns match, return empty
    return [];
  }

  /**
   * Get possible LOOP types based on circular type
   *
   * Mapping:
   * - 'same' → ['static']
   * - 'halved' → ['mirrored']
   * - 'quartered' → ['rotated']
   */
  private getPossibleLoopTypesForCircularType(
    circularType: CircularType
  ): readonly StrictLoopType[] {
    switch (circularType) {
      case "same":
        return ["static"] as const;
      case "halved":
        return ["mirrored"] as const;
      case "quartered":
        return ["rotated"] as const;
    }
  }

  /**
   * Build a human-readable description
   */
  private buildCircularDescription(
    startPosition: GridPosition,
    endPosition: GridPosition,
    circularType: CircularType
  ): string {
    const typeDescriptions: Record<CircularType, string> = {
      same: "Same position",
      halved: "Opposite/halved position (180°)",
      quartered: "Adjacent/quartered position (90°)",
    };

    const typeDesc = typeDescriptions[circularType];
    return `${typeDesc}: ${startPosition} → ${endPosition}`;
  }

  /**
   * Extract position group and number from a GridPosition
   */
  private extractPositionInfo(
    position: GridPosition
  ): { group: string; number: number; groupSize: number } | null {
    const positionStr = position.toString().toLowerCase();
    const match = positionStr.match(/^(alpha|beta|gamma)(\d+)$/);
    if (!match) return null;

    const group = match[1]!;
    const num = parseInt(match[2]!, 10);

    let groupSize: number;
    let maxNum: number;

    if (group === "alpha" || group === "beta") {
      groupSize = 8;
      maxNum = 8;
    } else if (group === "gamma") {
      groupSize = 16;
      maxNum = 16;
    } else {
      return null;
    }

    if (num < 1 || num > maxNum) {
      return null;
    }

    return { group, number: num, groupSize };
  }

  // ============ Position Extraction Methods ============

  /**
   * Get the starting position from a sequence.
   * Checks multiple possible locations for start position data.
   */
  getStartPosition(sequence: SequenceData): GridPosition | null {
    // Check for explicit start position data object
    if (sequence.startPosition) {
      const startPosData = sequence.startPosition as unknown as Record<
        string,
        unknown
      >;

      // Internal format: startPosition field
      if ("startPosition" in startPosData && startPosData.startPosition) {
        return startPosData.startPosition as GridPosition;
      }
      // External/JSON format: start field
      if ("start" in startPosData && startPosData.start) {
        return startPosData.start as GridPosition;
      }
      // gridPosition field (StartPositionData format)
      if ("gridPosition" in startPosData && startPosData.gridPosition) {
        return startPosData.gridPosition as GridPosition;
      }
    }

    // Check for startingPosition (legacy field)
    const startStep = sequence.startingPosition as
      | Record<string, unknown>
      | undefined;
    if (startStep) {
      if ("startPosition" in startStep && startStep.startPosition) {
        return startStep.startPosition as GridPosition;
      }
      if ("start" in startStep && startStep.start) {
        return startStep.start as GridPosition;
      }
    }

    // Check first beat (beat 0) if it's the start position
    const steps = sequence.steps || [];
    const firstStep = steps.find(
      (b) =>
        b.stepNumber === 0 ||
        (b as unknown as Record<string, unknown>).beat === 0
    );
    if (firstStep) {
      const stepData = firstStep as unknown as Record<string, unknown>;
      if (stepData.startPosition) {
        return stepData.startPosition as GridPosition;
      }
      if (stepData.start) {
        return stepData.start as GridPosition;
      }
    }

    return null;
  }

  /**
   * Get the current end position from the last beat in a sequence.
   */
  getCurrentEndPosition(sequence: SequenceData): GridPosition | null {
    const steps = sequence.steps || [];
    if (steps.length === 0) return null;

    // Helper to get beat number from either format
    const getStepNumber = (beat: Record<string, unknown>): number => {
      if (typeof beat.stepNumber === "number") return beat.stepNumber;
      if (typeof beat.beat === "number") return beat.beat;
      return 0;
    };

    // Helper to get end position from either format
    const getEndPosition = (beat: Record<string, unknown>): string | null => {
      if (beat.endPosition) return beat.endPosition as string;
      if (beat.end) return beat.end as string;
      return null;
    };

    // Find the last actual beat (not the start position beat 0)
    const beatsAsRecords = steps as unknown as Record<string, unknown>[];
    const sortedSteps = [...beatsAsRecords].sort(
      (a, b) => getStepNumber(b) - getStepNumber(a)
    );
    const lastStep =
      sortedSteps.find((b) => getStepNumber(b) > 0) || sortedSteps[0];

    if (lastStep) {
      const endPos = getEndPosition(lastStep);
      if (endPos) {
        return endPos as GridPosition;
      }
    }

    return null;
  }

  /**
   * Convert a SequenceData to StepData array for LOOP executor.
   * The LOOP executor expects: [startPosition (beat 0), beat 1, beat 2, ...]
   */
  convertSequenceToBeats(sequence: SequenceData): StepData[] {
    const steps = sequence.steps || [];
    const result: StepData[] = [];

    // Check if beat 0 (start position) is already in steps array
    const step0 = steps.find((b) => b.stepNumber === 0);

    if (step0) {
      // Beat 0 exists in the array, just sort and return
      return [...steps]
        .filter((b) => b.stepNumber >= 0)
        .sort((a, b) => a.stepNumber - b.stepNumber);
    }

    // Beat 0 not in array - need to create it from startPosition/startingPosition
    const startPosData =
      sequence.startPosition || sequence.startingPosition;

    if (startPosData) {
      const startPos = this.getStartPosition(sequence);
      // Create a beat 0 entry from the start position data
      const startStep: StepData = {
        id: "start-position",
        stepNumber: 0,
        startPosition: startPos,
        endPosition: startPos, // Start position ends where it starts
        letter: null,
        motions:
          ((startPosData as unknown as Record<string, unknown>)
            .motions as Record<string, unknown>) || {},
        duration: 1,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      };
      result.push(startStep);
    }

    // Add all actual steps (beat 1+)
    const actualSteps = steps
      .filter((b) => b.stepNumber > 0)
      .sort((a, b) => a.stepNumber - b.stepNumber);

    result.push(...actualSteps);

    return result;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { betaDetector } from "$lib/shared/pictograph/prop/services/implementations/BetaDetector";

export const sequenceAnalyzer = new SequenceAnalyzer(betaDetector);

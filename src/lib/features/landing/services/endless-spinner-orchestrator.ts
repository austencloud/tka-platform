/**
 * Endless Spinner Orchestrator Implementation
 *
 * Manages continuous sequence playback by chaining sequences together seamlessly.
 * Uses an index of sequences by start state for O(1) lookup.
 * Falls back to rotating circular sequences or generating bridges when no direct match.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import type { GenerationOrchestrator } from "$lib/shared/create/services/GenerationOrchestrator";
import type { SequenceTransformer } from "$lib/features/create/shared/services/sequence-transforms/sequence-transformer";
import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type {
  EndState, PositionGroup, SpinnerStats } from "$lib/shared/landing/domain/types";
import {
  GridMode,
  GridPosition,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  Orientation} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GenerationMode,
  DifficultyLevel,
  PropContinuity,
} from "$lib/shared/foundation/domain/models/generation/generate-models";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
} from "$lib/shared/create/services/sequence-transforms";
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
// Cardinal locations (for DIAMOND grid) and intercardinal (for BOX grid)
const CARDINAL_LOCATIONS: ReadonlySet<GridLocation> = new Set<GridLocation>([
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
]);

const INTERCARDINAL_LOCATIONS: ReadonlySet<GridLocation> = new Set<GridLocation>([
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
]);

/**
 * Validate motion data for consistency and flag any issues.
 * Returns an array of warning messages.
 */
function validateMotionData(
  sequence: SequenceData,
  label: string
): string[] {
  const warnings: string[] = [];
  const seqGridMode = sequence.gridMode ?? GridMode.DIAMOND;

  // Check start position
  if (sequence.startPosition?.motions) {
    const blue = sequence.startPosition.motions[MotionColor.BLUE];
    const red = sequence.startPosition.motions[MotionColor.RED];

    if (blue) {
      if (blue.gridMode !== seqGridMode) {
        warnings.push(`StartPos blue motion gridMode (${blue.gridMode}) != sequence (${seqGridMode})`);
      }
      if (seqGridMode === GridMode.DIAMOND && blue.endLocation && INTERCARDINAL_LOCATIONS.has(blue.endLocation)) {
        warnings.push(`StartPos blue has intercardinal location ${blue.endLocation} in DIAMOND mode`);
      }
      if (seqGridMode === GridMode.BOX && blue.endLocation && CARDINAL_LOCATIONS.has(blue.endLocation)) {
        warnings.push(`StartPos blue has cardinal location ${blue.endLocation} in BOX mode`);
      }
    }
    if (red) {
      if (red.gridMode !== seqGridMode) {
        warnings.push(`StartPos red motion gridMode (${red.gridMode}) != sequence (${seqGridMode})`);
      }
    }
  }

  // Check each beat
  sequence.steps?.forEach((step, idx) => {
    const stepNum = idx + 1;
    const blue = step.motions?.[MotionColor.BLUE];
    const red = step.motions?.[MotionColor.RED];

    if (blue) {
      if (blue.gridMode !== seqGridMode) {
        warnings.push(`Beat ${stepNum} blue gridMode (${blue.gridMode}) != sequence (${seqGridMode})`);
      }
      if (!blue.endOrientation) {
        warnings.push(`Beat ${stepNum} blue missing endOrientation`);
      }
      if (!blue.endLocation) {
        warnings.push(`Beat ${stepNum} blue missing endLocation`);
      }
    }
    if (red) {
      if (red.gridMode !== seqGridMode) {
        warnings.push(`Beat ${stepNum} red gridMode (${red.gridMode}) != sequence (${seqGridMode})`);
      }
    }
  });

  if (warnings.length > 0) {
    console.warn(`[EndlessSpinner] ${label} validation warnings:`, warnings);
  }

  return warnings;
}

/**
 * Get the Greek letter for a position group.
 * Start positions use lowercase Greek letters: α (alpha), β (beta), γ (gamma)
 */
function getLetterForPositionGroup(group: PositionGroup | null): Letter | null {
  switch (group) {
    case "alpha":
      return Letter.ALPHA; // "α"
    case "beta":
      return Letter.BETA; // "β"
    case "gamma":
      return Letter.GAMMA; // "γ"
    default:
      return null;
  }
}

/**
 * A sequence that can be rotated to match a target start state.
 */
interface RotatableMatch {
  sequence: SequenceData;
  /** Beat number to rotate to (this beat becomes the new beat 1) */
  targetStepNumber: number;
}

/**
 * Create a key for indexing sequences by their start state.
 */
function createStartStateKey(
  position: GridPosition | string | null,
  blueOrientation: Orientation | null,
  redOrientation: Orientation | null
): string {
  return `${position ?? "null"}_${blueOrientation ?? "null"}_${redOrientation ?? "null"}`;
}

/**
 * Extract position group from a grid position string.
 */
function getPositionGroup(position: GridPosition | string | null): PositionGroup | null {
  if (!position) return null;
  const posStr = position.toString().toLowerCase();
  if (posStr.startsWith("alpha")) return "alpha";
  if (posStr.startsWith("beta")) return "beta";
  if (posStr.startsWith("gamma")) return "gamma";
  return null;
}

/**
 * Extract the position number from a GridPosition.
 * e.g., ALPHA3 → 3, GAMMA11 → 11
 */
function getPositionNumber(position: GridPosition | string | null): number | null {
  if (!position) return null;
  const match = position.toString().match(/\d+$/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Calculate rotation steps needed to transform from one position to another.
 * Positions within each group are numbered 1-8 (or 1-16 for gamma).
 * Each rotation step is 45°.
 * Returns the number of 45° clockwise steps (can be negative for CCW).
 */
function calculateRotationSteps(
  fromPosition: GridPosition | string | null,
  toPosition: GridPosition | string | null
): number | null {
  const fromGroup = getPositionGroup(fromPosition);
  const toGroup = getPositionGroup(toPosition);

  // Can only rotate within the same position group
  if (!fromGroup || !toGroup || fromGroup !== toGroup) return null;

  const fromNum = getPositionNumber(fromPosition);
  const toNum = getPositionNumber(toPosition);

  if (fromNum === null || toNum === null) return null;

  // Determine the cycle length based on position group
  // Alpha/Beta have positions 1-8, Gamma has 1-8 and 9-16 (two separate cycles)
  const cycleLength = 8;
  if (fromGroup === "gamma") {
    // Gamma 1-8 and Gamma 9-16 are separate cycles
    const fromCycle = fromNum <= 8 ? "low" : "high";
    const toCycle = toNum <= 8 ? "low" : "high";
    if (fromCycle !== toCycle) return null; // Can't rotate between gamma cycles
  }

  // Normalize positions to 0-7 range for the cycle
  const normalizedFrom = ((fromNum - 1) % cycleLength);
  const normalizedTo = ((toNum - 1) % cycleLength);

  // Calculate the difference
  let diff = normalizedTo - normalizedFrom;

  // Normalize to shortest rotation (-3 to +4 for 8-position cycle)
  if (diff > cycleLength / 2) diff -= cycleLength;
  if (diff < -cycleLength / 2) diff += cycleLength;

  return diff;
}

/**
 * Get a random position from a position group for bridge generation.
 */
function getRandomPositionInGroup(group: PositionGroup, gridMode: GridMode): GridPosition {
  const positions: Record<PositionGroup, GridPosition[]> = {
    alpha:
      gridMode === GridMode.DIAMOND
        ? [GridPosition.ALPHA1, GridPosition.ALPHA3, GridPosition.ALPHA5, GridPosition.ALPHA7]
        : [GridPosition.ALPHA2, GridPosition.ALPHA4, GridPosition.ALPHA6, GridPosition.ALPHA8],
    beta:
      gridMode === GridMode.DIAMOND
        ? [GridPosition.BETA1, GridPosition.BETA3, GridPosition.BETA5, GridPosition.BETA7]
        : [GridPosition.BETA2, GridPosition.BETA4, GridPosition.BETA6, GridPosition.BETA8],
    gamma:
      gridMode === GridMode.DIAMOND
        ? [GridPosition.GAMMA1, GridPosition.GAMMA5, GridPosition.GAMMA9, GridPosition.GAMMA13]
        : [GridPosition.GAMMA3, GridPosition.GAMMA7, GridPosition.GAMMA11, GridPosition.GAMMA15],
  };

  const options = positions[group];
  return options[Math.floor(Math.random() * options.length)]!;
}

/**
 * Pick a random item from an array.
 */
function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)]!;
}

/**
 * Get the next position group in the cycle (for bridge variety).
 */
function _getNextPositionGroup(current: PositionGroup | null): PositionGroup {
  const cycle: PositionGroup[] = ["alpha", "beta", "gamma"];
  if (!current) return pickRandom(cycle)!;
  const currentIndex = cycle.indexOf(current);
  return cycle[(currentIndex + 1) % cycle.length]!;
}

/**
 * Get the gamma cycle (low or high) for a gamma position.
 * GAMMA1-8 are "low" cycle, GAMMA9-16 are "high" cycle.
 * Returns null for non-gamma positions.
 */
function getGammaCycle(position: GridPosition | string | null): "low" | "high" | null {
  if (!position) return null;
  const group = getPositionGroup(position);
  if (group !== "gamma") return null;

  const num = getPositionNumber(position);
  if (num === null) return null;

  return num <= 8 ? "low" : "high";
}

export class EndlessSpinnerOrchestrator {
  /** All circular sequences loaded from database */
  private circularSequences: SequenceData[] = [];

  /** Index of sequences by start state for O(1) lookup */
  private sequenceIndex = new Map<string, SequenceData[]>();

  /** Set of unique sequence IDs used in this session */
  private usedSequenceIds = new Set<string>();

  /** Ready state */
  private ready = false;

  /** Session statistics */
  private stats: SpinnerStats = {
    sequencesPlayed: 0,
    uniqueSequencesUsed: 0,
    directMatches: 0,
    rotatedMatches: 0,
    bridgesGenerated: 0,
  };

  constructor(
    private readonly browseLoader: PublicSequencesLoader,
    private readonly generationOrchestrator: GenerationOrchestrator,
    private readonly sequenceTransformer: SequenceTransformer,
    private readonly startPositionDeriver: StartPositionDeriver
  ) {}

  async initialize(): Promise<void> {
    if (this.ready) return;

    try {
      // Load all sequence metadata
      const allSequences = await this.browseLoader.loadSequenceMetadata();

      // Filter for circular sequences only (LOOPs loop seamlessly)
      this.circularSequences = allSequences.filter((seq) => seq.isCircular === true);

      if (this.circularSequences.length === 0) {
        console.warn("[EndlessSpinner] No circular sequences found, using all sequences");
        this.circularSequences = allSequences;
      }

      // NOTE: We don't pre-build the index anymore - it was too slow
      // Instead, we load sequences on-demand and cache them

      this.ready = true;
    } catch (error) {
      console.error("[EndlessSpinner] Failed to initialize:", error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Build an index of sequences by their start state for fast lookup.
   */
  private async buildSequenceIndex(): Promise<void> {
    this.sequenceIndex.clear();

    for (const sequence of this.circularSequences) {
      // Load full sequence data to get the steps
      const fullSequence = await this.browseLoader.loadFullSequenceData(sequence.word);
      if (!fullSequence?.steps || fullSequence.steps.length === 0) continue;

      // Get or derive start position
      const startPos = this.startPositionDeriver.getOrDeriveStartPosition(fullSequence);
      if (!startPos) continue;

      // Extract start state
      const position = (startPos as StartPositionData).gridPosition ??
        (startPos as StepData).startPosition ??
        null;
      const blueOri = startPos.motions?.blue?.startOrientation ?? null;
      const redOri = startPos.motions?.red?.startOrientation ?? null;

      const key = createStartStateKey(position, blueOri, redOri);

      // Add to index
      if (!this.sequenceIndex.has(key)) {
        this.sequenceIndex.set(key, []);
      }
      this.sequenceIndex.get(key)!.push(fullSequence);
    }
  }

  async getNextSequence(endState: EndState): Promise<SequenceData | null> {
    if (!this.ready) {
      return null;
    }

    // Strategy 1: Enhanced algorithm - scan ALL sequences for any beat that passes through target position
    const transformed = await this.findAndTransformAnySequence(endState);
    if (transformed) {
      this.stats.rotatedMatches++;
      return this.recordAndReturn(transformed);
    }

    // Strategy 2: Fallback to old approach - find sequence starting in same position group
    const targetGroup = getPositionGroup(endState.position);
    if (targetGroup) {
      const transformedSequence = await this.findAndTransformSequence(endState, targetGroup);
      if (transformedSequence) {
        this.stats.rotatedMatches++;
        return this.recordAndReturn(transformedSequence);
      }
    }

    // Strategy 3: Last resort - any random sequence (non-seamless but keeps playing)
    const fallback = await this.getRandomSequence();
    if (fallback) {
      this.stats.directMatches++;
      return this.recordAndReturn(fallback);
    }

    return null;
  }

  /**
   * Derive the grid position from a beat's end state using motion end locations.
   */
  private deriveBeatEndPosition(beat: StepData): GridPosition | null {
    const blueMotion = beat.motions?.[MotionColor.BLUE];
    const redMotion = beat.motions?.[MotionColor.RED];

    if (blueMotion?.endLocation && redMotion?.endLocation) {
      try {
        return getGridPositionFromLocations(
          blueMotion.endLocation,
          redMotion.endLocation
        );
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Enhanced algorithm: Find ANY circular sequence that passes through the target position group
   * at any beat, then apply transforms to make it match exactly.
   */
  private async findAndTransformAnySequence(endState: EndState): Promise<SequenceData | null> {
    const targetGroup = getPositionGroup(endState.position);
    if (!targetGroup) return null;

    const targetGammaCycle = getGammaCycle(endState.position);

    // Shuffle sequences for variety
    const shuffled = [...this.circularSequences].sort(() => Math.random() - 0.5);

    // Limit attempts for performance (scanning all steps is O(n*m))
    const maxSequenceAttempts = Math.min(20, shuffled.length);

    for (let seqIdx = 0; seqIdx < maxSequenceAttempts; seqIdx++) {
      const candidate = shuffled[seqIdx];
      if (!candidate) continue;

      // Prefer unused sequences
      if (this.usedSequenceIds.has(candidate.id) && seqIdx < maxSequenceAttempts - 5) {
        continue;
      }

      // Load full sequence data
      const fullSequence = await this.browseLoader.loadFullSequenceData(candidate.word);
      if (!fullSequence?.steps?.length || !fullSequence.isCircular) continue;

      // Scan each beat for a position match
      for (let stepIndex = 0; stepIndex < fullSequence.steps.length; stepIndex++) {
        const beat = fullSequence.steps[stepIndex];
        if (!beat) continue;

        const stepEndPosition = this.deriveBeatEndPosition(beat);
        const beatGroup = getPositionGroup(stepEndPosition);

        // Check if beat is in target position group
        if (beatGroup !== targetGroup) continue;

        // For gamma, also check cycle compatibility
        if (targetGroup === "gamma") {
          const beatCycle = getGammaCycle(stepEndPosition);
          if (beatCycle !== targetGammaCycle) continue;
        }

        // Found a beat that passes through target group!
        // Apply three-step transform pipeline
        const result = await this.applyTransformPipeline(
          fullSequence,
          stepIndex,
          stepEndPosition!,
          endState
        );

        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  /**
   * Apply the three-step transform pipeline:
   * 1. First-beat rotation - make the beat after the matched beat become beat 1
   * 2. Position rotation - rotate all positions to match exact variant
   * 3. Orientation adjustment - modify start orientations and cascade through sequence
   */
  private async applyTransformPipeline(
    sequence: SequenceData,
    stepIndex: number,
    stepEndPosition: GridPosition,
    targetEndState: EndState
  ): Promise<SequenceData | null> {
    try {
      // Step 1: First-beat rotation - make the beat AFTER this one become beat 1
      // (stepIndex is 0-based, shiftStartPosition expects 1-based beat number)
      // The next beat (stepIndex + 2) becomes the new beat 1
      const targetStepNumber = stepIndex + 2;
      const rotated = this.sequenceTransformer.shiftStartPosition(sequence, targetStepNumber);

      // Step 2: Position rotation - match exact variant
      const rotationSteps = calculateRotationSteps(stepEndPosition, targetEndState.position);
      let positionMatched = rotated;

      if (rotationSteps !== null && rotationSteps !== 0) {
        positionMatched = await this.sequenceTransformer.rotateSequence(
          rotated,
          rotationSteps,
          "both"
        );
      }

      // Step 3: Orientation adjustment - modify start position orientations to match target
      let finalSequence = positionMatched;
      const startPos = positionMatched.startPosition;

      if (
        startPos &&
        targetEndState.blueOrientation &&
        targetEndState.redOrientation
      ) {
        // Check if orientations already match
        const currentBlueOri = startPos.motions?.[MotionColor.BLUE]?.startOrientation;
        const currentRedOri = startPos.motions?.[MotionColor.RED]?.startOrientation;

        if (
          currentBlueOri !== targetEndState.blueOrientation ||
          currentRedOri !== targetEndState.redOrientation
        ) {
          // Modify start position to have target orientations
          const startBlueMotion = startPos.motions?.[MotionColor.BLUE];
          const startRedMotion = startPos.motions?.[MotionColor.RED];
          const adjustedStartPos: StartPositionData = {
            ...startPos,
            motions: {
              [MotionColor.BLUE]: startBlueMotion
                ? {
                    ...startBlueMotion,
                    startOrientation: targetEndState.blueOrientation,
                    endOrientation: targetEndState.blueOrientation,
                  }
                : undefined,
              [MotionColor.RED]: startRedMotion
                ? {
                    ...startRedMotion,
                    startOrientation: targetEndState.redOrientation,
                    endOrientation: targetEndState.redOrientation,
                  }
                : undefined,
            },
          };

          finalSequence = { ...positionMatched, startPosition: adjustedStartPos };
        }
      }

      // Step 4: Always recalculate orientations through all steps
      // This ensures orientation chain integrity after rotation transforms
      const orientationCorrected = recalculateAllOrientations(finalSequence);

      // Step 5: Determine the sequence's grid mode from actual motion locations.
      // We derive from the first step's motions rather than trusting sequence.gridMode,
      // which may be stale (e.g. "box" stored in Firestore for a diamond sequence).
      const sequenceGridMode = this.deriveSequenceGridMode(orientationCorrected);
      const gridCorrected = this.forceGridMode(orientationCorrected, sequenceGridMode);

      // Step 6: Update start position letter to match new position
      const result = this.updateStartPositionLetter(gridCorrected, targetEndState.position);

      // Step 7: Validate the final result (logs warnings if issues found)
      validateMotionData(result, `After transform "${sequence.word}"`);

      return result;
    } catch (error) {
      console.error("[EndlessSpinner] Transform pipeline failed:", error);
      return null;
    }
  }

  /**
   * Derive the grid mode from the sequence's actual motion locations.
   * Examines the first available step's blue and red motions to determine
   * whether cardinal (diamond) or intercardinal (box) locations are used.
   * Falls back to GridMode.DIAMOND when motion data is absent.
   *
   * This is the authoritative source of truth - the stored sequence.gridMode
   * field may be stale (e.g., published before gridMode was tracked).
   */
  private deriveSequenceGridMode(sequence: SequenceData): GridMode {
    // Try start position first, then first step
    const candidates = [
      sequence.startPosition,
      ...(sequence.steps ?? []),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const blue = candidate.motions?.[MotionColor.BLUE];
      const red = candidate.motions?.[MotionColor.RED];
      if (!blue || !red) continue;

      // Both motions need start+end locations for reliable detection
      if (
        !blue.startLocation ||
        !blue.endLocation ||
        !red.startLocation ||
        !red.endLocation
      ) continue;

      const blueIsDiamond =
        CARDINAL_LOCATIONS.has(blue.startLocation) &&
        CARDINAL_LOCATIONS.has(blue.endLocation);
      const redIsDiamond =
        CARDINAL_LOCATIONS.has(red.startLocation) &&
        CARDINAL_LOCATIONS.has(red.endLocation);
      const blueIsBox =
        INTERCARDINAL_LOCATIONS.has(blue.startLocation) &&
        INTERCARDINAL_LOCATIONS.has(blue.endLocation);
      const redIsBox =
        INTERCARDINAL_LOCATIONS.has(red.startLocation) &&
        INTERCARDINAL_LOCATIONS.has(red.endLocation);

      if (blueIsDiamond && redIsDiamond) return GridMode.DIAMOND;
      if (blueIsBox && redIsBox) return GridMode.BOX;
      // Mixed/skewed - use DIAMOND as safe default
      return GridMode.DIAMOND;
    }

    // No usable motion data - fall back to stored field, then DIAMOND
    return sequence.gridMode ?? GridMode.DIAMOND;
  }

  /**
   * Force a specific grid mode on the sequence and all its steps/motions.
   * This ensures visual consistency when sequences from different grid modes are chained.
   *
   * IMPORTANT: We must update gridMode on motions too, not just steps/sequence.
   * The PropRotAngleManager uses motion gridMode for angle calculations.
   */
  private forceGridMode(sequence: SequenceData, gridMode: GridMode): SequenceData {
    // Update grid mode on the sequence itself
    const updatedSequence = {
      ...sequence,
      gridMode,
    };

    // Update grid mode on all steps AND their motions
    if (updatedSequence.steps?.length) {
      updatedSequence.steps = updatedSequence.steps.map((step) => {
        const blueMotion = step.motions?.[MotionColor.BLUE];
        const redMotion = step.motions?.[MotionColor.RED];
        return {
          ...step,
          gridMode,
          motions: {
            ...step.motions,
            [MotionColor.BLUE]: blueMotion
              ? { ...blueMotion, gridMode }
              : undefined,
            [MotionColor.RED]: redMotion
              ? { ...redMotion, gridMode }
              : undefined,
          },
        };
      });
    }

    // Update grid mode on start position and its motions if present
    if (updatedSequence.startPosition) {
      const sp = updatedSequence.startPosition;
      const blueMotion = sp.motions?.[MotionColor.BLUE];
      const redMotion = sp.motions?.[MotionColor.RED];
      updatedSequence.startPosition = {
        ...sp,
        gridMode,
        motions: {
          ...sp.motions,
          [MotionColor.BLUE]: blueMotion
            ? { ...blueMotion, gridMode }
            : undefined,
          [MotionColor.RED]: redMotion
            ? { ...redMotion, gridMode }
            : undefined,
        },
      };
    }

    return updatedSequence;
  }

  /**
   * Update the start position's letter to match the target grid position.
   * This ensures the pictograph glyph displays the correct Greek letter (α, β, γ).
   */
  private updateStartPositionLetter(
    sequence: SequenceData,
    targetPosition: GridPosition | null
  ): SequenceData {
    if (!sequence.startPosition || !targetPosition) {
      return sequence;
    }

    const targetGroup = getPositionGroup(targetPosition);
    const newLetter = getLetterForPositionGroup(targetGroup);

    if (!newLetter) {
      return sequence;
    }

    // Update the letter on the start position
    const updatedStartPosition: StartPositionData = {
      ...sequence.startPosition,
      letter: newLetter,
    };

    return {
      ...sequence,
      startPosition: updatedStartPosition,
    };
  }

  /**
   * Find a sequence in the target position group and transform it to match the exact end state.
   */
  private async findAndTransformSequence(
    endState: EndState,
    targetGroup: PositionGroup
  ): Promise<SequenceData | null> {
    // Get sequences in the same position group
    const candidatesInGroup = this.circularSequences.filter((_seq) => {
      // We need to check the sequence's start position group
      // Since we only have metadata, we'll load a few candidates
      return true; // We'll filter after loading
    });

    // Shuffle to add variety
    const shuffled = [...candidatesInGroup].sort(() => Math.random() - 0.5);

    // Try to find a matching sequence (limit attempts for performance)
    const maxAttempts = Math.min(10, shuffled.length);

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = shuffled[i];
      if (!candidate) continue;

      // Prefer unused sequences
      if (this.usedSequenceIds.has(candidate.id) && i < maxAttempts - 3) {
        continue; // Skip used sequences unless we're running low on options
      }

      // Load full sequence data
      const fullSequence = await this.browseLoader.loadFullSequenceData(candidate.word);
      if (!fullSequence?.steps?.length) continue;

      // Get the sequence's start position
      const startPos = this.startPositionDeriver.getOrDeriveStartPosition(fullSequence);
      if (!startPos) continue;

      // Try multiple ways to get the position - the data structure varies
      const startPosRecord = startPos as unknown as Record<string, unknown>;
      const sequenceStartPosition = (
        startPosRecord.gridPosition ??
        startPosRecord.startPosition ??
        fullSequence.steps?.[0]?.startPosition ??
        null
      ) as string | null;

      // Check if it's in the same position group
      const sequenceGroup = getPositionGroup(sequenceStartPosition);
      if (sequenceGroup !== targetGroup) continue;

      // Calculate rotation needed to transform this sequence's start to our target
      const rotationSteps = calculateRotationSteps(sequenceStartPosition, endState.position);

      if (rotationSteps === null) {
        // Can't rotate (different gamma cycle or other issue), skip
        continue;
      }

      if (rotationSteps === 0) {
        // Already matches exactly - no transformation needed
        return fullSequence;
      }

      // Apply rotation transformation to the entire sequence
      try {
        const transformed = await this.sequenceTransformer.rotateSequence(
          fullSequence,
          rotationSteps,
          "both"
        );
        return transformed;
      } catch {
        // Transformation failed, try next candidate
        continue;
      }
    }

    return null;
  }

  /**
   * Get a random sequence, preferring ones we haven't used yet.
   */
  private async getRandomSequence(): Promise<SequenceData | null> {
    if (this.circularSequences.length === 0) return null;

    // Prefer unused sequences
    const unusedSequences = this.circularSequences.filter(
      (seq) => !this.usedSequenceIds.has(seq.id)
    );

    const candidates = unusedSequences.length > 0 ? unusedSequences : this.circularSequences;
    const randomSeq = pickRandom(candidates);

    if (!randomSeq) return null;

    // Load full sequence data
    return this.browseLoader.loadFullSequenceData(randomSeq.word);
  }

  /**
   * Find a sequence that directly starts at the given end state.
   */
  private async findDirectMatch(endState: EndState): Promise<SequenceData | null> {
    const key = createStartStateKey(
      endState.position,
      endState.blueOrientation,
      endState.redOrientation
    );

    const matches = this.sequenceIndex.get(key);
    if (!matches || matches.length === 0) return null;

    // Prefer sequences we haven't used yet
    const unusedMatches = matches.filter((seq) => !this.usedSequenceIds.has(seq.id));
    if (unusedMatches.length > 0) {
      return pickRandom(unusedMatches);
    }

    // Fall back to any match
    return pickRandom(matches);
  }

  /**
   * Find a circular sequence that passes through the target end state.
   * Returns the sequence and which beat number to rotate to.
   */
  private async findRotatableMatch(endState: EndState): Promise<RotatableMatch | null> {
    const matches: RotatableMatch[] = [];

    for (const sequence of this.circularSequences) {
      // Load full sequence data
      const fullSequence = await this.browseLoader.loadFullSequenceData(sequence.word);
      if (!fullSequence?.steps || !fullSequence.isCircular) continue;

      // Check each beat's end state
      for (let i = 0; i < fullSequence.steps.length; i++) {
        const beat = fullSequence.steps[i];
        if (!beat) continue;

        // Check if this beat's END state matches our target
        const beatEndPos = beat.endPosition;
        const blueEndOri = beat.motions?.blue?.endOrientation ?? null;
        const redEndOri = beat.motions?.red?.endOrientation ?? null;

        if (
          beatEndPos === endState.position &&
          blueEndOri === endState.blueOrientation &&
          redEndOri === endState.redOrientation
        ) {
          // Beat i+1 should become the new beat 1 (rotating past this beat)
          matches.push({
            sequence: fullSequence,
            targetStepNumber: i + 2, // +2 because stepNumber is 1-indexed and we want the NEXT beat
          });
          break; // Only need one match per sequence
        }
      }
    }

    if (matches.length === 0) return null;

    // Prefer sequences we haven't used yet
    const unusedMatches = matches.filter(
      (m) => !this.usedSequenceIds.has(m.sequence.id)
    );
    if (unusedMatches.length > 0) {
      return pickRandom(unusedMatches);
    }

    return pickRandom(matches);
  }

  async generateBridgeSequence(
    fromEndState: EndState,
    toPositionGroup: PositionGroup
  ): Promise<SequenceData | null> {
    try {
      // Get the grid mode from a random existing sequence, or default to diamond
      const sampleSequence = this.circularSequences[0];
      const gridMode = sampleSequence?.gridMode ?? GridMode.DIAMOND;

      // Create start position data from end state
      const startPositionData = this.createStartPositionFromEndState(fromEndState);

      // Get a random target position in the target group
      const targetPosition = getRandomPositionInGroup(toPositionGroup, gridMode);

      // Generate a short freeform sequence from current state to target
      const bridge = await this.generationOrchestrator.generateSequence({
        mode: GenerationMode.FREEFORM,
        length: 3 + Math.floor(Math.random() * 3), // 3-5 steps
        gridMode,
        propType: PropType.STAFF, // Will be overridden by viewer
        difficulty: DifficultyLevel.BEGINNER,
        propContinuity: PropContinuity.CONTINUOUS,
        turnIntensity: 1,
        startPosition: startPositionData as PictographData,
        endPosition: {
          startPosition: targetPosition,
        } as unknown as PictographData, // Minimal end position constraint
      });

      return bridge;
    } catch (error) {
      console.error("[EndlessSpinner] Failed to generate bridge:", error);
      return null;
    }
  }

  /**
   * Create a PictographData-like object from an end state for use as start position.
   */
  private createStartPositionFromEndState(endState: EndState): unknown {
    return {
      id: `spinner-start-${Date.now()}`,
      startPosition: endState.position,
      motions: {
        blue: endState.blueOrientation
          ? { startOrientation: endState.blueOrientation }
          : undefined,
        red: endState.redOrientation
          ? { startOrientation: endState.redOrientation }
          : undefined,
      },
    };
  }

  async getInitialSequence(): Promise<SequenceData | null> {
    const sequence = await this.getRandomSequence();
    return this.recordAndReturn(sequence);
  }

  /**
   * Record sequence usage and return it.
   */
  private recordAndReturn(sequence: SequenceData | null): SequenceData | null {
    if (!sequence) return null;

    this.stats.sequencesPlayed++;

    if (!this.usedSequenceIds.has(sequence.id)) {
      this.usedSequenceIds.add(sequence.id);
      this.stats.uniqueSequencesUsed++;
    }

    return sequence;
  }

  getStats(): SpinnerStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      sequencesPlayed: 0,
      uniqueSequencesUsed: 0,
      directMatches: 0,
      rotatedMatches: 0,
      bridgesGenerated: 0,
    };
    this.usedSequenceIds.clear();
  }
}

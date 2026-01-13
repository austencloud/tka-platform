/**
 * Endless Spinner Orchestrator Implementation
 *
 * Manages continuous sequence playback by chaining sequences together seamlessly.
 * Uses an index of sequences by start state for O(1) lookup.
 * Falls back to rotating circular sequences or generating bridges when no direct match.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { IDiscoverLoader } from "$lib/features/discover/sequences/display/services/contracts/IDiscoverLoader";
import type { IGenerationOrchestrator } from "$lib/features/create/generate/shared/services/contracts/IGenerationOrchestrator";
import type { ISequenceTransformer } from "$lib/features/create/shared/services/contracts/ISequenceTransformer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { IOrientationCalculator } from "$lib/shared/pictograph/prop/services/contracts/IOrientationCalculator";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type {
  IEndlessSpinnerOrchestrator,
  EndState,
  PositionGroup,
  SpinnerStats,
} from "../contracts/IEndlessSpinnerOrchestrator";
import {
  GridMode,
  GridPosition,
  GridPositionGroup,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GenerationMode,
  DifficultyLevel,
  PropContinuity,
} from "$lib/features/create/generate/shared/domain/models/generate-models";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import {
  shiftStartPosition,
  createStartPositionFromBeatEnd,
} from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";
import { recalculateAllOrientations } from "$lib/features/create/shared/services/implementations/sequence-transforms/orientation-propagation";

/**
 * A sequence that can be rotated to match a target start state.
 */
interface RotatableMatch {
  sequence: SequenceData;
  /** Beat number to rotate to (this beat becomes the new beat 1) */
  targetBeatNumber: number;
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
  let cycleLength = 8;
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
function getNextPositionGroup(current: PositionGroup | null): PositionGroup {
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

export class EndlessSpinnerOrchestrator implements IEndlessSpinnerOrchestrator {
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
    private readonly discoverLoader: IDiscoverLoader,
    private readonly generationOrchestrator: IGenerationOrchestrator,
    private readonly sequenceTransformer: ISequenceTransformer,
    private readonly startPositionDeriver: IStartPositionDeriver,
    private readonly orientationCalculator: IOrientationCalculator,
    private readonly gridPositionDeriver: IGridPositionDeriver
  ) {}

  async initialize(): Promise<void> {
    if (this.ready) return;

    try {
      // Load all sequence metadata
      const allSequences = await this.discoverLoader.loadSequenceMetadata();

      // Filter for circular sequences only (LOOPs loop seamlessly)
      this.circularSequences = allSequences.filter((seq) => seq.isCircular === true);

      if (this.circularSequences.length === 0) {
        console.warn("[EndlessSpinner] No circular sequences found, using all sequences");
        this.circularSequences = allSequences;
      }

      // NOTE: We don't pre-build the index anymore - it was too slow
      // Instead, we load sequences on-demand and cache them

      this.ready = true;
      console.log(
        `[EndlessSpinner] Initialized with ${this.circularSequences.length} sequences available`
      );
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
      // Load full sequence data to get the beats
      const fullSequence = await this.discoverLoader.loadFullSequenceData(sequence.word);
      if (!fullSequence || !fullSequence.beats || fullSequence.beats.length === 0) continue;

      // Get or derive start position
      const startPos = this.startPositionDeriver.getOrDeriveStartPosition(fullSequence);
      if (!startPos) continue;

      // Extract start state
      const position = (startPos as StartPositionData).gridPosition ??
        (startPos as BeatData).startPosition ??
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

    console.log(`[EndlessSpinner] Indexed ${this.sequenceIndex.size} unique start states`);
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
  private deriveBeatEndPosition(beat: BeatData): GridPosition | null {
    const blueMotion = beat.motions?.[MotionColor.BLUE];
    const redMotion = beat.motions?.[MotionColor.RED];

    if (blueMotion?.endLocation && redMotion?.endLocation) {
      try {
        return this.gridPositionDeriver.getGridPositionFromLocations(
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

    // Limit attempts for performance (scanning all beats is O(n*m))
    const maxSequenceAttempts = Math.min(20, shuffled.length);

    for (let seqIdx = 0; seqIdx < maxSequenceAttempts; seqIdx++) {
      const candidate = shuffled[seqIdx];
      if (!candidate) continue;

      // Prefer unused sequences
      if (this.usedSequenceIds.has(candidate.id) && seqIdx < maxSequenceAttempts - 5) {
        continue;
      }

      // Load full sequence data
      const fullSequence = await this.discoverLoader.loadFullSequenceData(candidate.word);
      if (!fullSequence?.beats?.length || !fullSequence.isCircular) continue;

      // Scan each beat for a position match
      for (let beatIndex = 0; beatIndex < fullSequence.beats.length; beatIndex++) {
        const beat = fullSequence.beats[beatIndex];
        if (!beat) continue;

        const beatEndPosition = this.deriveBeatEndPosition(beat);
        const beatGroup = getPositionGroup(beatEndPosition);

        // Check if beat is in target position group
        if (beatGroup !== targetGroup) continue;

        // For gamma, also check cycle compatibility
        if (targetGroup === "gamma") {
          const beatCycle = getGammaCycle(beatEndPosition);
          if (beatCycle !== targetGammaCycle) continue;
        }

        // Found a beat that passes through target group!
        // Apply three-step transform pipeline
        const result = await this.applyTransformPipeline(
          fullSequence,
          beatIndex,
          beatEndPosition!,
          endState
        );

        if (result) {
          console.log(
            `[EndlessSpinner] ✅ Seamless transition: "${fullSequence.word}" (beat ${beatIndex + 1} → ${targetEndState.position})`
          );
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
    beatIndex: number,
    beatEndPosition: GridPosition,
    targetEndState: EndState
  ): Promise<SequenceData | null> {
    try {
      // Step 1: First-beat rotation - make the beat AFTER this one become beat 1
      // (beatIndex is 0-based, shiftStartPosition expects 1-based beat number)
      // The next beat (beatIndex + 2) becomes the new beat 1
      const targetBeatNumber = beatIndex + 2;
      console.log(
        `[EndlessSpinner] Step 1: Rotating sequence "${sequence.word}" - beat ${targetBeatNumber} becomes new beat 1`
      );
      const rotated = this.sequenceTransformer.shiftStartPosition(sequence, targetBeatNumber);

      // Step 2: Position rotation - match exact variant
      const rotationSteps = calculateRotationSteps(beatEndPosition, targetEndState.position);
      let positionMatched = rotated;

      if (rotationSteps !== null && rotationSteps !== 0) {
        positionMatched = await this.sequenceTransformer.rotateSequence(
          rotated,
          rotationSteps,
          "both"
        );
        console.log(
          `[EndlessSpinner] Step 2: Rotated positions by ${rotationSteps * 45}° (${beatEndPosition} → ${targetEndState.position})`
        );
      }

      // Step 3: Orientation adjustment - modify start position orientations to match target
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
          const adjustedStartPos: StartPositionData = {
            ...startPos,
            motions: {
              [MotionColor.BLUE]: startPos.motions?.[MotionColor.BLUE]
                ? {
                    ...startPos.motions[MotionColor.BLUE],
                    startOrientation: targetEndState.blueOrientation,
                    endOrientation: targetEndState.blueOrientation,
                  }
                : undefined,
              [MotionColor.RED]: startPos.motions?.[MotionColor.RED]
                ? {
                    ...startPos.motions[MotionColor.RED],
                    startOrientation: targetEndState.redOrientation,
                    endOrientation: targetEndState.redOrientation,
                  }
                : undefined,
            },
          };

          // Cascade orientation changes through all beats
          const orientationCorrected = recalculateAllOrientations(
            { ...positionMatched, startPosition: adjustedStartPos },
            this.orientationCalculator
          );

          console.log(
            `[EndlessSpinner] Step 3: Adjusted orientations blue=${targetEndState.blueOrientation}, red=${targetEndState.redOrientation}`
          );

          return orientationCorrected;
        }
      }

      return positionMatched;
    } catch (error) {
      console.error("[EndlessSpinner] Transform pipeline failed:", error);
      return null;
    }
  }

  /**
   * Find a sequence in the target position group and transform it to match the exact end state.
   */
  private async findAndTransformSequence(
    endState: EndState,
    targetGroup: PositionGroup
  ): Promise<SequenceData | null> {
    // Get sequences in the same position group
    const candidatesInGroup = this.circularSequences.filter((seq) => {
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
      const fullSequence = await this.discoverLoader.loadFullSequenceData(candidate.word);
      if (!fullSequence?.beats?.length) continue;

      // Get the sequence's start position
      const startPos = this.startPositionDeriver.getOrDeriveStartPosition(fullSequence);
      if (!startPos) continue;

      // Try multiple ways to get the position - the data structure varies
      const sequenceStartPosition =
        (startPos as any).gridPosition ??
        (startPos as any).startPosition ??
        fullSequence.beats?.[0]?.startPosition ??
        null;

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
    return this.discoverLoader.loadFullSequenceData(randomSeq.word);
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
      const fullSequence = await this.discoverLoader.loadFullSequenceData(sequence.word);
      if (!fullSequence?.beats || !fullSequence.isCircular) continue;

      // Check each beat's end state
      for (let i = 0; i < fullSequence.beats.length; i++) {
        const beat = fullSequence.beats[i];
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
            targetBeatNumber: i + 2, // +2 because beatNumber is 1-indexed and we want the NEXT beat
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
        length: 3 + Math.floor(Math.random() * 3), // 3-5 beats
        gridMode,
        propType: PropType.STAFF, // Will be overridden by viewer
        difficulty: DifficultyLevel.BEGINNER,
        propContinuity: PropContinuity.CONTINUOUS,
        turnIntensity: 1,
        startPosition: startPositionData,
        endPosition: {
          startPosition: targetPosition,
        } as any, // Minimal end position constraint
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
  private createStartPositionFromEndState(endState: EndState): any {
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

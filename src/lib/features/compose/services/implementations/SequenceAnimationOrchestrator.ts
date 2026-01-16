/**
 * Sequence Animation Orchestrator
 *
 * Lightweight coordinator that orchestrates focused services.
 * Single responsibility: Coordinate animation services and manage sequence lifecycle.
 */

import type { BeatData } from "../../../create/shared/domain/models/BeatData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type {
  PropState,
  PropStates,
} from "../../shared/domain/types/PropState";
import type {
  SequenceData,
  SequenceMetadata,
} from "$lib/shared/foundation/domain/models/SequenceData";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type { IAnimationStateManager } from "../contracts/IAnimationStateManager";
import type { IBeatCalculator } from "../contracts/IBeatCalculator";
import type { IPropInterpolator } from "../contracts/IPropInterpolator";
import type { ISequenceAnimationOrchestrator } from "../contracts/ISequenceAnimationOrchestrator";

/**
 * Lightweight Animation Orchestrator
 * Coordinates focused services instead of doing everything itself
 *
 * IMPORTANT: Start position is derived from beats[0]
 * - beats[0].startLocation/startOrientation = the initial pose before animation begins
 * - No separate startPosition field needed
 *
 * When currentBeat < 1: We're at the start position (derived from beats[0])
 * When currentBeat >= 1: We're at a motion beat (beat N uses this.beats[N-1])
 */
export class SequenceAnimationOrchestrator implements ISequenceAnimationOrchestrator {
  // Motion beats (beat 1 = beats[0], beat 2 = beats[1], etc.)
  // Start position is derived from beats[0].startLocation/startOrientation
  private beats: readonly BeatData[] = [];
  private totalBeats = 0; // Number of motion beats (NOT including start position)

  private hasMotionData = false;
  private missingMotionLogged = new Set<number>();
  private metadata: SequenceMetadata = { word: "", author: "", totalBeats: 0 };
  private initialized = false;
  private currentBeatIndex = 0;
  private currentBeatProgress = 0; // Sub-beat progress (0.0 to 1.0)
  private atStartPosition = true; // Track if we're at start position

  constructor(
    private readonly animationStateService: IAnimationStateManager,
    private readonly beatCalculationService: IBeatCalculator,
    private readonly propInterpolationService: IPropInterpolator
  ) {}

  /**
   * Initialize with domain sequence data (PURE DOMAIN!)
   * Data arrives already normalized from SequenceService
   *
   * Start position is derived from beats[0].startLocation/startOrientation
   * - No separate startPosition field needed
   * - beats: Motion beats (beat 1 = beats[0], beat 2 = beats[1], etc.)
   */
  initializeWithDomainData(sequenceData: SequenceData): boolean {
    try {
      // Start position is derived from beats[0] - no separate storage needed

      // Store motion beats (beat 1+)
      const beats = (sequenceData.beats ?? [])
        .filter((beat): beat is BeatData => !!beat)
        .map((beat, index) => ({
          ...beat,
          beatNumber:
            typeof beat.beatNumber === "number" ? beat.beatNumber : index + 1,
          motions: beat.motions ?? { blue: undefined, red: undefined },
        }));

      if (beats.length === 0) {
        throw new Error("No beats found in sequence data");
      }

      // Validate beats using focused service
      if (!this.beatCalculationService.validateBeats(beats)) {
        throw new Error("Invalid beat data structure");
      }

      this.missingMotionLogged.clear();
      this.hasMotionData = beats.some(
        (beat) => beat?.motions?.blue && beat?.motions?.red
      );

      // Extract metadata from domain data
      // Get per-color prop types from settings
      const settings = getSettings();

      this.metadata = {
        word: sequenceData.word || sequenceData.name || "",
        author:
          sequenceData.author ||
          (sequenceData.metadata?.["author"] as string) ||
          "",
        totalBeats: beats.length, // Number of motion beats (NOT including start position)
        // propType removed from sequences - use settings (viewer preference)
        bluePropType: settings.bluePropType || settings.propType,
        redPropType: settings.redPropType || settings.propType,
        gridMode: sequenceData.gridMode,
      };

      // Store motion beats - beat 1 is at index 0, beat 2 at index 1, etc.
      this.beats = beats;
      this.totalBeats = this.metadata.totalBeats;
      this.atStartPosition = true; // Start at start position

      this.initializePropStates();
      this.initialized = true;

      return true;
    } catch (error) {
      console.error(
        "SequenceAnimationOrchestrator: Failed to initialize:",
        error
      );
      return false;
    }
  }

  /**
   * Calculate animation state for given beat using focused services
   *
   * IMPORTANT: currentBeat semantics
   * - currentBeat < 1: We're at the start position (use startPosition data)
   * - currentBeat >= 1: We're at a motion beat (beat N uses this.beats[N-1])
   */
  calculateState(currentBeat: number): void {
    if (this.beats.length === 0 || this.totalBeats === 0) {
      console.warn("SequenceAnimationOrchestrator: No sequence data available");
      return;
    }

    // Check if we're at start position (before beat 1)
    this.atStartPosition = currentBeat < 1;

    if (this.atStartPosition) {
      // At start position - derive from first beat's starting state
      this.currentBeatIndex = 0;
      this.currentBeatProgress = 0;

      const firstBeat = this.beats[0];
      if (firstBeat?.motions?.blue && firstBeat?.motions?.red) {
        const initialAngles =
          this.propInterpolationService.calculateInitialAngles(firstBeat);
        if (initialAngles.isValid) {
          this.animationStateService.setPropStates(
            {
              centerPathAngle: initialAngles.blueAngles.centerPathAngle,
              staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
            },
            {
              centerPathAngle: initialAngles.redAngles.centerPathAngle,
              staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
            }
          );
        }
      }
      return;
    }

    // At a motion beat - adjust currentBeat to use correct array index
    // Beat 1 uses beats[0], beat 2 uses beats[1], etc.
    const adjustedBeat = currentBeat - 1;

    // Use focused service for beat calculations
    const beatState = this.beatCalculationService.calculateBeatState(
      adjustedBeat,
      this.beats,
      this.totalBeats
    );

    if (!beatState.isValid) {
      console.error("SequenceAnimationOrchestrator: Invalid beat state");
      return;
    }

    // Store current beat index and progress for trail rendering
    // Note: currentBeatIndex here is the array index, not the beat number
    this.currentBeatIndex = beatState.currentBeatIndex;
    this.currentBeatProgress = beatState.beatProgress;

    // Skip beats without motion data (common in legacy/shared URLs) and log once
    const beatMotions = beatState.currentBeatData?.motions;
    const hasBeatMotions = beatMotions?.blue && beatMotions?.red;
    if (!hasBeatMotions) {
      const key =
        beatState.currentBeatData?.beatNumber ?? beatState.currentBeatIndex;
      if (!this.missingMotionLogged.has(key)) {
        this.missingMotionLogged.add(key);
        console.warn(
          "SequenceAnimationOrchestrator: Skipping beat without motion data",
          {
            beatNumber: beatState.currentBeatData?.beatNumber,
            beatIndex: beatState.currentBeatIndex,
          }
        );
      }
      return;
    }

    // Use focused service for interpolation
    const interpolationResult =
      this.propInterpolationService.interpolatePropAngles(
        beatState.currentBeatData,
        beatState.beatProgress
      );

    if (!interpolationResult.isValid) {
      console.warn(
        "SequenceAnimationOrchestrator: Skipping beat without motion data",
        {
          beatNumber: beatState.currentBeatData?.beatNumber,
          beatIndex: beatState.currentBeatIndex,
        }
      );
      return;
    }

    // Use focused service to update prop states
    this.animationStateService.updatePropStates(interpolationResult);
  }

  /**
   * Get current prop states
   */
  getPropStates(): PropStates {
    return this.animationStateService.getPropStates();
  }

  /**
   * Get blue prop state
   */
  getBluePropState(): PropState {
    return this.animationStateService.getBluePropState();
  }

  /**
   * Get red prop state
   */
  getRedPropState(): PropState {
    return this.animationStateService.getRedPropState();
  }

  /**
   * Get current beat progress (0.0 to 1.0 within current beat)
   */
  getBeatProgress(): number {
    return this.currentBeatProgress;
  }

  /**
   * Get sequence metadata
   */
  getMetadata(): SequenceMetadata {
    return { ...this.metadata };
  }

  private findFirstBeatWithMotion(): BeatData | null {
    return (
      this.beats.find((beat) => beat?.motions?.blue && beat?.motions?.red) ??
      null
    );
  }

  /**
   * Initialize prop states using focused services
   * Uses first beat with motion data to derive initial pose
   */
  private initializePropStates(): void {
    // Use first beat with motion data to derive initial pose
    if (!this.beats || this.beats.length === 0) {
      console.warn(
        "SequenceAnimationOrchestrator: No beats available, using fallback"
      );
      this.animationStateService.resetPropStates();
      return;
    }

    const firstBeatWithMotion = this.findFirstBeatWithMotion();

    if (!firstBeatWithMotion) {
      console.warn(
        "SequenceAnimationOrchestrator: No beats with motion data, resetting prop states"
      );
      this.animationStateService.resetPropStates();
      return;
    }

    const initialAngles =
      this.propInterpolationService.calculateInitialAngles(firstBeatWithMotion);

    if (initialAngles.isValid) {
      this.animationStateService.setPropStates(
        {
          centerPathAngle: initialAngles.blueAngles.centerPathAngle,
          staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
        },
        {
          centerPathAngle: initialAngles.redAngles.centerPathAngle,
          staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
        }
      );
    } else {
      console.warn(
        "SequenceAnimationOrchestrator: Failed to calculate initial angles"
      );
      this.animationStateService.resetPropStates();
    }
  }

  /**
   * Get current prop states
   */
  getCurrentPropStates(): PropStates {
    return this.animationStateService.getPropStates();
  }

  /**
   * Get the letter for the current beat
   * At start position, returns beats[0]'s letter
   */
  getCurrentLetter(): Letter | null {
    if (!this.initialized || this.beats.length === 0) {
      return null;
    }

    // Clamp beat index to valid range (0 for start position, otherwise current beat)
    const beatIndex = Math.max(
      0,
      Math.min(this.currentBeatIndex, this.beats.length - 1)
    );
    const currentBeat = this.beats[beatIndex];

    return currentBeat?.letter || null;
  }

  /**
   * Check if orchestrator is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if currently showing the start position (before beat 1)
   * Start position is conceptually different from beats - it's the pose held before animation begins
   */
  isAtStartPosition(): boolean {
    return this.atStartPosition;
  }

  /**
   * Get the total number of motion beats (NOT including start position)
   */
  getTotalBeats(): number {
    return this.totalBeats;
  }

  /**
   * Get the total duration of all beats (sum of individual beat durations).
   * This is the proper "end time" for duration-aware playback.
   */
  getTotalDuration(): number {
    return this.beatCalculationService.calculateTotalDuration(this.beats);
  }

  /**
   * Calculate animation state using duration-aware timing.
   * Maps a time position to the correct beat and progress within that beat,
   * accounting for variable beat durations.
   *
   * @param timePosition - Position in sequence time (0 to totalDuration)
   * @returns The beat number (1-based) currently being animated, for UI sync
   */
  calculateStateDurationAware(timePosition: number): number {
    if (this.beats.length === 0) {
      return 0;
    }

    // Time position 0 to ~1 (first beat's duration) = start position / first beat
    // We use a small threshold to determine if we're at the start position
    const totalDuration = this.getTotalDuration();
    const firstBeatDuration = this.beats[0]?.duration ?? 1;

    // At start position if timePosition < first beat duration threshold
    // (using 0.01 as threshold to handle floating point)
    if (timePosition < 0.01) {
      this.calculateStartPositionState();
      return 0;
    }

    // Use duration-aware beat calculation
    const beatState = this.beatCalculationService.calculateBeatStateDurationAware(
      timePosition,
      this.beats
    );

    if (!beatState.isValid) {
      console.error("SequenceAnimationOrchestrator: Invalid beat state from duration-aware calculation");
      return 0;
    }

    // Store current beat index and progress
    this.currentBeatIndex = beatState.currentBeatIndex;
    this.currentBeatProgress = beatState.beatProgress;
    this.atStartPosition = false;

    // Skip beats without motion data
    const beatMotions = beatState.currentBeatData?.motions;
    const hasBeatMotions = beatMotions?.blue && beatMotions?.red;
    if (!hasBeatMotions) {
      const key = beatState.currentBeatData?.beatNumber ?? beatState.currentBeatIndex;
      if (!this.missingMotionLogged.has(key)) {
        this.missingMotionLogged.add(key);
        console.warn(
          "SequenceAnimationOrchestrator: Skipping beat without motion data",
          { beatNumber: beatState.currentBeatData?.beatNumber, beatIndex: beatState.currentBeatIndex }
        );
      }
      return beatState.currentBeatIndex + 1; // Return 1-based beat number
    }

    // Use focused service for interpolation
    const interpolationResult = this.propInterpolationService.interpolatePropAngles(
      beatState.currentBeatData,
      beatState.beatProgress
    );

    if (interpolationResult.isValid) {
      this.animationStateService.updatePropStates(interpolationResult);
    }

    // Return 1-based beat number for UI sync
    return beatState.currentBeatIndex + 1;
  }

  /**
   * Helper to calculate start position state
   */
  private calculateStartPositionState(): void {
    this.atStartPosition = true;
    this.currentBeatIndex = 0;
    this.currentBeatProgress = 0;

    const firstBeat = this.beats[0];
    if (firstBeat?.motions?.blue && firstBeat?.motions?.red) {
      const initialAngles = this.propInterpolationService.calculateInitialAngles(firstBeat);
      if (initialAngles.isValid) {
        this.animationStateService.setPropStates(
          {
            centerPathAngle: initialAngles.blueAngles.centerPathAngle,
            staffRotationAngle: initialAngles.blueAngles.staffRotationAngle,
          },
          {
            centerPathAngle: initialAngles.redAngles.centerPathAngle,
            staffRotationAngle: initialAngles.redAngles.staffRotationAngle,
          }
        );
      }
    }
  }

  /**
   * Get the current beat data (the beat being animated).
   * Returns null if at start position or not initialized.
   */
  getCurrentBeatData(): BeatData | null {
    if (!this.initialized || this.atStartPosition) {
      return null;
    }
    const index = Math.max(0, Math.min(this.currentBeatIndex, this.beats.length - 1));
    return this.beats[index] ?? null;
  }

  /**
   * Get the current beat index (0-based array index).
   * Returns -1 if at start position.
   */
  getCurrentBeatIndex(): number {
    if (!this.initialized || this.atStartPosition) {
      return -1;
    }
    return this.currentBeatIndex;
  }

  /**
   * Get the continuous musical position as a decimal.
   * Formula: beatNumber + (progress × duration)
   *
   * Example: Beat 2 with duration 2 at 50% progress = 2 + (0.5 × 2) = 3.0
   * Returns 0 if at start position.
   */
  getContinuousMusicalPosition(): number {
    if (!this.initialized || this.atStartPosition) {
      return 0;
    }

    const beatNumber = this.currentBeatIndex + 1; // Convert 0-based to 1-based
    const beatData = this.beats[this.currentBeatIndex];
    const duration = beatData?.duration ?? 1;

    // Musical position = beatNumber + (progress × duration)
    return beatNumber + this.currentBeatProgress * duration;
  }

  /**
   * Dispose of resources and reset state
   */
  dispose(): void {
    this.beats = [];
    this.totalBeats = 0;
    this.metadata = { word: "", author: "", totalBeats: 0 };
    this.initialized = false;
    this.currentBeatIndex = 0;
    this.atStartPosition = true;
    this.animationStateService.resetPropStates();
  }
}

/**
 * Sequence Animation Orchestrator
 *
 * Lightweight coordinator that orchestrates focused services.
 * Single responsibility: Coordinate animation services and manage sequence lifecycle.
 *
 * Package version: accepts prop types via initializeWithDomainData config
 * instead of reading from global app settings.
 */

import type { StepData, Letter, PropState, PropStates, SequenceData, SequenceMetadata, PropType } from "@tka/types";
import type { IAnimationStateManager } from "../contracts/IAnimationStateManager";
import type { IStepCalculator } from "../contracts/IStepCalculator";
import type { IPropInterpolator } from "../contracts/IPropInterpolator";
import type { ISequenceAnimationOrchestrator } from "../contracts/ISequenceAnimationOrchestrator";

export interface OrchestratorConfig {
  /** Default blue prop type when not specified in sequence data */
  defaultBluePropType?: string;
  /** Default red prop type when not specified in sequence data */
  defaultRedPropType?: string;
}

export class SequenceAnimationOrchestrator
  implements ISequenceAnimationOrchestrator
{
  private steps: readonly StepData[] = [];
  private totalSteps = 0;

  private hasMotionData = false;
  private missingMotionLogged = new Set<number>();
  private metadata: SequenceMetadata = {
    word: "",
    author: "",
    totalSteps: 0,
  };
  private initialized = false;
  private currentStepIndex = 0;
  private currentStepProgress = 0;
  private atStartPosition = true;

  private readonly config: OrchestratorConfig;

  constructor(
    private readonly animationStateService: IAnimationStateManager,
    private readonly stepCalculationService: IStepCalculator,
    private readonly propInterpolationService: IPropInterpolator,
    config: OrchestratorConfig = {}
  ) {
    this.config = config;
  }

  /**
   * Update config (e.g., when user changes prop types)
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    Object.assign(this.config, config);
  }

  initializeWithDomainData(sequenceData: SequenceData): boolean {
    try {
      const steps = (sequenceData.steps ?? [])
        .filter((beat): beat is StepData => !!beat)
        .map((beat, index) => ({
          ...beat,
          stepNumber:
            typeof beat.stepNumber === "number" ? beat.stepNumber : index + 1,
          motions: beat.motions ?? { blue: undefined, red: undefined },
        }));

      if (steps.length === 0) {
        console.warn(
          "SequenceAnimationOrchestrator: No steps found in sequence data"
        );
        return false;
      }

      if (!this.stepCalculationService.validateBeats(steps)) {
        throw new Error("Invalid beat data structure");
      }

      this.missingMotionLogged.clear();
      this.hasMotionData = steps.some(
        (beat) => beat?.motions?.blue && beat?.motions?.red
      );

      this.metadata = {
        word: sequenceData.word || sequenceData.name || "",
        author:
          sequenceData.author ||
          (sequenceData.metadata?.["author"] as string) ||
          "",
        totalSteps: steps.length,
        bluePropType:
          (this.config.defaultBluePropType as PropType) || undefined,
        redPropType:
          (this.config.defaultRedPropType as PropType) || undefined,
        gridMode: sequenceData.gridMode,
      };

      this.steps = steps;
      this.totalSteps = this.metadata.totalSteps;
      this.atStartPosition = true;

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

  calculateState(currentStep: number): void {
    if (this.steps.length === 0 || this.totalSteps === 0) {
      return;
    }

    this.atStartPosition = currentStep < 1;

    if (this.atStartPosition) {
      this.currentStepIndex = 0;
      this.currentStepProgress = 0;

      const firstStep = this.steps[0];
      if (firstStep?.motions?.blue && firstStep?.motions?.red) {
        const initialAngles =
          this.propInterpolationService.calculateInitialAngles(firstStep);
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

    const adjustedBeat = currentStep - 1;

    const stepState = this.stepCalculationService.calculateBeatState(
      adjustedBeat,
      this.steps,
      this.totalSteps
    );

    if (!stepState.isValid) {
      return;
    }

    this.currentStepIndex = stepState.currentStepIndex;
    this.currentStepProgress = stepState.stepProgress;

    const beatMotions = stepState.currentStepData?.motions;
    const hasBeatMotions = beatMotions?.blue && beatMotions?.red;
    if (!hasBeatMotions) {
      const key =
        stepState.currentStepData?.stepNumber ?? stepState.currentStepIndex;
      if (!this.missingMotionLogged.has(key)) {
        this.missingMotionLogged.add(key);
      }
      return;
    }

    const interpolationResult =
      this.propInterpolationService.interpolatePropAngles(
        stepState.currentStepData,
        stepState.stepProgress
      );

    if (!interpolationResult.isValid) {
      return;
    }

    this.animationStateService.updatePropStates(interpolationResult);
  }

  getPropStates(): PropStates {
    return this.animationStateService.getPropStates();
  }

  getBluePropState(): PropState {
    return this.animationStateService.getBluePropState();
  }

  getRedPropState(): PropState {
    return this.animationStateService.getRedPropState();
  }

  getBeatProgress(): number {
    return this.currentStepProgress;
  }

  getMetadata(): SequenceMetadata {
    return { ...this.metadata };
  }

  private findFirstBeatWithMotion(): StepData | null {
    return (
      this.steps.find((beat) => beat?.motions?.blue && beat?.motions?.red) ??
      null
    );
  }

  private initializePropStates(): void {
    if (!this.steps || this.steps.length === 0) {
      this.animationStateService.resetPropStates();
      return;
    }

    const firstBeatWithMotion = this.findFirstBeatWithMotion();

    if (!firstBeatWithMotion) {
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
      this.animationStateService.resetPropStates();
    }
  }

  getCurrentPropStates(): PropStates {
    return this.animationStateService.getPropStates();
  }

  getCurrentLetter(): Letter | null {
    if (!this.initialized || this.steps.length === 0) {
      return null;
    }

    const stepIndex = Math.max(
      0,
      Math.min(this.currentStepIndex, this.steps.length - 1)
    );
    const currentStep = this.steps[stepIndex];

    return currentStep?.letter || null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isAtStartPosition(): boolean {
    return this.atStartPosition;
  }

  getTotalBeats(): number {
    return this.totalSteps;
  }

  getTotalDuration(): number {
    return this.stepCalculationService.calculateTotalDuration(this.steps);
  }

  getStartPositionDuration(): number {
    return 1;
  }

  getTotalDurationWithStartPosition(): number {
    return this.getStartPositionDuration() + this.getTotalDuration();
  }

  calculateStateDurationAware(timePosition: number): number {
    if (this.steps.length === 0) {
      return 0;
    }

    const startPosDuration = this.getStartPositionDuration();

    if (timePosition < startPosDuration) {
      this.calculateStartPositionState();
      return timePosition / startPosDuration;
    }

    const adjustedTimePosition = timePosition - startPosDuration;

    const stepState =
      this.stepCalculationService.calculateBeatStateDurationAware(
        adjustedTimePosition,
        this.steps
      );

    if (!stepState.isValid) {
      return 0;
    }

    this.currentStepIndex = stepState.currentStepIndex;
    this.currentStepProgress = stepState.stepProgress;
    this.atStartPosition = false;

    const beatMotions = stepState.currentStepData?.motions;
    const hasBeatMotions = beatMotions?.blue && beatMotions?.red;
    if (!hasBeatMotions) {
      const key =
        stepState.currentStepData?.stepNumber ?? stepState.currentStepIndex;
      if (!this.missingMotionLogged.has(key)) {
        this.missingMotionLogged.add(key);
      }
      return stepState.currentStepIndex + 1;
    }

    const interpolationResult =
      this.propInterpolationService.interpolatePropAngles(
        stepState.currentStepData,
        stepState.stepProgress
      );

    if (interpolationResult.isValid) {
      this.animationStateService.updatePropStates(interpolationResult);
    }

    return stepState.currentStepIndex + 1 + stepState.stepProgress;
  }

  private calculateStartPositionState(): void {
    this.atStartPosition = true;
    this.currentStepIndex = 0;
    this.currentStepProgress = 0;

    const firstStep = this.steps[0];
    if (firstStep?.motions?.blue && firstStep?.motions?.red) {
      const initialAngles =
        this.propInterpolationService.calculateInitialAngles(firstStep);
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

  getCurrentBeatData(): StepData | null {
    if (!this.initialized || this.atStartPosition) {
      return null;
    }
    const index = Math.max(
      0,
      Math.min(this.currentStepIndex, this.steps.length - 1)
    );
    return this.steps[index] ?? null;
  }

  getCurrentStepIndex(): number {
    if (!this.initialized || this.atStartPosition) {
      return -1;
    }
    return this.currentStepIndex;
  }

  getContinuousMusicalPosition(): number {
    if (!this.initialized || this.atStartPosition) {
      return 0;
    }

    const stepNumber = this.currentStepIndex + 1;
    const stepData = this.steps[this.currentStepIndex];
    const duration = stepData?.duration ?? 1;

    return stepNumber + this.currentStepProgress * duration;
  }

  getTimePositionForBeat(beat: number): number {
    if (this.steps.length === 0) {
      return 0;
    }

    const startPosDuration = this.getStartPositionDuration();

    if (beat < 1) {
      return beat * startPosDuration;
    }

    const beatIndex = Math.floor(beat) - 1;
    const beatProgress = beat - Math.floor(beat);

    let timePosition =
      startPosDuration +
      this.stepCalculationService.getBeatStartTime(beatIndex, this.steps);

    if (beatIndex >= 0 && beatIndex < this.steps.length) {
      const currentBeatDuration = this.steps[beatIndex]?.duration ?? 1;
      timePosition += beatProgress * currentBeatDuration;
    }

    return timePosition;
  }

  dispose(): void {
    this.steps = [];
    this.totalSteps = 0;
    this.metadata = { word: "", author: "", totalSteps: 0 };
    this.initialized = false;
    this.currentStepIndex = 0;
    this.atStartPosition = true;
    this.animationStateService.resetPropStates();
  }
}

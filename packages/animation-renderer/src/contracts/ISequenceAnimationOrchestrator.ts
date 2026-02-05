import type {
  SequenceData,
  SequenceMetadata,
  Letter,
  StepData,
  PropState,
  PropStates,
} from "@tka/types";

export interface ISequenceAnimationOrchestrator {
  initializeWithDomainData(sequenceData: SequenceData): boolean;
  calculateState(currentStep: number): void;
  getPropStates(): PropStates;
  getBluePropState(): PropState;
  getRedPropState(): PropState;
  getMetadata(): SequenceMetadata;
  getCurrentPropStates(): PropStates;
  getCurrentLetter(): Letter | null;
  isInitialized(): boolean;
  dispose(): void;
  isAtStartPosition(): boolean;
  getTotalBeats(): number;
  getTotalDuration(): number;
  getStartPositionDuration(): number;
  getTotalDurationWithStartPosition(): number;
  calculateStateDurationAware(timePosition: number): number;
  getCurrentBeatData(): StepData | null;
  getCurrentStepIndex(): number;
  getBeatProgress(): number;
  getContinuousMusicalPosition(): number;
  getTimePositionForBeat(beat: number): number;
}

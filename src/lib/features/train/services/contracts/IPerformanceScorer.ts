import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { DetectionFrame } from "../../domain/models/DetectionFrame";
import type {
  StepResult,
  PerformanceScore,
  PerformanceGrade,
} from "../../domain/models/PerformanceData";

export interface ExpectedStepPosition {
  stepNumber: number;
  blue: GridLocation;
  red: GridLocation;
  timestamp: number;
}

export interface IPerformanceScorer {
  scoreBeat(
    detected: DetectionFrame,
    expected: ExpectedStepPosition,
    currentCombo: number
  ): StepResult;

  calculateFinalScore(stepResults: StepResult[]): PerformanceScore;

  getGradeForPercentage(percentage: number): PerformanceGrade;

  getComboMultiplier(combo: number): number;
}

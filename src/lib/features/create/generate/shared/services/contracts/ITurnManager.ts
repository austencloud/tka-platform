import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

export interface ITurnManager {
  setTurns(
    beat: StepData,
    turnBlue: number | "fl",
    turnRed: number | "fl"
  ): void;
  updateDashStaticRotationDirections(
    beat: StepData,
    propContinuity: string,
    blueRotationDirection: string,
    redRotationDirection: string
  ): void;
  getRandomRotationDirection(): string;
}

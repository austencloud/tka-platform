import type { PictographData } from "../pictograph/PictographData";

export interface StepData extends PictographData {
  readonly isStep?: true;
  readonly stepNumber: number;
  readonly duration: number;
  readonly blueReversal: boolean;
  readonly redReversal: boolean;
  readonly isBlank: boolean;
  readonly isSelected?: boolean;
}

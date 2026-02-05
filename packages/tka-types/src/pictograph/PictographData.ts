import type { Letter } from "../foundation/Letter";
import type { GridMode, GridPosition } from "./grid-enums";
import type { MotionColor } from "./pictograph-enums";
import type { MotionData } from "./MotionData";

export interface PictographData {
  readonly id: string;
  readonly letter?: Letter | null;
  readonly startPosition?: GridPosition | null;
  readonly endPosition?: GridPosition | null;
  readonly motions: Partial<Record<MotionColor, MotionData | undefined>>;
  readonly gridMode?: GridMode;
  readonly category?: number | null;
}

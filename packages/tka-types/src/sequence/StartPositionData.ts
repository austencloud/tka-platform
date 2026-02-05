import type { PictographData } from "../pictograph/PictographData";
import type { GridPosition } from "../pictograph/grid-enums";

export interface StartPositionData extends PictographData {
  readonly isStartPosition: true;
  readonly id: string;
  readonly gridPosition?: GridPosition | null;
  readonly isSelected?: boolean;
}

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface PropPlacementChange {
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
  activeColor: MotionColor | null;
  complete: boolean;
}

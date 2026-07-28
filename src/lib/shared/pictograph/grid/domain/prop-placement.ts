import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface PropPlacementChange {
  blueLocation: GridLocation | null;
  redLocation: GridLocation | null;
  activeColor: MotionColor | null;
  complete: boolean;
  /** Whether there is a previous placement to step back to. A host that renders
   *  the move/undo controls itself (see `renderTray`) needs this to know when to
   *  offer Undo; the grid's own history is not otherwise visible from outside. */
  canUndo: boolean;
}

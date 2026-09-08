import type { GridMode, GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** A group of positions sharing the same grid mode */
export interface PositionSection {
  label: string;
  gridMode: GridMode;
  positions: GridPosition[];
}

/** Orientation option shown in a picker chip */
export interface OrientationOption {
  value: Orientation;
  label: string;
  icon: string;
  rotation?: number;
}

/** Filter group for the nav chips */
export type PositionGroup = "all" | "tau-diamond" | "tau-box" | "terra";

/** Per-card orientation state: each card independently tracks blue + red */
export interface CardOrientations {
  left: Orientation;
  right: Orientation;
}

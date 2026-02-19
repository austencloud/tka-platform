/**
 * Start Position Service Interface
 *
 * Simplified interface focused on core functionality.
 */

import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface IStartPositionManager {
  // Core functionality - load and select positions
  getStartPositions(gridMode: GridMode, blueOrientation?: Orientation, redOrientation?: Orientation): Promise<PictographData[]>;
  getDefaultStartPositions(gridMode: GridMode, blueOrientation?: Orientation, redOrientation?: Orientation): PictographData[];
  getAllStartPositionVariations(gridMode: GridMode, blueOrientation?: Orientation, redOrientation?: Orientation): PictographData[];
  selectStartPosition(position: PictographData): void;

  // System method for setting start position in sequence
  setStartPosition(startPosition: StepData): void;
}

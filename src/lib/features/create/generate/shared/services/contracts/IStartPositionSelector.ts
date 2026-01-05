/**
 * Start Position Selector Interface
 *
 * Responsible for selecting random start positions for sequence generation.
 */
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

export interface IStartPositionSelector {
  /**
   * Select a random start position for sequence generation
   * @param gridMode - Grid mode (diamond/box)
   * @returns Promise resolving to StartPositionData
   */
  selectStartPosition(gridMode: GridMode): Promise<StartPositionData>;
}

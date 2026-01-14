/**
 * Start Position Selector Interface
 *
 * Responsible for selecting random start positions for sequence generation.
 */
import type {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

export interface IStartPositionSelector {
  /**
   * Select a start position for sequence generation
   * @param gridMode - Grid mode (diamond/box)
   * @param specificPosition - Optional specific position to use (if not provided, selects randomly)
   * @returns Promise resolving to StartPositionData
   */
  selectStartPosition(
    gridMode: GridMode,
    specificPosition?: GridPosition
  ): Promise<StartPositionData>;
}

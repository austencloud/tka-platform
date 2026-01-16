import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

export interface IBeatConverter {
  /**
   * Convert PictographData to BeatData - creates proper domain object for beats
   */
  convertToBeat(
    pictograph: PictographData,
    beatNumber: number,
    gridMode: GridMode
  ): BeatData;

  /**
   * Convert PictographData to StartPositionData - creates proper domain object for start positions
   */
  convertToStartPosition(
    pictograph: PictographData,
    gridMode: GridMode
  ): StartPositionData;
}

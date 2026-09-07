import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
import {
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

// The labelled Grid diagram and its responsive companion use one canonical
// start-position owner. ALPHA3 puts the blue hand at west and the red hand at
// east on the diamond grid. The start-position manager prepares staff props by
// default, so both motions are explicitly prepared as hands for this lesson.
const alpha3 = startPositionManager
  .getAllStartPositionVariations(GridMode.DIAMOND)
  .find((position) => position.startPosition === GridPosition.ALPHA3);

export const THE_GRID_ALPHA3: PictographData | undefined = alpha3
  ? ({
      ...alpha3,
      motions: {
        left: alpha3.motions?.left
          ? { ...alpha3.motions.left, propType: PropType.HAND }
          : undefined,
        right: alpha3.motions?.right
          ? { ...alpha3.motions.right, propType: PropType.HAND }
          : undefined,
      },
    } as unknown as PictographData)
  : undefined;

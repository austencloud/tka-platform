import type { GridTopology } from "$lib/shared/multi-grid/domain/models/GridTopology";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PropPlacement } from "../../domain/types";

export interface IPictographTopologyMapper {
  mapToTopology(
    pictograph: PictographData,
    topology: GridTopology,
  ): PropPlacement | null;
}

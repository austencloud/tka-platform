import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { SoloPropStepData } from "../../domain/models/SoloPropStepData";
import type { SoloPropData } from "../../domain/models/SoloPropData";

export interface ISoloPropFactory {
  create(
    steps: readonly SoloPropStepData[],
    startLocation: GridLocation,
    startOrientation: Orientation,
    metadata?: { name?: string; author?: string; notes?: string }
  ): SoloPropData;
}

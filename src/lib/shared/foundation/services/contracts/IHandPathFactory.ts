import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { HandPathData } from "../../domain/models/HandPathData";

export interface IHandPathFactory {
  create(
    locations: readonly GridLocation[],
    metadata?: {
      name?: string;
      author?: string;
      notes?: string;
    }
  ): HandPathData;
}

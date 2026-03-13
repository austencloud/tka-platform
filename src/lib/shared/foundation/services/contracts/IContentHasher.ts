import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IContentHasher {
  hashHandPath(locations: readonly GridLocation[]): string;
  hashSoloProp(soloProp: Pick<SoloPropData, "startLocation" | "startOrientation" | "steps">): string;
}

import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IHandPropStateFactory {
  locationToPropState(location: GridLocation): PropState;
}

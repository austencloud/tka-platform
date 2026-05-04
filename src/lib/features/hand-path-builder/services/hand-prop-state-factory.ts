import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";

export function locationToPropState(location: GridLocation): PropState {
  return {
    centerPathAngle: LOCATION_ANGLES[location],
    staffRotationAngle: 0,
  };
}

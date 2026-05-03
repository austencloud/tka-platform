import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

export class HandPropStateFactory {
  locationToPropState(location: GridLocation): PropState {
    return {
      centerPathAngle: LOCATION_ANGLES[location],
      staffRotationAngle: 0,
    };
  }
}

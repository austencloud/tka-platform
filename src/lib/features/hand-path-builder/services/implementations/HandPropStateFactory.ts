import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IHandPropStateFactory } from "../contracts/IHandPropStateFactory";
import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

export class HandPropStateFactory implements IHandPropStateFactory {
  locationToPropState(location: GridLocation): PropState {
    return {
      centerPathAngle: LOCATION_ANGLES[location],
      staffRotationAngle: 0,
    };
  }
}

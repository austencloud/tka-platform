/**
 * Utility functions for creating start position variations
 * Used as a fallback when StartPositionManager is not available
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import {
  GridMode,
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  MotionType,
  HandSide,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/create-pictograph-data";

// Position to hand location mapping
// Format: [blueLocation (left hand), redLocation (right hand)]
const POSITION_LOCATIONS: Record<GridPosition, [GridLocation, GridLocation]> = {
  // Alpha positions - hands in opposite/inverted directions (180° apart)
  [GridPosition.ALPHA1]: [GridLocation.SOUTH, GridLocation.NORTH],
  [GridPosition.ALPHA2]: [GridLocation.SOUTHWEST, GridLocation.NORTHEAST],
  [GridPosition.ALPHA3]: [GridLocation.WEST, GridLocation.EAST],
  [GridPosition.ALPHA4]: [GridLocation.NORTHWEST, GridLocation.SOUTHEAST],
  [GridPosition.ALPHA5]: [GridLocation.NORTH, GridLocation.SOUTH],
  [GridPosition.ALPHA6]: [GridLocation.NORTHEAST, GridLocation.SOUTHWEST],
  [GridPosition.ALPHA7]: [GridLocation.EAST, GridLocation.WEST],
  [GridPosition.ALPHA8]: [GridLocation.SOUTHEAST, GridLocation.NORTHWEST],

  // Beta positions - both hands same direction (0° apart)
  [GridPosition.BETA1]: [GridLocation.NORTH, GridLocation.NORTH],
  [GridPosition.BETA2]: [GridLocation.NORTHEAST, GridLocation.NORTHEAST],
  [GridPosition.BETA3]: [GridLocation.EAST, GridLocation.EAST],
  [GridPosition.BETA4]: [GridLocation.SOUTHEAST, GridLocation.SOUTHEAST],
  [GridPosition.BETA5]: [GridLocation.SOUTH, GridLocation.SOUTH],
  [GridPosition.BETA6]: [GridLocation.SOUTHWEST, GridLocation.SOUTHWEST],
  [GridPosition.BETA7]: [GridLocation.WEST, GridLocation.WEST],
  [GridPosition.BETA8]: [GridLocation.NORTHWEST, GridLocation.NORTHWEST],

  // Gamma positions - 90° apart
  [GridPosition.GAMMA1]: [GridLocation.WEST, GridLocation.NORTH],
  [GridPosition.GAMMA2]: [GridLocation.NORTHWEST, GridLocation.NORTHEAST],
  [GridPosition.GAMMA3]: [GridLocation.NORTH, GridLocation.EAST],
  [GridPosition.GAMMA4]: [GridLocation.NORTHEAST, GridLocation.SOUTHEAST],
  [GridPosition.GAMMA5]: [GridLocation.EAST, GridLocation.SOUTH],
  [GridPosition.GAMMA6]: [GridLocation.SOUTHEAST, GridLocation.SOUTHWEST],
  [GridPosition.GAMMA7]: [GridLocation.SOUTH, GridLocation.WEST],
  [GridPosition.GAMMA8]: [GridLocation.SOUTHWEST, GridLocation.NORTHWEST],
  [GridPosition.GAMMA9]: [GridLocation.EAST, GridLocation.NORTH],
  [GridPosition.GAMMA10]: [GridLocation.SOUTHEAST, GridLocation.NORTHEAST],
  [GridPosition.GAMMA11]: [GridLocation.SOUTH, GridLocation.EAST],
  [GridPosition.GAMMA12]: [GridLocation.SOUTHWEST, GridLocation.SOUTHEAST],
  [GridPosition.GAMMA13]: [GridLocation.WEST, GridLocation.SOUTH],
  [GridPosition.GAMMA14]: [GridLocation.NORTHWEST, GridLocation.SOUTHWEST],
  [GridPosition.GAMMA15]: [GridLocation.NORTH, GridLocation.WEST],
  [GridPosition.GAMMA16]: [GridLocation.NORTHEAST, GridLocation.NORTHWEST],

  // Zeta positions - 135° apart (obtuse angle)
  // Zeta 1-8: Blue is 135° CCW from Red
  [GridPosition.ZETA1]: [GridLocation.SOUTHWEST, GridLocation.NORTH],
  [GridPosition.ZETA2]: [GridLocation.WEST, GridLocation.NORTHEAST],
  [GridPosition.ZETA3]: [GridLocation.NORTHWEST, GridLocation.EAST],
  [GridPosition.ZETA4]: [GridLocation.NORTH, GridLocation.SOUTHEAST],
  [GridPosition.ZETA5]: [GridLocation.NORTHEAST, GridLocation.SOUTH],
  [GridPosition.ZETA6]: [GridLocation.EAST, GridLocation.SOUTHWEST],
  [GridPosition.ZETA7]: [GridLocation.SOUTHEAST, GridLocation.WEST],
  [GridPosition.ZETA8]: [GridLocation.SOUTH, GridLocation.NORTHWEST],
  // Zeta 9-16: Blue is 135° CW from Red
  [GridPosition.ZETA9]: [GridLocation.SOUTHEAST, GridLocation.NORTH],
  [GridPosition.ZETA10]: [GridLocation.SOUTH, GridLocation.NORTHEAST],
  [GridPosition.ZETA11]: [GridLocation.SOUTHWEST, GridLocation.EAST],
  [GridPosition.ZETA12]: [GridLocation.WEST, GridLocation.SOUTHEAST],
  [GridPosition.ZETA13]: [GridLocation.NORTHWEST, GridLocation.SOUTH],
  [GridPosition.ZETA14]: [GridLocation.NORTH, GridLocation.SOUTHWEST],
  [GridPosition.ZETA15]: [GridLocation.NORTHEAST, GridLocation.WEST],
  [GridPosition.ZETA16]: [GridLocation.EAST, GridLocation.NORTHWEST],

  // Eta positions - 45° apart (acute angle)
  // Eta 1-8: Blue is 45° CCW from Red
  [GridPosition.ETA1]: [GridLocation.NORTHWEST, GridLocation.NORTH],
  [GridPosition.ETA2]: [GridLocation.NORTH, GridLocation.NORTHEAST],
  [GridPosition.ETA3]: [GridLocation.NORTHEAST, GridLocation.EAST],
  [GridPosition.ETA4]: [GridLocation.EAST, GridLocation.SOUTHEAST],
  [GridPosition.ETA5]: [GridLocation.SOUTHEAST, GridLocation.SOUTH],
  [GridPosition.ETA6]: [GridLocation.SOUTH, GridLocation.SOUTHWEST],
  [GridPosition.ETA7]: [GridLocation.SOUTHWEST, GridLocation.WEST],
  [GridPosition.ETA8]: [GridLocation.WEST, GridLocation.NORTHWEST],
  // Eta 9-16: Blue is 45° CW from Red
  [GridPosition.ETA9]: [GridLocation.NORTHEAST, GridLocation.NORTH],
  [GridPosition.ETA10]: [GridLocation.EAST, GridLocation.NORTHEAST],
  [GridPosition.ETA11]: [GridLocation.SOUTHEAST, GridLocation.EAST],
  [GridPosition.ETA12]: [GridLocation.SOUTH, GridLocation.SOUTHEAST],
  [GridPosition.ETA13]: [GridLocation.SOUTHWEST, GridLocation.SOUTH],
  [GridPosition.ETA14]: [GridLocation.WEST, GridLocation.SOUTHWEST],
  [GridPosition.ETA15]: [GridLocation.NORTHWEST, GridLocation.WEST],
  [GridPosition.ETA16]: [GridLocation.NORTH, GridLocation.NORTHWEST],

  // Tau positions - one hand at center, one at perimeter (Level 6)
  // TAU1-8: Blue at center, red at perimeter
  [GridPosition.TAU1]: [GridLocation.CENTER, GridLocation.NORTH],
  [GridPosition.TAU2]: [GridLocation.CENTER, GridLocation.NORTHEAST],
  [GridPosition.TAU3]: [GridLocation.CENTER, GridLocation.EAST],
  [GridPosition.TAU4]: [GridLocation.CENTER, GridLocation.SOUTHEAST],
  [GridPosition.TAU5]: [GridLocation.CENTER, GridLocation.SOUTH],
  [GridPosition.TAU6]: [GridLocation.CENTER, GridLocation.SOUTHWEST],
  [GridPosition.TAU7]: [GridLocation.CENTER, GridLocation.WEST],
  [GridPosition.TAU8]: [GridLocation.CENTER, GridLocation.NORTHWEST],
  // TAU9-16: Red at center, blue at perimeter
  [GridPosition.TAU9]: [GridLocation.NORTH, GridLocation.CENTER],
  [GridPosition.TAU10]: [GridLocation.NORTHEAST, GridLocation.CENTER],
  [GridPosition.TAU11]: [GridLocation.EAST, GridLocation.CENTER],
  [GridPosition.TAU12]: [GridLocation.SOUTHEAST, GridLocation.CENTER],
  [GridPosition.TAU13]: [GridLocation.SOUTH, GridLocation.CENTER],
  [GridPosition.TAU14]: [GridLocation.SOUTHWEST, GridLocation.CENTER],
  [GridPosition.TAU15]: [GridLocation.WEST, GridLocation.CENTER],
  [GridPosition.TAU16]: [GridLocation.NORTHWEST, GridLocation.CENTER],

  // Terra - both hands at center
  [GridPosition.TERRA1]: [GridLocation.CENTER, GridLocation.CENTER],
};

// Diamond mode positions (odd numbers for alpha/beta, odd for gamma)
const DIAMOND_POSITIONS: Array<{ position: GridPosition; letter: Letter }> = [
  { position: GridPosition.ALPHA1, letter: Letter.ALPHA },
  { position: GridPosition.ALPHA3, letter: Letter.ALPHA },
  { position: GridPosition.ALPHA5, letter: Letter.ALPHA },
  { position: GridPosition.ALPHA7, letter: Letter.ALPHA },
  { position: GridPosition.BETA1, letter: Letter.BETA },
  { position: GridPosition.BETA3, letter: Letter.BETA },
  { position: GridPosition.BETA5, letter: Letter.BETA },
  { position: GridPosition.BETA7, letter: Letter.BETA },
  { position: GridPosition.GAMMA1, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA3, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA5, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA7, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA9, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA11, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA13, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA15, letter: Letter.GAMMA },
];

// Box mode positions (even numbers)
const BOX_POSITIONS: Array<{ position: GridPosition; letter: Letter }> = [
  { position: GridPosition.ALPHA2, letter: Letter.ALPHA },
  { position: GridPosition.ALPHA4, letter: Letter.ALPHA },
  { position: GridPosition.ALPHA6, letter: Letter.ALPHA },
  { position: GridPosition.ALPHA8, letter: Letter.ALPHA },
  { position: GridPosition.BETA2, letter: Letter.BETA },
  { position: GridPosition.BETA4, letter: Letter.BETA },
  { position: GridPosition.BETA6, letter: Letter.BETA },
  { position: GridPosition.BETA8, letter: Letter.BETA },
  { position: GridPosition.GAMMA2, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA4, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA6, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA8, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA10, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA12, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA14, letter: Letter.GAMMA },
  { position: GridPosition.GAMMA16, letter: Letter.GAMMA },
];

/**
 * Create all 16 start position variations for the given grid mode
 * Returns full PictographData objects with proper motion data
 */
export function createStartPositionVariations(
  gridMode: GridMode
): PictographData[] {
  const positions =
    gridMode === GridMode.DIAMOND ? DIAMOND_POSITIONS : BOX_POSITIONS;

  return positions.map((pos) => {
    const locations = POSITION_LOCATIONS[pos.position];
    if (!locations) {
      throw new Error(`No location mapping found for position: ${pos.position}`);
    }
    const [leftLocation, rightLocation] = locations;

    // Create proper motion data for both hands
    const leftMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: leftLocation,
      endLocation: leftLocation,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      hand: HandSide.LEFT,
      isVisible: true,
      propType: PropType.STAFF,
      arrowLocation: leftLocation,
      gridMode: gridMode,
    });

    const rightMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: rightLocation,
      endLocation: rightLocation,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      hand: HandSide.RIGHT,
      isVisible: true,
      propType: PropType.STAFF,
      arrowLocation: rightLocation,
      gridMode: gridMode,
    });

    return createPictographData({
      id: `start-${pos.position}`,
      letter: pos.letter,
      startPosition: pos.position,
      endPosition: pos.position,
      motions: {
        [HandSide.LEFT]: leftMotion,
        [HandSide.RIGHT]: rightMotion,
      },
    });
  });
}

import type { PictographData } from '$lib/shared/pictograph/shared/domain/models/pictograph-data';
import { createMotionData } from '$lib/shared/pictograph/shared/domain/models/motion-data';
import { MotionType, MotionColor } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
import { GridLocation, GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
import type { StaffMotionNotation } from '../domain/notation-3d';

/** Lowercase notation location -> GridLocation enum value. */
const LOCATION_MAP: Record<string, GridLocation> = {
  n: GridLocation.NORTH,
  ne: GridLocation.NORTHEAST,
  e: GridLocation.EAST,
  se: GridLocation.SOUTHEAST,
  s: GridLocation.SOUTH,
  sw: GridLocation.SOUTHWEST,
  w: GridLocation.WEST,
  nw: GridLocation.NORTHWEST,
};

const CARDINAL = new Set(['n', 'e', 's', 'w']);

function toMotion(n: StaffMotionNotation, color: MotionColor, gridMode: GridMode) {
  return createMotionData({
    motionType: n.motionType,
    rotationDirection: n.rotationDirection,
    startLocation: LOCATION_MAP[n.startLocation]!,
    endLocation: LOCATION_MAP[n.endLocation]!,
    turns: n.motionType === MotionType.FLOAT ? 'fl' : n.turns,
    startOrientation: n.startOrientation,
    endOrientation: n.endOrientation,
    color,
    gridMode,
  });
}

/** Build a renderable PictographData from a blue+red notation pair. */
export function notationToPictographData(
  blue: StaffMotionNotation,
  red: StaffMotionNotation,
  id: string,
): PictographData {
  const allCardinal = [blue.startLocation, blue.endLocation, red.startLocation, red.endLocation]
    .every((l) => CARDINAL.has(l));
  const gridMode = allCardinal ? GridMode.DIAMOND : GridMode.BOX;

  return {
    id,
    letter: null,
    motions: {
      blue: toMotion(blue, MotionColor.BLUE, gridMode),
      red: toMotion(red, MotionColor.RED, gridMode),
    },
    gridMode,
  };
}

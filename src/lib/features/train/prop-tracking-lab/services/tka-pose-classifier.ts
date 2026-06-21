import { Vector3 } from 'three';
import type { GridLocation } from '../domain/models';
import { GridMode } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';

/** 8 grid locations ordered clockwise from North at 45deg steps. */
const LOCATIONS: GridLocation[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
const CARDINALS = new Set<GridLocation>(['n', 'e', 's', 'w']);

export interface ClassifierConfig {
  /** Round turns to this increment. 0.5 = half-turn (L3); 0.25 = quarter (L6). */
  turnIncrement: number;
  /** |cos angle| above this = radial (in/out); below = nonradial (clock/counter). */
  radialDotThreshold: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
  turnIncrement: 0.5,
  radialDotThreshold: 0.707, // 45deg split between radial and nonradial
};

export class TkaPoseClassifier {
  constructor(private config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG) {}

  /** Nearest of the 8 grid locations for a grip position (XY plane, Z ignored). */
  classifyLocation(gripPos: Vector3): GridLocation {
    // Clockwise angle from North: atan2(East, North).
    const theta = Math.atan2(gripPos.x, gripPos.y); // (-PI, PI], 0 = North
    const deg = ((theta * 180) / Math.PI + 360) % 360;
    const bucket = Math.round(deg / 45) % 8;
    return LOCATIONS[bucket]!;
  }

  /** Diamond when at least one end is cardinal; box when both intercardinal. */
  gridModeFor(a: GridLocation, b: GridLocation): GridMode {
    const cardinalCount = (CARDINALS.has(a) ? 1 : 0) + (CARDINALS.has(b) ? 1 : 0);
    return cardinalCount >= 1 ? GridMode.DIAMOND : GridMode.BOX;
  }
}

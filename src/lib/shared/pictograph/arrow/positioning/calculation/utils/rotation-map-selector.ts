import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import {
  staticRadialClockwiseMap,
  staticRadialCounterClockwiseMap,
  staticNonRadialClockwiseMap,
  staticNonRadialCounterClockwiseMap,
  staticRadialOverrideMap,
  staticNonRadialOverrideMap,
} from "../config/static-rotation-maps";
import {
  proClockwiseMap,
  proCounterClockwiseMap,
  antiClockwiseMap,
  antiCounterClockwiseMap,
} from "../config/pro-anti-rotation-maps";
import {
  dashClockwiseMap,
  dashCounterClockwiseMap,
} from "../config/dash-rotation-maps";
import {
  floatClockwiseHandpathMap,
  floatCounterClockwiseHandpathMap,
} from "../config/float-rotation-maps";
import { isClockwise } from "./rotation-direction-utils";

export function selectStaticMap(
  isRadial: boolean,
  rotationDirection: string
): Record<GridLocation, number> {
  const clockwise = isClockwise(rotationDirection);
  if (isRadial) {
    return clockwise ? staticRadialClockwiseMap : staticRadialCounterClockwiseMap;
  } else {
    return clockwise ? staticNonRadialClockwiseMap : staticNonRadialCounterClockwiseMap;
  }
}

export function selectStaticOverrideMap(
  isRadial: boolean
): Record<GridLocation, Record<string, number>> {
  return isRadial ? staticRadialOverrideMap : staticNonRadialOverrideMap;
}

export function selectProMap(rotationDirection: string): Record<GridLocation, number> {
  return isClockwise(rotationDirection) ? proClockwiseMap : proCounterClockwiseMap;
}

export function selectAntiMap(rotationDirection: string): Record<GridLocation, number> {
  return isClockwise(rotationDirection) ? antiClockwiseMap : antiCounterClockwiseMap;
}

export function selectDashMap(rotationDirection: string): Record<GridLocation, number> {
  return isClockwise(rotationDirection) ? dashClockwiseMap : dashCounterClockwiseMap;
}

export function selectFloatMap(
  handpathDirection: "cw" | "ccw"
): Record<GridLocation, number> {
  return handpathDirection === "cw"
    ? floatClockwiseHandpathMap
    : floatCounterClockwiseHandpathMap;
}

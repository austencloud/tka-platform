import type { GridLocation } from "@tka/types";
import {
  staticRadialClockwiseMap,
  staticRadialCounterClockwiseMap,
  staticNonRadialClockwiseMap,
  staticNonRadialCounterClockwiseMap,
  staticRadialOverrideMap,
  staticNonRadialOverrideMap,
} from "../../constants/arrow/StaticRotationMaps";
import {
  proClockwiseMap,
  proCounterClockwiseMap,
  antiClockwiseMap,
  antiCounterClockwiseMap,
} from "../../constants/arrow/ProAntiRotationMaps";
import {
  dashClockwiseMap,
  dashCounterClockwiseMap,
} from "../../constants/arrow/DashRotationMaps";
import {
  floatClockwiseHandpathMap,
  floatCounterClockwiseHandpathMap,
} from "../../constants/arrow/FloatRotationMaps";
import { isClockwise } from "./RotationDirectionUtils";

export class RotationMapSelector {
  static selectStaticMap(
    isRadial: boolean,
    rotationDirection: string
  ): Record<GridLocation, number> {
    const clockwise = isClockwise(rotationDirection);

    if (isRadial) {
      return clockwise
        ? staticRadialClockwiseMap
        : staticRadialCounterClockwiseMap;
    } else {
      return clockwise
        ? staticNonRadialClockwiseMap
        : staticNonRadialCounterClockwiseMap;
    }
  }

  static selectStaticOverrideMap(
    isRadial: boolean
  ): Record<GridLocation, Record<string, number>> {
    return isRadial ? staticRadialOverrideMap : staticNonRadialOverrideMap;
  }

  static selectProMap(rotationDirection: string): Record<GridLocation, number> {
    return isClockwise(rotationDirection)
      ? proClockwiseMap
      : proCounterClockwiseMap;
  }

  static selectAntiMap(
    rotationDirection: string
  ): Record<GridLocation, number> {
    return isClockwise(rotationDirection)
      ? antiClockwiseMap
      : antiCounterClockwiseMap;
  }

  static selectDashMap(
    rotationDirection: string
  ): Record<GridLocation, number> {
    return isClockwise(rotationDirection)
      ? dashClockwiseMap
      : dashCounterClockwiseMap;
  }

  static selectFloatMap(
    handpathDirection: "cw" | "ccw"
  ): Record<GridLocation, number> {
    return handpathDirection === "cw"
      ? floatClockwiseHandpathMap
      : floatCounterClockwiseHandpathMap;
  }
}

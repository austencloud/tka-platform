import type { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import {
  staticRadialClockwiseMap,
  staticRadialCounterClockwiseMap,
  staticNonRadialClockwiseMap,
  staticNonRadialCounterClockwiseMap,
  staticRadialOverrideMap,
  staticNonRadialOverrideMap,
} from "../config/StaticRotationMaps";
import {
  proClockwiseMap,
  proCounterClockwiseMap,
  antiClockwiseMap,
  antiCounterClockwiseMap,
} from "../config/ProAntiRotationMaps";
import {
  dashClockwiseMap,
  dashCounterClockwiseMap,
} from "../config/DashRotationMaps";
import {
  floatClockwiseHandpathMap,
  floatCounterClockwiseHandpathMap,
} from "../config/FloatRotationMaps";
import { isClockwise } from "./RotationDirectionUtils";

/**
 * Utility class for selecting the appropriate rotation map based on
 * motion type, orientation, and rotation direction.
 *
 * Centralizes map selection logic to reduce code duplication and improve maintainability.
 */
export class RotationMapSelector {
  /**
   * Select rotation map for STATIC motion type.
   *
   * @param isRadial - Whether the orientation is radial (IN/OUT) vs non-radial (CLOCK/COUNTER)
   * @param rotationDirection - The rotation direction string
   * @returns The appropriate rotation map
   */
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

  /**
   * Select override rotation map for STATIC motion type.
   *
   * @param isRadial - Whether the orientation is radial (IN/OUT) vs non-radial (CLOCK/COUNTER)
   * @returns The appropriate override rotation map
   */
  static selectStaticOverrideMap(
    isRadial: boolean
  ): Record<GridLocation, Record<string, number>> {
    return isRadial ? staticRadialOverrideMap : staticNonRadialOverrideMap;
  }

  /**
   * Select rotation map for PRO motion type.
   *
   * @param rotationDirection - The rotation direction string
   * @returns The appropriate rotation map
   */
  static selectProMap(rotationDirection: string): Record<GridLocation, number> {
    return isClockwise(rotationDirection)
      ? proClockwiseMap
      : proCounterClockwiseMap;
  }

  /**
   * Select rotation map for ANTI motion type.
   *
   * @param rotationDirection - The rotation direction string
   * @returns The appropriate rotation map
   */
  static selectAntiMap(
    rotationDirection: string
  ): Record<GridLocation, number> {
    return isClockwise(rotationDirection)
      ? antiClockwiseMap
      : antiCounterClockwiseMap;
  }

  /**
   * Select rotation map for DASH motion type.
   *
   * @param rotationDirection - The rotation direction string
   * @returns The appropriate rotation map
   */
  static selectDashMap(
    rotationDirection: string
  ): Record<GridLocation, number> {
    return isClockwise(rotationDirection)
      ? dashClockwiseMap
      : dashCounterClockwiseMap;
  }

  /**
   * Select rotation map for FLOAT motion type based on handpath direction.
   *
   * @param handpathDirection - The calculated handpath direction ("cw" or "ccw")
   * @returns The appropriate rotation map
   */
  static selectFloatMap(
    handpathDirection: "cw" | "ccw"
  ): Record<GridLocation, number> {
    return handpathDirection === "cw"
      ? floatClockwiseHandpathMap
      : floatCounterClockwiseHandpathMap;
  }
}

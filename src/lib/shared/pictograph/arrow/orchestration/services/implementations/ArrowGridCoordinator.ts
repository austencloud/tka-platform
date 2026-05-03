/**
 * Arrow Grid Coordinate Service
 *
 * Uses the grid module's coordinate system instead of duplicating data.
 * Provides arrow-specific coordinate functionality using the authoritative grid data.
 */

import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import { GridMode } from "../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import { Point } from "fabric";
import { createGridPointData } from "../../../../grid/utils/grid-coordinate-utils";


export class ArrowGridCoordinator {
  // Scene dimensions from grid module
  private readonly SCENE_SIZE = 950;
  private readonly CENTER_X = 475.0;
  private readonly CENTER_Y = 475.0;

  getInitialPosition(motion: MotionData, location: GridLocation, overrideGridMode?: GridMode): Point {
    const motionType = motion.motionType.toLowerCase();
    // Use override gridMode (from PictographPreparer derivation) if provided,
    // otherwise fall back to motion.gridMode or infer from location
    // Box mode uses intercardinal (NE, SE, SW, NW), diamond uses cardinal (N, E, S, W)
    const gridMode =
      overrideGridMode || motion.gridMode || this.inferGridModeFromLocation(location);

    let coords: Point;
    if (["pro", "anti", "float"].includes(motionType || "")) {
      // Shift arrows use layer2 points
      coords = this.getLayer2Coords(location, gridMode);
    } else if (["static", "dash"].includes(motionType || "")) {
      // Static/dash arrows use hand points
      coords = this.getHandPointCoords(location, gridMode);
    } else {
      // Default fallback
      coords = this.getSceneCenter();
    }

    return coords;
  }

  getSceneCenter(): Point {
    return new Point(this.CENTER_X, this.CENTER_Y);
  }

  getSceneDimensions(): [number, number] {
    return [this.SCENE_SIZE, this.SCENE_SIZE];
  }

  validateCoordinates(point: Point): boolean {
    return (
      point &&
      typeof point.x === "number" &&
      typeof point.y === "number" &&
      point.x >= 0 &&
      point.x <= this.SCENE_SIZE &&
      point.y >= 0 &&
      point.y <= this.SCENE_SIZE
    );
  }

  getAllHandPoints(
    gridMode: GridMode = GridMode.DIAMOND
  ): Partial<Record<GridLocation, Point>> {
    const gridData = createGridPointData(gridMode);
    const handPoints: Partial<Record<GridLocation, Point>> = {};

    // Map grid coordinate keys to GridLocation enum (strict points)
    const locationMap: Record<string, GridLocation> = {
      n_diamond_hand_point_strict: GridLocation.NORTH,
      e_diamond_hand_point_strict: GridLocation.EAST,
      s_diamond_hand_point_strict: GridLocation.SOUTH,
      w_diamond_hand_point_strict: GridLocation.WEST,
      ne_box_hand_point_strict: GridLocation.NORTHEAST,
      se_box_hand_point_strict: GridLocation.SOUTHEAST,
      sw_box_hand_point_strict: GridLocation.SOUTHWEST,
      nw_box_hand_point_strict: GridLocation.NORTHWEST,
    };

    // Extract hand points from grid data (using strict points for animation viewer)
    Object.entries(gridData.allHandPointsStrict).forEach(([key, value]) => {
      const location = locationMap[key];
      if (location && value.coordinates) {
        handPoints[location] = new Point(
          value.coordinates.x,
          value.coordinates.y
        );
      }
    });

    // Center is always at the scene center (475, 475) regardless of grid mode
    handPoints[GridLocation.CENTER] = new Point(this.CENTER_X, this.CENTER_Y);

    return handPoints;
  }

  getAllLayer2Points(
    gridMode: GridMode = GridMode.DIAMOND
  ): Partial<Record<GridLocation, Point>> {
    const gridData = createGridPointData(gridMode);
    const layer2Points: Partial<Record<GridLocation, Point>> = {};

    // For diamond mode, layer2 points are diagonal positions (strict points)
    if (gridMode === GridMode.DIAMOND) {
      // Diamond layer2 strict points map to diagonal positions
      layer2Points[GridLocation.NORTHEAST] = new Point(625.0, 325.0);
      layer2Points[GridLocation.SOUTHEAST] = new Point(625.0, 625.0);
      layer2Points[GridLocation.SOUTHWEST] = new Point(325.0, 625.0);
      layer2Points[GridLocation.NORTHWEST] = new Point(325.0, 325.0);

      // For cardinal directions, map to nearest diagonal
      layer2Points[GridLocation.NORTH] = layer2Points[GridLocation.NORTHEAST];
      layer2Points[GridLocation.EAST] = layer2Points[GridLocation.SOUTHEAST];
      layer2Points[GridLocation.SOUTH] = layer2Points[GridLocation.SOUTHWEST];
      layer2Points[GridLocation.WEST] = layer2Points[GridLocation.NORTHWEST];
    } else if (gridMode === GridMode.SKEWED) {
      // SKEWED mode: arrows can be at ANY of the 8 positions
      // Cardinal positions (where skewed arrows typically land)
      layer2Points[GridLocation.NORTH] = new Point(475.0, 325.0);
      layer2Points[GridLocation.EAST] = new Point(625.0, 475.0);
      layer2Points[GridLocation.SOUTH] = new Point(475.0, 625.0);
      layer2Points[GridLocation.WEST] = new Point(325.0, 475.0);
      // Intercardinal positions (for motions ending at box positions)
      layer2Points[GridLocation.NORTHEAST] = new Point(625.0, 325.0);
      layer2Points[GridLocation.SOUTHEAST] = new Point(625.0, 625.0);
      layer2Points[GridLocation.SOUTHWEST] = new Point(325.0, 625.0);
      layer2Points[GridLocation.NORTHWEST] = new Point(325.0, 325.0);
    } else {
      // For box mode, use strict layer2 points from grid data
      const locationMap: Record<string, GridLocation> = {
        n_box_layer2_point_strict: GridLocation.NORTH,
        e_box_layer2_point_strict: GridLocation.EAST,
        s_box_layer2_point_strict: GridLocation.SOUTH,
        w_box_layer2_point_strict: GridLocation.WEST,
      };

      Object.entries(gridData.allLayer2PointsStrict).forEach(([key, value]) => {
        const location = locationMap[key];
        if (location && value.coordinates) {
          layer2Points[location] = new Point(
            value.coordinates.x,
            value.coordinates.y
          );
        }
      });

      // Box mode: Map intercardinal locations to nearest cardinal layer2 points
      // In box mode, hands are at NE/SE/SW/NW but layer2 is at N/E/S/W
      // When a shift arrow needs positioning at an intercardinal, use nearest cardinal
      if (layer2Points[GridLocation.NORTH] && layer2Points[GridLocation.EAST]) {
        layer2Points[GridLocation.NORTHEAST] = layer2Points[GridLocation.NORTH];
        layer2Points[GridLocation.SOUTHEAST] = layer2Points[GridLocation.EAST];
        layer2Points[GridLocation.SOUTHWEST] = layer2Points[GridLocation.SOUTH];
        layer2Points[GridLocation.NORTHWEST] = layer2Points[GridLocation.WEST];
      }
    }

    return layer2Points;
  }

  getSupportedLocations(): GridLocation[] {
    return [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];
  }

  private getLayer2Coords(location: GridLocation, gridMode: GridMode): Point {
    // Try requested mode first
    let layer2Points = this.getAllLayer2Points(gridMode);
    let coords = layer2Points[location];

    // If not found, try the opposite mode (data may have gridMode/location mismatch)
    if (!coords) {
      const altMode =
        gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
      layer2Points = this.getAllLayer2Points(altMode);
      coords = layer2Points[location];

      if (coords) {
        console.debug(
          `Layer2 location ${location} not in ${gridMode} mode, found in ${altMode} mode`
        );
      }
    }

    if (!coords) {
      console.warn(
        `No layer2 coordinates for location: ${location} in any mode, using center`
      );
      return this.getSceneCenter();
    }
    return coords;
  }

  private getHandPointCoords(
    location: GridLocation,
    gridMode: GridMode
  ): Point {
    // Try requested mode first
    let handPoints = this.getAllHandPoints(gridMode);
    let coords = handPoints[location];

    // If not found, try the opposite mode (data may have gridMode/location mismatch)
    if (!coords) {
      const altMode =
        gridMode === GridMode.DIAMOND ? GridMode.BOX : GridMode.DIAMOND;
      handPoints = this.getAllHandPoints(altMode);
      coords = handPoints[location];

      if (coords) {
        // Found in alternate mode - data has mismatch but we recovered
        console.debug(
          `Location ${location} not in ${gridMode} mode, found in ${altMode} mode`
        );
      }
    }

    if (!coords) {
      console.warn(
        `No hand point coordinates for location: ${location} in any mode, using center`
      );
      return this.getSceneCenter();
    }
    return coords;
  }

  /**
   * Infer grid mode from location when not explicitly set.
   * Intercardinal locations (NE, SE, SW, NW) = BOX mode
   * Cardinal locations (N, E, S, W) = DIAMOND mode
   */
  private inferGridModeFromLocation(location: GridLocation): GridMode {
    const boxLocations: GridLocation[] = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];
    return boxLocations.includes(location) ? GridMode.BOX : GridMode.DIAMOND;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowGridCoordinator to avoid DI container rebuilds.
// ============================================================================

export const arrowGridCoordinator = new ArrowGridCoordinator();

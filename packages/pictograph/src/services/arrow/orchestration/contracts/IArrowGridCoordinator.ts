import type { GridLocation, GridMode, MotionData } from "@tka/types";
import type { Point } from "../../../../domain/Point";

export interface IArrowGridCoordinator {
  getInitialPosition(
    motion: MotionData,
    location: GridLocation,
    gridMode?: GridMode
  ): Point;

  getSceneCenter(): Point;

  getSceneDimensions(): [number, number];

  validateCoordinates(point: Point): boolean;

  getAllHandPoints(
    gridMode?: GridMode
  ): Partial<Record<GridLocation, Point>>;

  getAllLayer2Points(
    gridMode?: GridMode
  ): Partial<Record<GridLocation, Point>>;

  getSupportedLocations(): GridLocation[];
}

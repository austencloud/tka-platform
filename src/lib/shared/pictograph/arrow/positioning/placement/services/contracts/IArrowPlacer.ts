/**
 * Arrow Placement Service Contracts
 *
 * Interfaces for arrow placement calculations and key generation.
 */

import type { MotionType } from "../../../../../shared/domain/enums/pictograph-enums";
import type { GridMode } from "../../../../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { Point } from "fabric";

export interface IArrowPlacer {
  getDefaultAdjustment(
    motionType: MotionType,
    placementKey: string,
    turns: number | string,
    gridMode: GridMode
  ): Promise<{ x: number; y: number }>;

  getAvailablePlacementKeys(
    motionType: MotionType,
    gridMode: GridMode
  ): Promise<string[]>;

  isLoaded(gridMode?: GridMode): boolean;

  /** @deprecated Use ensureGridModeLoaded for lazy loading */
  loadPlacementData(): Promise<void>;

  /** Lazy load placement data for a specific grid mode only */
  ensureGridModeLoaded(gridMode: GridMode): Promise<void>;
}

export interface ISpecialPlacer {
  getSpecialAdjustment(
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Promise<Point | null>;

  hasRotationAngleOverride(
    motionData: MotionData,
    pictographData: PictographData,
    rotationOverrideKey: string
  ): Promise<boolean>;
}

export interface IDefaultPlacer {
  getDefaultAdjustment(
    placementKey: string,
    turns: number | string,
    motionType: MotionType,
    gridMode: GridMode
  ): Promise<{ x: number; y: number }>;

  getAvailablePlacementKeys(
    motionType: MotionType,
    gridMode: GridMode
  ): Promise<string[]>;

  isLoaded(): boolean;

  getPlacementData(
    motionType: MotionType,
    placementKey: string,
    gridMode: GridMode
  ): Promise<{ [turns: string]: [number, number] }>;

  debugAvailableKeys(motionType: MotionType, gridMode: GridMode): Promise<void>;
}

export interface IArrowAdjustmentLookup {
  getBaseAdjustment(
    pictographData: PictographData,
    motionData: MotionData,
    letter: string,
    arrowColor?: string
  ): Promise<Point>;
}

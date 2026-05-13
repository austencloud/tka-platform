/**
 * Layer Key Deriver
 *
 * Generates cache keys for individual layers.
 *
 * CRITICAL: Base layer keys EXCLUDE all visibility settings.
 * This allows the base layer cache to survive ALL visibility toggles.
 */

import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { LayerRenderOptions } from "../services/contracts/types";

export interface BaseLayerKeyComponents {
  motionHash: string;
  bluePropType: string;
  redPropType: string;
  darkMode: boolean;
  size: number;
  showBlueMotion: boolean;
  showRedMotion: boolean;
  showVTG: boolean;
  showElemental: boolean;
  showPositions: boolean;
  handPathMode: boolean;
}

export interface GridPointsLayerKeyComponents {
  showNonRadialPoints: boolean;
  handPointVisibility: "all" | "active";
  gridMode: string;
  darkMode: boolean;
  size: number;
}

export interface TKALayerKeyComponents {
  letter: string;
  turnsTuple: string;
  blueMotionType: string;
  redMotionType: string;
  darkMode: boolean;
  size: number;
}

export interface ReversalLayerKeyComponents {
  blueReversal: boolean;
  redReversal: boolean;
  size: number;
}

export interface StepLayerKeyComponents {
  stepNumber: number;
  darkMode: boolean;
  size: number;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function hashComponents(obj: object): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return simpleHash(str);
}

function deriveMotionHash(pictograph: PreparedPictographData): string {
  const blueMotion = pictograph.motions?.blue;
  const redMotion = pictograph.motions?.red;

  const parts: string[] = [];

  if (blueMotion) {
    parts.push(`b:${blueMotion.motionType ?? ""}:${blueMotion.startLocation ?? ""}:${blueMotion.endLocation ?? ""}`);
    parts.push(`bt:${blueMotion.turns ?? 0}:${blueMotion.rotationDirection ?? ""}`);
    parts.push(`bo:${blueMotion.startOrientation ?? ""}:${blueMotion.endOrientation ?? ""}`);
  }

  if (redMotion) {
    parts.push(`r:${redMotion.motionType ?? ""}:${redMotion.startLocation ?? ""}:${redMotion.endLocation ?? ""}`);
    parts.push(`rt:${redMotion.turns ?? 0}:${redMotion.rotationDirection ?? ""}`);
    parts.push(`ro:${redMotion.startOrientation ?? ""}:${redMotion.endOrientation ?? ""}`);
  }

  const prepared = pictograph._prepared;
  if (prepared?.gridMode) {
    parts.push(`g:${prepared.gridMode}`);
  }

  return simpleHash(parts.join("|"));
}

export function getBaseLayerComponents(
  pictograph: PreparedPictographData,
  options: LayerRenderOptions
): BaseLayerKeyComponents {
  return {
    motionHash: deriveMotionHash(pictograph),
    bluePropType: options.bluePropType ?? pictograph.motions?.blue?.propType ?? "staff",
    redPropType: options.redPropType ?? pictograph.motions?.red?.propType ?? "staff",
    darkMode: options.darkMode,
    size: options.size,
    showBlueMotion: options.showBlueMotion ?? true,
    showRedMotion: options.showRedMotion ?? true,
    showVTG: options.showVTG ?? false,
    showElemental: options.showElemental ?? false,
    showPositions: options.showPositions ?? false,
    handPathMode: options.handPathMode ?? false,
  };
}

export function deriveBaseLayerKey(
  pictograph: PreparedPictographData,
  options: LayerRenderOptions
): string {
  const components = getBaseLayerComponents(pictograph, options);
  return `base:${hashComponents(components)}`;
}

export function getGridPointsLayerComponents(
  pictograph: PreparedPictographData,
  options: LayerRenderOptions
): GridPointsLayerKeyComponents {
  const prepared = pictograph._prepared;
  return {
    showNonRadialPoints: options.showNonRadialPoints,
    handPointVisibility: options.handPointVisibility,
    gridMode: prepared?.gridMode ?? "diamond",
    darkMode: options.darkMode,
    size: options.size,
  };
}

export function deriveGridPointsLayerKey(
  pictograph: PreparedPictographData,
  options: LayerRenderOptions
): string {
  const components = getGridPointsLayerComponents(pictograph, options);
  return `grid:${hashComponents(components)}`;
}

export function getTKALayerComponents(
  pictograph: PreparedPictographData,
  turnsTuple: string,
  options: Pick<LayerRenderOptions, "size" | "darkMode">
): TKALayerKeyComponents {
  return {
    letter: String(pictograph.letter ?? ""),
    turnsTuple,
    blueMotionType: pictograph.motions?.blue?.motionType ?? "",
    redMotionType: pictograph.motions?.red?.motionType ?? "",
    darkMode: options.darkMode,
    size: options.size,
  };
}

export function deriveTKALayerKey(
  pictograph: PreparedPictographData,
  turnsTuple: string,
  options: Pick<LayerRenderOptions, "size" | "darkMode">
): string {
  const components = getTKALayerComponents(pictograph, turnsTuple, options);
  return `tka:${hashComponents(components)}`;
}

export function getReversalLayerComponents(
  stepData: StepData,
  size: number
): ReversalLayerKeyComponents {
  return {
    blueReversal: stepData.blueReversal ?? false,
    redReversal: stepData.redReversal ?? false,
    size,
  };
}

export function deriveReversalLayerKey(stepData: StepData, size: number): string {
  const components = getReversalLayerComponents(stepData, size);
  return `rev:${components.blueReversal ? "b" : ""}${components.redReversal ? "r" : ""}_${size}`;
}

export function deriveBeatLayerKey(stepNumber: number, darkMode: boolean, size: number): string {
  return `beat:${stepNumber}_${darkMode ? "d" : "l"}_${size}`;
}

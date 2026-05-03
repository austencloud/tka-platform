/**
 * Arrow Rendering Service (Refactored)
 *
 * Orchestrates arrow rendering using focused microservices.
 *
 */

import type { MotionColor } from "../../../../shared/domain/enums/pictograph-enums";
import {
  MotionType,
  Orientation,
  RotationDirection,
} from "../../../../shared/domain/enums/pictograph-enums";
import type { ArrowSvgLoader } from "../implementations/ArrowSvgLoader";
import type { ArrowPathResolver } from "./ArrowPathResolver";
import type { ArrowSvgParser } from "./ArrowSvgParser";
import type { ArrowSvgColorTransformer } from "./ArrowSvgColorTransformer";

import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import { createMotionData } from "../../../../shared/domain/models/MotionData";
import type { ArrowPosition } from "../../../orchestration/domain/arrow-models";
import type { ArrowPlacementData } from "../../../positioning/placement/domain/ArrowPlacementData";

export class ArrowRenderer {
  constructor(
    private pathResolver: ArrowPathResolver,
    private svgParser: ArrowSvgParser,
    private colorTransformer: ArrowSvgColorTransformer,
    private svgLoader: ArrowSvgLoader
  ) {}

  /**
   * Render arrow at sophisticated calculated position using real SVG assets
   * Simple implementation without positioning service dependency
   */
  async renderArrowAtPosition(
    svg: SVGElement,
    color: MotionColor,
    position: ArrowPosition,
    motionData: MotionData | undefined
  ): Promise<void> {
    // Handle undefined motionData by creating a default one with the provided color
    const safeMotionData: MotionData =
      motionData ??
      createMotionData({
        color: color,
        motionType: MotionType.STATIC,
        rotationDirection: RotationDirection.NO_ROTATION,
        startLocation: GridLocation.NORTH,
        endLocation: GridLocation.NORTH,
        turns: 0,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        isVisible: true,
      });

    try {
      // Get the correct arrow SVG path
      const arrowSvgPath = this.pathResolver.getArrowSvgPath(safeMotionData);

      // Load the arrow SVG
      const response = await fetch(arrowSvgPath);
      if (!response.ok) {
        throw new Error(`Failed to load arrow SVG: ${response.status}`);
      }

      const svgContent = await response.text();

      // Create arrow group with metadata
      const arrowGroup = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );
      arrowGroup.setAttribute("class", `arrow-${color}`);
      arrowGroup.setAttribute("data-color", color);
      arrowGroup.setAttribute("data-position", `${position.x},${position.y}`);
      arrowGroup.setAttribute("data-rotation", position.rotation.toString());

      // Apply position and rotation transform
      const transform = `translate(${position.x}, ${position.y}) rotate(${position.rotation})`;
      arrowGroup.setAttribute("transform", transform);

      // Apply color transformation
      const coloredSvg = this.colorTransformer.applyColorToSvg(
        svgContent,
        color
      );
      arrowGroup.innerHTML = coloredSvg;

      // Add to parent SVG
      svg.appendChild(arrowGroup);
    } catch (error) {
      console.error("Failed to render arrow:", error);
      throw error;
    }
  }

  // Legacy methods for backward compatibility - delegate to microservices

  /**
   * Get arrow SVG path based on motion type and properties
   * Delegates to ArrowPathResolutionService
   */
  getArrowPath(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): string | null {
    return this.pathResolver.getArrowPath(arrowData, motionData);
  }

  /**
   * Parse SVG to get proper dimensions and center point
   * Delegates to SvgParser
   */
  parseArrowSvg(svgText: string): {
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  } {
    const parsed = this.svgParser.parseArrowSvg(svgText);

    // Convert string viewBox to object format
    let viewBox = { width: 100, height: 100 };
    if (typeof parsed.viewBox === "string") {
      const [width, height] = parsed.viewBox.split(" ").map(Number);
      viewBox = { width: width ?? 100, height: height ?? 100 };
    }

    return {
      viewBox,
      center: parsed.center ?? { x: 50, y: 50 },
    };
  }

  /**
   * Apply color transformation to SVG content
   * Delegates to SvgColorTransformer
   */
  applyColorToSvg(svgText: string, color: MotionColor): string {
    return this.colorTransformer.applyColorToSvg(svgText, color);
  }

  /**
   * Load arrow SVG data - delegates to SvgLoader
   */
  async loadArrowSvg(
    arrowData: ArrowPlacementData,
    motionData: MotionData
  ): Promise<{
    imageSrc: string;
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  }> {
    // Delegate to the existing SvgLoader which handles the real SVG loading
    const svgData = await this.svgLoader.loadArrowSvg(arrowData, motionData);

    // Convert ArrowSvgData format to the expected return format
    // Handle viewBox conversion from string to object
    let viewBox = { width: 100, height: 100 };
    if (typeof svgData.viewBox === "string") {
      const [width, height] = svgData.viewBox.split(" ").map(Number);
      viewBox = { width: width ?? 100, height: height ?? 100 };
    }

    return {
      imageSrc: svgData.imageSrc ?? "",
      viewBox,
      center: svgData.center ?? { x: 50, y: 50 },
    };
  }
}

// Direct singleton export for HMR-friendly imports
import { arrowPathResolver } from "./ArrowPathResolver";
import { arrowSvgParser } from "./ArrowSvgParser";
import { arrowSvgColorTransformer } from "./ArrowSvgColorTransformer";
import { arrowSvgLoader } from "./ArrowSvgLoader";

export const arrowRenderer = new ArrowRenderer(
  arrowPathResolver,
  arrowSvgParser,
  arrowSvgColorTransformer,
  arrowSvgLoader
);

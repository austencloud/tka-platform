/**
 * Pictograph Rendering Utilities
 *
 * Direct composition functions for rendering pictographs without orchestration service.
 * This replaces the PictographRenderer with explicit composition.
 */

import type { MotionColor } from "../domain/enums/pictograph-enums";
import { GridMode } from "../../grid/domain/enums/grid-enums";
import { container } from "../../../di";
import type { IArrowPositioningOrchestrator } from "../../arrow/positioning/services/contracts/IArrowPositioningOrchestrator";
import { gridModeDeriver } from "../../grid/services/implementations/GridModeDeriver";
import type { PictographData } from "../domain/models/PictographData";
import { Point } from "fabric";
// TODO: These services have been archived - need to refactor this file
// import type { IOverlayRenderer } from "../../../../features/animator/services/contracts/IOverlayRenderer";
// import type { ISvgUtilityService } from "../../../../features/animator/services/implementations/SvgUtilityService";
import type { ArrowPosition } from "../../arrow/orchestration/domain/arrow-models";
import type { IArrowRenderer } from "../../arrow/rendering/services/contracts/IArrowRenderer";
import type { IGridRenderer } from "../../grid/services/contracts/IGridRenderer";

// Archived services - using inline stub implementations
// These services were archived but the rendering utils still need them
const SVG_SIZE = 950;

const stubSvgUtility: {
  createBaseSVG(): SVGElement;
  createErrorSVG(message: string): SVGElement;
} = {
  createBaseSVG(): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
    svg.setAttribute("width", String(SVG_SIZE));
    svg.setAttribute("height", String(SVG_SIZE));
    return svg;
  },
  createErrorSVG(message: string): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${SVG_SIZE} ${SVG_SIZE}`);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "50%");
    text.setAttribute("y", "50%");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "red");
    text.textContent = message;
    svg.appendChild(text);
    return svg;
  }
};

const stubOverlayRenderer: {
  renderOverlays(svg: SVGElement, data: PictographData): Promise<void>;
  renderIdLabel(svg: SVGElement, data: PictographData): void;
  renderDebugInfo(svg: SVGElement, data: PictographData, positions: Map<string, ArrowPosition>): void;
} = {
  async renderOverlays(_svg: SVGElement, _data: PictographData): Promise<void> {
    // Stub - no overlays rendered
  },
  renderIdLabel(_svg: SVGElement, _data: PictographData): void {
    // Stub - no ID label rendered
  },
  renderDebugInfo(_svg: SVGElement, _data: PictographData, _positions: Map<string, ArrowPosition>): void {
    // Stub - no debug info rendered
  }
};

export async function renderPictograph(
  data: PictographData
): Promise<SVGElement> {
  try {
    // Use stub for archived services, resolve others from container
    const svgUtility = stubSvgUtility;
    const gridRendering = container.items.gridRenderer as IGridRenderer;
    const arrowRendering = container.items.arrowRenderer as IArrowRenderer;
    const overlayRendering = stubOverlayRenderer;

    // Get arrow positioning from container
    const arrowPositioning = container.items.arrowPositioningOrchestrator as IArrowPositioningOrchestrator;

    // Create base SVG
    const svg = svgUtility.createBaseSVG();

    // Determine grid mode (using direct import instead of container)
    const gridMode: GridMode =
      data.motions.blue && data.motions.red
        ? gridModeDeriver.deriveGridMode(data.motions.blue, data.motions.red)
        : GridMode.DIAMOND;

    // Render grid
    await gridRendering.renderGrid(svg, gridMode);

    // Calculate arrow positions
    const updatedPictographData =
      await arrowPositioning.calculateAllArrowPoints(data);

    // Render arrows
    if (updatedPictographData.motions) {
      for (const [color, motionData] of Object.entries(
        updatedPictographData.motions
      )) {
        if (!motionData) continue;
        if (motionData.isVisible && motionData.arrowPlacementData) {
          const position = Object.assign(
            new Point(
              motionData.arrowPlacementData.positionX,
              motionData.arrowPlacementData.positionY
            ),
            { rotation: motionData.arrowPlacementData.rotationAngle }
          );
          await arrowRendering.renderArrowAtPosition(
            svg,
            color as MotionColor,
            position,
            motionData
          );
        }
      }
    }

    // Render overlays
    await overlayRendering.renderOverlays(svg, data);
    overlayRendering.renderIdLabel(svg, data);

    // Render debug info
    const arrowPositions = new Map<string, ArrowPosition>();
    if (updatedPictographData.motions) {
      for (const [color, motionData] of Object.entries(
        updatedPictographData.motions
      )) {
        if (!motionData) continue;
        if (motionData.isVisible && motionData.arrowPlacementData) {
          const arrowPosition = Object.assign(
            new Point(
              motionData.arrowPlacementData.positionX,
              motionData.arrowPlacementData.positionY
            ),
            { rotation: motionData.arrowPlacementData.rotationAngle }
          );
          arrowPositions.set(color, arrowPosition);
        }
      }
    }
    overlayRendering.renderDebugInfo(svg, data, arrowPositions);

    return svg;
  } catch (error) {
    console.error("❌ Error rendering pictograph:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return stubSvgUtility.createErrorSVG(errorMessage);
  }
}

/**
 * Batch render multiple pictographs
 */
export async function renderPictographs(
  dataArray: PictographData[]
): Promise<SVGElement[]> {
  const promises = dataArray.map((data) => renderPictograph(data));
  return Promise.all(promises);
}

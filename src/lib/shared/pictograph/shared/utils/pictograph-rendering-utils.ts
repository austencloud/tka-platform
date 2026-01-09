/**
 * Pictograph Rendering Utilities
 *
 * Direct composition functions for rendering pictographs without orchestration service.
 * This replaces the PictographRenderer with explicit composition.
 */

import type { MotionColor } from "../domain/enums/pictograph-enums";
import { GridMode } from "../../grid/domain/enums/grid-enums";
import { resolve } from "../../../inversify/resolve-utils";
import { TYPES } from "../../../inversify/types";
import type { IArrowPositioningOrchestrator } from "../../arrow/positioning/services/contracts/IArrowPositioningOrchestrator";
import type { IGridModeDeriver } from "../../grid/services/contracts/IGridModeDeriver";
import type { PictographData } from "../domain/models/PictographData";
import { Point } from "fabric";
// TODO: These services have been archived - need to refactor this file
// import type { IOverlayRenderer } from "../../../../features/animator/services/contracts/IOverlayRenderer";
// import type { ISvgUtilityService } from "../../../../features/animator/services/implementations/SvgUtilityService";
import type { ArrowPosition } from "../../arrow/orchestration/domain/arrow-models";
import type { IArrowRenderer } from "../../arrow/rendering/services/contracts/IArrowRenderer";
import type { IGridRenderer } from "../../grid/services/contracts/IGridRenderer";

// TODO: These services are archived - defining minimal interfaces for compilation
interface ISvgUtilityService {
  createBaseSVG(): SVGElement;
  createErrorSVG(message: string): SVGElement;
}

interface IOverlayRenderer {
  renderOverlays(svg: SVGElement, data: PictographData): Promise<void>;
  renderIdLabel(svg: SVGElement, data: PictographData): void;
  renderDebugInfo(
    svg: SVGElement,
    data: PictographData,
    positions: Map<string, ArrowPosition>
  ): void;
}

export async function renderPictograph(
  data: PictographData
): Promise<SVGElement> {
  try {

    // Resolve required services directly
    const svgUtility = resolve<ISvgUtilityService>(TYPES.ISvgUtilityService);
    const gridRendering = resolve<IGridRenderer>(TYPES.IGridRenderer);
    const arrowRendering = resolve<IArrowRenderer>(TYPES.IArrowRenderer);
    const overlayRendering = resolve<IOverlayRenderer>(TYPES.IOverlayRenderer);
    const gridModeService = resolve<IGridModeDeriver>(TYPES.IGridModeDeriver);

    // Get arrow positioning from InversifyJS container
    const arrowPositioning: IArrowPositioningOrchestrator = resolve(
      TYPES.IArrowPositioningOrchestrator
    );

    // Create base SVG
    const svg = svgUtility.createBaseSVG();

    // Determine grid mode
    const gridMode: GridMode =
      data.motions.blue && data.motions.red
        ? gridModeService.deriveGridMode(data.motions.blue, data.motions.red)
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
    const svgUtility = resolve<ISvgUtilityService>(TYPES.ISvgUtilityService);
    return svgUtility.createErrorSVG(errorMessage);
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

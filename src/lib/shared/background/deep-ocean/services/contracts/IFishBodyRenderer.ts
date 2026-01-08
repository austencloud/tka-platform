import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { Point } from "../../physics/BodyOutlineCalculator";

/**
 * Renders fish body shapes (spine-based and legacy Bezier).
 */
export interface IFishBodyRenderer {
  /**
   * Draw spine-based fish body from calculated outline
   */
  drawSpineBody(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void;

  /**
   * Draw legacy Bezier fish body
   */
  drawBody(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void;
}

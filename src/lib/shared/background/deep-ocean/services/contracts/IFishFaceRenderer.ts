import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";

/**
 * Renders fish facial features (eyes, gills).
 */
export interface IFishFaceRenderer {
  /**
   * Draw eye on spine-based fish
   */
  drawSpineEye(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void;

  /**
   * Draw gill slit on spine-based fish
   */
  drawSpineGill(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void;

  /**
   * Draw eye on legacy Bezier fish
   */
  drawEye(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void;

  /**
   * Draw gill slit on legacy Bezier fish
   */
  drawGill(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void;
}

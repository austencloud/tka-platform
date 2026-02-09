/**
 * IWorkerRenderPool
 *
 * Manages a pool of Web Workers for off-main-thread pictograph rendering.
 * Falls back to main-thread rendering when Web Workers or OffscreenCanvas
 * are unavailable.
 */

import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { LayerRenderOptions, LayerVisibility } from "./ILayerCompositor";

export interface IWorkerRenderPool {
  /**
   * Render a prepared pictograph off-thread and return the result as a Blob.
   *
   * On cache miss, this sends the prepared data to a Web Worker which
   * renders it using OffscreenCanvas and returns the PNG blob.
   *
   * Falls back to main-thread rendering if workers are unavailable.
   */
  render(
    preparedData: PreparedPictographData,
    options: LayerRenderOptions,
    visibility: LayerVisibility,
    stepNumber?: number
  ): Promise<Blob>;

  /**
   * Terminate all workers and clean up resources.
   */
  terminate(): void;

  /**
   * Whether the pool is using actual Web Workers or falling back to main thread.
   */
  isUsingWorkers(): boolean;
}

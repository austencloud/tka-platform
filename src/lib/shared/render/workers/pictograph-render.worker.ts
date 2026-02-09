/**
 * Pictograph Render Worker
 *
 * Offloads pictograph rendering to a Web Worker using OffscreenCanvas.
 * Each worker instance maintains its own SvgAssetLoader and LayerCompositor
 * with independent caches (no shared memory with main thread).
 *
 * Message protocol:
 * - Main → Worker: { type: "init" } | { type: "render", id, ... }
 * - Worker → Main: { type: "init-done" } | { type: "render-result", id, blob } | { type: "error", id, message }
 */

import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { LayerRenderOptions, LayerVisibility } from "../services/contracts/ILayerCompositor";
import { LayerCompositor } from "../services/implementations/LayerCompositor";
import { SvgAssetLoader } from "../services/implementations/SvgAssetLoader";

// ============ Message Types ============

export interface InitMessage {
  type: "init";
}

export interface RenderMessage {
  type: "render";
  id: number;
  preparedData: PreparedPictographData;
  options: LayerRenderOptions;
  visibility: LayerVisibility;
  stepNumber?: number;
}

export type WorkerInMessage = InitMessage | RenderMessage;

export interface InitDoneMessage {
  type: "init-done";
}

export interface RenderResultMessage {
  type: "render-result";
  id: number;
  blob: Blob;
}

export interface ErrorMessage {
  type: "error";
  id: number;
  message: string;
}

export type WorkerOutMessage = InitDoneMessage | RenderResultMessage | ErrorMessage;

// ============ Worker State ============

let compositor: LayerCompositor | null = null;
let assetLoader: SvgAssetLoader | null = null;
let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (compositor && assetLoader?.isInitialized()) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = doInitialize();
  await initPromise;
}

async function doInitialize(): Promise<void> {
  assetLoader = new SvgAssetLoader();
  await assetLoader.initialize();
  compositor = new LayerCompositor();
}

// ============ Message Handler ============

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      try {
        await ensureInitialized();
        const response: InitDoneMessage = { type: "init-done" };
        self.postMessage(response);
      } catch (error) {
        const response: ErrorMessage = {
          type: "error",
          id: -1,
          message: `Init failed: ${error instanceof Error ? error.message : String(error)}`,
        };
        self.postMessage(response);
      }
      break;
    }

    case "render": {
      try {
        await ensureInitialized();

        const result = await compositor!.compose(
          msg.preparedData,
          msg.options,
          msg.visibility,
          msg.stepNumber
        );

        // Convert the composed canvas to a blob
        // result.canvas is OffscreenCanvas in worker context
        const canvas = result.canvas as OffscreenCanvas;
        const blob = await canvas.convertToBlob({ type: "image/png" });

        const response: RenderResultMessage = {
          type: "render-result",
          id: msg.id,
          blob,
        };
        self.postMessage(response);
      } catch (error) {
        const response: ErrorMessage = {
          type: "error",
          id: msg.id,
          message: `Render failed: ${error instanceof Error ? error.message : String(error)}`,
        };
        self.postMessage(response);
      }
      break;
    }
  }
};

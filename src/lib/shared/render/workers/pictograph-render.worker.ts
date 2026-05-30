import type { PreparedPictographData } from "../../pictograph/shared/domain/models/PreparedPictographData";
import type { LayerRenderOptions, LayerVisibility } from "../services/types";
import { LayerCompositor } from "../services/layer-compositor";
import { seedCachesFromBundle, type AssetBundle } from "../services/card-asset-bundle";
import { paintFrontJob } from "../services/paint-front-job";
import { SeededGlyphSource } from "../services/glyph-bitmap-seed";
import type { FrontJob } from "../services/front-job";

export interface InitMessage {
  type: "init";
}

export interface SeedMessage {
  type: "seed";
  bundle: AssetBundle;
}

export interface RenderMessage {
  type: "render";
  id: number;
  preparedData: PreparedPictographData;
  options: LayerRenderOptions;
  visibility: LayerVisibility;
  stepNumber?: number;
}

export interface PaintFrontMessage {
  type: "paint-front";
  id: number;
  job: FrontJob;
}

export type WorkerInMessage = InitMessage | SeedMessage | RenderMessage | PaintFrontMessage;

export interface InitDoneMessage {
  type: "init-done";
}

export interface SeedDoneMessage {
  type: "seed-done";
}

export interface RenderResultMessage {
  type: "render-result";
  id: number;
  blob: Blob;
}

export interface FrontResultMessage {
  type: "front-result";
  id: number;
  bitmap: ImageBitmap;
}

export interface ErrorMessage {
  type: "error";
  id: number;
  message: string;
}

export type WorkerOutMessage =
  | InitDoneMessage
  | SeedDoneMessage
  | RenderResultMessage
  | FrontResultMessage
  | ErrorMessage;

let compositor: LayerCompositor | null = null;
// Captured on "seed": the per-deck glyph bitmaps the worker hands to
// paintFrontJob so the card header can render the TKA word without touching the
// $env-coupled glyph cache. Null until the first successful seed.
let seededGlyphSource: SeededGlyphSource | null = null;

function ensureCompositor(): LayerCompositor {
  if (!compositor) compositor = new LayerCompositor();
  return compositor;
}

/** postMessage wrapper that threads an optional transfer list (ImageBitmaps). */
function post(message: WorkerOutMessage, transfer?: Transferable[]): void {
  if (transfer && transfer.length) self.postMessage(message, transfer);
  else self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      // No fetch/decode here — the worker is fed pre-decoded SVGs via "seed".
      // (In-worker createImageBitmap(svgBlob) fails on the app's SVGs.)
      ensureCompositor();
      self.postMessage({ type: "init-done" } satisfies InitDoneMessage);
      break;
    }

    case "seed": {
      try {
        ensureCompositor();
        // Populates the worker's singleton svgCache + svgAssetLoader with every
        // prop/arrow/letter/turn/grid decoded on the main thread. seedGrids also
        // marks the asset loader initialized, so LayerCompositor →
        // Canvas2DDirectRenderer.initialize() won't try to fetch in the worker.
        // Capture the returned SeededGlyphSource so the paint-front handler can
        // hand the deck's header glyphs to paintFrontJob.
        seededGlyphSource = seedCachesFromBundle(msg.bundle);
        self.postMessage({ type: "seed-done" } satisfies SeedDoneMessage);
      } catch (error) {
        self.postMessage({
          type: "error",
          id: -1,
          message: `Seed failed: ${error instanceof Error ? error.message : String(error)}`,
        } satisfies ErrorMessage);
      }
      break;
    }

    case "render": {
      try {
        const result = await ensureCompositor().compose(
          msg.preparedData,
          msg.options,
          msg.visibility,
          msg.stepNumber,
        );

        const canvas = result.canvas as OffscreenCanvas;
        const blob = await canvas.convertToBlob({ type: "image/png" });

        self.postMessage({
          type: "render-result",
          id: msg.id,
          blob,
        } satisfies RenderResultMessage);
      } catch (error) {
        self.postMessage({
          type: "error",
          id: msg.id,
          message: `Render failed: ${error instanceof Error ? error.message : String(error)}`,
        } satisfies ErrorMessage);
      }
      break;
    }

    case "paint-front": {
      try {
        // Unseeded → empty glyph source: the header simply won't draw glyphs
        // rather than crashing the whole card render.
        const glyphSource = seededGlyphSource ?? new SeededGlyphSource();
        const canvas = await paintFrontJob(msg.job, glyphSource);
        const bitmap = canvas.transferToImageBitmap();
        // TRANSFER the bitmap (zero-copy) back to the pool.
        post({ type: "front-result", id: msg.id, bitmap }, [bitmap]);
      } catch (error) {
        post({
          type: "error",
          id: msg.id,
          message: `Paint front failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      break;
    }
  }
};

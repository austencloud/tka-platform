/**
 * bake-motion.ts
 *
 * Browser-only bake helper. Drives Canvas2DAnimationRenderer (the live
 * AnimatorCanvas renderer) frame by frame and feeds each frame to
 * VideoExporter (WebCodecs H.264). Output is pixel-identical to the
 * live demo. Dev-bake use only — NOT unit-testable in jsdom.
 */

import { Canvas2DAnimationRenderer } from "$lib/shared/animation-engine/services/implementations/Canvas2DAnimationRenderer";
import { getSequenceAnimationOrchestrator } from "$lib/shared/animation-engine/getSequenceAnimationOrchestrator";
import { getVideoExporter } from "$lib/shared/animation-engine/getVideoExporter";
import {
  generateBluePropSvg,
  generateRedPropSvg,
} from "$lib/shared/animation-engine/services/svg-generator";
import { DEFAULT_TRAIL_SETTINGS } from "$lib/shared/animation-engine/domain/types/TrailTypes";
import {
  buildGuideMotionSequence,
  type GuideMotionConfig,
} from "../../(public)/guide/level-1/_components/guide-motion-configs";

export interface BakeMotionOptions {
  /** Canvas size in pixels (square). Default: 512 */
  size?: number;
  /** Frames per second. Default: 30 */
  fps?: number;
}

/** Wait for two paint cycles so the canvas is fully painted before capture. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

/**
 * Bake a single GuideMotionConfig to an H.264 mp4 Blob.
 *
 * The returned Blob is pixel-identical to the live animated demo because it
 * uses the same Canvas2DAnimationRenderer → VideoExporter pipeline.
 */
export async function bakeGuideMotion(
  config: GuideMotionConfig,
  options: BakeMotionOptions = {}
): Promise<Blob> {
  const size = options.size ?? 512;
  const fps = options.fps ?? 30;
  const sequence = buildGuideMotionSequence(config);

  // Off-screen container: in the DOM (required for canvas rendering) but
  // invisible and non-interactive.
  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;opacity:0;pointer-events:none;z-index:-9999;`;
  document.body.appendChild(container);

  const renderer = new Canvas2DAnimationRenderer();
  const exporter = getVideoExporter();
  let manual: Awaited<ReturnType<typeof exporter.createManualExporter>> | null =
    null;

  try {
    // ── Renderer setup ────────────────────────────────────────────────────
    await renderer.initialize(container, size, 1, true);
    renderer.setDarkMode(true, false);

    await Promise.all([
      renderer.loadGridTexture("diamond", false),
      renderer.loadPerColorPropTextures("hand", "hand", true),
    ]);

    // Prop dimensions come from the same SVG generator used by the live renderer.
    const [bluePropData, redPropData] = await Promise.all([
      generateBluePropSvg("hand", true),
      generateRedPropSvg("hand", true),
    ]);
    const bluePropDimensions = {
      width: bluePropData.width,
      height: bluePropData.height,
    };
    const redPropDimensions = {
      width: redPropData.width,
      height: redPropData.height,
    };

    // ── Orchestrator ──────────────────────────────────────────────────────
    const orchestrator = getSequenceAnimationOrchestrator();
    if (!orchestrator.initializeWithDomainData(sequence)) {
      throw new Error(`Orchestrator init failed for config "${config.id}"`);
    }

    const canvas = renderer.getCanvas();
    if (!canvas) throw new Error(`No canvas available for config "${config.id}"`);

    // ── Manual video exporter (WebCodecs H.264 / WASM fallback) ──────────
    manual = await exporter.createManualExporter(size, size, {
      format: "mp4",
      fps,
      autoDownload: false,
    });

    // ── Frame loop ────────────────────────────────────────────────────────
    // Trails are disabled; hoist the settings clone so we don't allocate per frame.
    const trailSettings = { ...DEFAULT_TRAIL_SETTINGS };
    const totalSteps = sequence.steps.length || 1;
    const totalFrames = Math.ceil(totalSteps * fps);

    // Inclusive bound: frameIndex runs 0..totalFrames, so the final frame sits at
    // playbackPosition === 1.0 (the end pose). For a single STATIC/looping step the
    // end pose equals the start pose, so this intentionally encodes one duplicate
    // frame at the seam — <video loop> snaps end→start onto an identical frame for a
    // jitter-free loop. The extra frame is ~3% of a sub-100KB clip. Mirrors VideoPreRenderer.
    for (let frameIndex = 0; frameIndex <= totalFrames; frameIndex++) {
      const playbackPosition = frameIndex / fps;

      orchestrator.calculateState(playbackPosition);

      renderer.renderScene({
        blueProp: orchestrator.getBluePropState(),
        redProp: orchestrator.getRedPropState(),
        gridVisible: true,
        gridMode: "diamond",
        letter: null,
        turnsTuple: null,
        bluePropDimensions,
        redPropDimensions,
        blueTrailPoints: [],
        redTrailPoints: [],
        trailSettings,
        currentTime: performance.now(),
        visibility: {
          gridVisible: true,
          propsVisible: true,
          trailsVisible: false,
          blueMotionVisible: config.showBlue,
          redMotionVisible: true,
        },
        bluePropFlipped: false,
        redPropFlipped: false,
        bluePropType: "hand",
        redPropType: "hand",
      });

      // Double rAF: let the canvas paint before the frame is captured.
      await nextPaint();
      await manual.addFrame(canvas);
    }

    return await manual.finish();
  } catch (error) {
    // cancel() is idempotent — safe even if addFrame/finish already cancelled internally.
    manual?.cancel();
    throw error;
  } finally {
    renderer.destroy();
    container.remove();
  }
}

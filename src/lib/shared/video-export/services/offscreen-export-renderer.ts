/**
 * Offscreen Export Renderer
 *
 * Owns a fresh headless AnimationEngine for ONE export and renders each frame
 * deterministically. Replaces live-engine-capture: instead of scraping whatever
 * the on-screen engine happens to be showing, we drive a clean offscreen engine
 * frame-by-frame at a fixed virtual clock.
 *
 * Two things make the trail match live density without live's rAF jitter:
 *  1. Sub-stepping — between the previous beat position and the current one we
 *     over-sample N intermediate prop states (via the PURE sampler) and feed each
 *     into the offscreen trail capturer. The capturer's 0.75px distance-gate then
 *     prunes that over-sampling back to exact live density.
 *  2. The capturer config (canvasSize, prop types, loopability) is primed up front
 *     so the very first sub-step lands at the right resolution.
 */

import {
  RenderContextFactory,
  type OffscreenContextHandle,
} from "$lib/shared/animation-engine/services/render-context-factory";
import {
  assembleExportEngineProps,
  type ExportFrameContext,
} from "./export-engine-props";
import { computeTrailSubSteps } from "./export-substep";
import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

export interface OffscreenExportInit {
  /** Square canvas size (px) for the offscreen engine. */
  outputCanvasSize: number;
  /** Export frame rate; sets dtSeconds = 1/fps for the fluid sim. */
  fps: number;
  /** When true, run synchronous warmup renders so the fluid sim (fire/charcoal) converges. */
  needsFluidWarmup: boolean;
  /** Resolved prop types (e.g. "staff"). Thread into frame ctx + trail capture config. */
  bluePropType: string | null;
  redPropType: string | null;
}

/** Synchronous render passes to converge the fluid sim before capture starts. */
const FLUID_WARMUP_FRAMES = 60;

export class OffscreenExportRenderer {
  private handle: OffscreenContextHandle | null = null;
  private dtSeconds = 0;
  private prevBeatPos: number | null = null;
  private init!: OffscreenExportInit;

  constructor(
    private readonly playback: AnimationPlaybackController,
    private readonly panelState: AnimationPanelState,
  ) {}

  async initialize(init: OffscreenExportInit): Promise<void> {
    this.init = init;
    this.dtSeconds = 1 / init.fps;
    // Hand the offscreen engine the SAME visibility manager + effects config the
    // export already configured (applyEffectOverrides set the active effect, e.g.
    // trails/fire, on the global VM). Without this the offscreen engine renders
    // props but NO effect overlay — captured trail points would go nowhere.
    const vm = getAnimationVisibilityManager();
    this.handle = await new RenderContextFactory().createOffscreenContext(
      init.outputCanvasSize,
      { visibilityManager: vm, effectsConfigState: vm.effectsConfigState },
    );

    // Prime the capturer config so the FIRST sub-step capture lands at the right
    // resolution + prop geometry. Without this, the first frame's sub-steps run
    // before renderFrame's PlaybackSync configures the capturer, so they'd capture
    // at the default 500px size with no prop type. canvasSize is already seeded on
    // the engine via setInitialCanvasSize; mirror it onto the capturer here.
    this.handle.context.trailCapturer.updateConfig({
      canvasSize: init.outputCanvasSize,
      bluePropType: init.bluePropType,
      redPropType: init.redPropType,
      trailSettings: animationSettings.trail,
      isSeamlesslyLoopable: this.playback.isSeamlesslyLoopable,
    });

    if (init.needsFluidWarmup) {
      // Deterministic warmup: render the start position repeatedly so the fluid
      // sim reaches steady state, then discard the warmup trail so it doesn't
      // bleed into frame 0.
      for (let w = 0; w < FLUID_WARMUP_FRAMES; w++) {
        this.renderAt(0, 0);
      }
      this.handle.context.trailCapturer.clearTrails();
      this.prevBeatPos = null;
    }
  }

  /** The offscreen engine canvas for the compositor to read. */
  get canvas(): HTMLCanvasElement {
    if (!this.handle) {
      throw new Error("OffscreenExportRenderer not initialized");
    }
    return this.handle.context.canvas;
  }

  /** Render one export frame at `beatPos` with the given virtual clock (ms). */
  renderFrame(beatPos: number, virtualTimeMs: number): void {
    this.renderAt(beatPos, virtualTimeMs);
  }

  private renderAt(beatPos: number, virtualTimeMs: number): void {
    if (!this.handle) {
      throw new Error("OffscreenExportRenderer not initialized");
    }
    const trailCapturer = this.handle.context.trailCapturer;

    // 1) Sub-step trail capture: walk from the previous beat to this one, sampling
    // N intermediate prop states and feeding each into the capturer. The capturer's
    // distance-gate prunes the over-sampling to live density. Skip when there's no
    // prior position (first frame / post-warmup) or no movement.
    if (this.prevBeatPos !== null && this.prevBeatPos !== beatPos) {
      const prev = this.prevBeatPos;
      const span = beatPos - prev;
      const n = computeTrailSubSteps(span);
      for (let k = 1; k <= n; k++) {
        const subPos = prev + span * (k / n);
        const sampled = this.playback.samplePropStateAt(subPos);
        trailCapturer.captureFrame(
          { blueProp: sampled.blue, redProp: sampled.red },
          Math.floor(subPos),
          virtualTimeMs,
        );
      }
    }
    this.prevBeatPos = beatPos;

    // 2) Render the final frame at the beat position. calculateStateForStep drives
    // the panel state's prop states, which assembleExportEngineProps reads.
    this.playback.calculateStateForStep(beatPos);

    const frameCtx: ExportFrameContext = {
      virtualTime: virtualTimeMs,
      isSeamlesslyLoopable: this.playback.isSeamlesslyLoopable,
      backgroundAlpha: 1,
      showNonRadialPoints: true,
      trailSettings: animationSettings.trail,
      bluePropType: this.init.bluePropType,
      redPropType: this.init.redPropType,
      previewDarkMode: null,
    };

    this.handle.engine.renderFrame(
      assembleExportEngineProps(this.panelState, frameCtx),
      virtualTimeMs,
      this.dtSeconds,
    );
  }

  dispose(): void {
    this.handle?.dispose();
    this.handle = null;
  }
}

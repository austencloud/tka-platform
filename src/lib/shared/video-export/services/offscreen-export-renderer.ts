/**
 * Offscreen Export Renderer
 *
 * Owns a fresh headless AnimationEngine for ONE export and renders each frame
 * deterministically. Replaces live-engine-capture: instead of scraping whatever
 * the on-screen engine happens to be showing, we drive a clean offscreen engine
 * at a fixed virtual clock.
 *
 * ── Why a fixed 60fps internal timestep ────────────────────────────────────────
 * The WebGL2 trail overlay captures ONE ring point per engine render and its
 * visible length = `tailLength` ring segments × the prop movement per render.
 * It also advances tail recession by the render's dt. So the trail's spatial
 * length is a function of the RENDER CADENCE, not of wall-clock or beat time:
 * render the overlay once per (coarse) export frame and every segment is longer,
 * so the trail reads longer than the live animation, which free-runs at ~60fps.
 *
 * The live animation the user is matching runs at 60fps (the design reference).
 * So we simulate the engine at a FIXED 60fps internal timestep regardless of the
 * export frame rate, and composite whatever the last sub-step painted. A standard
 * fixed-timestep accumulator carries the sub-step remainder across export frames,
 * so the trail/fire cadence is exactly 60fps for any export fps. At the default
 * 60fps export this is a 1:1 passthrough (one sub-step per frame, byte-for-byte
 * the live cadence); at 30fps each export frame drains two 60fps sub-steps; etc.
 *
 * Determinism: the timestep is fixed and the beat is linearly interpolated by
 * time within each export frame, so the same machine reproduces the same frames.
 */

import {
  RenderContextFactory,
  type OffscreenContextHandle,
} from "$lib/shared/animation-engine/services/render-context-factory";
import {
  assembleExportEngineProps,
  type ExportFrameContext,
} from "./export-engine-props";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { animationSettings } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import type { AnimationPanelState } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
import type { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

export interface OffscreenExportInit {
  /** Square canvas size (px) for the offscreen engine. */
  outputCanvasSize: number;
  /** Export frame rate; the visible frames are sampled from the 60fps internal sim at 1/fps. */
  fps: number;
  /** When true, run synchronous warmup renders so the fluid sim (fire/charcoal) converges. */
  needsFluidWarmup: boolean;
  /** Resolved prop types (e.g. "staff"). Thread into frame ctx + trail capture config. */
  bluePropType: string | null;
  redPropType: string | null;
  /** Dark-mode override for prop colors + grid tint. null → engine boot value. */
  previewDarkMode: boolean | null;
  /** Whether to draw non-radial grid points (matches the live grid). */
  showNonRadialPoints: boolean;
}

/** Synchronous render passes to converge the fluid sim before capture starts. */
const FLUID_WARMUP_FRAMES = 60;

/**
 * Fixed internal simulation timestep. The live animation runs at 60fps and the
 * trail length / fire sim are cadence-dependent, so the offscreen engine steps
 * at exactly this rate to reproduce the live look at any export fps.
 */
const REFERENCE_STEP_MS = 1000 / 60;
const REFERENCE_STEP_S = 1 / 60;

export class OffscreenExportRenderer {
  private handle: OffscreenContextHandle | null = null;
  private init!: OffscreenExportInit;

  // Fixed-timestep clock. `internalClockMs` is the engine's virtual clock (drives
  // the overlay's dt and the fluid sim); `accumulatorMs` carries the unsimulated
  // remainder between export frames so the 60fps cadence stays exact.
  private internalClockMs = 0;
  private accumulatorMs = 0;
  private prevBeatPos: number | null = null;
  private prevTargetMs = 0;

  constructor(
    private readonly playback: AnimationPlaybackController,
    private readonly panelState: AnimationPanelState,
  ) {}

  async initialize(init: OffscreenExportInit): Promise<void> {
    this.init = init;
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
    // resolution + prop geometry. (The WebGL2 overlay keeps its own ring; this
    // feeds the canvas2D fallback path consistently.)
    this.handle.context.trailCapturer.updateConfig({
      canvasSize: init.outputCanvasSize,
      bluePropType: init.bluePropType,
      redPropType: init.redPropType,
      trailSettings: animationSettings.trail,
      isSeamlesslyLoopable: this.playback.isSeamlesslyLoopable,
    });

    // Load the sequence's grid texture. The renderer draws whatever grid IMAGE is
    // currently loaded (canvas-2d-animation-renderer getGridImage); that texture
    // is normally loaded by PlaybackSync.loadGridTexture on gridMode change. The
    // offscreen engine is driven only through renderFrame, which bypasses
    // PlaybackSync — so without this the renderer keeps its default "diamond"
    // texture and a box-mode sequence exports with a diamond grid.
    const gridMode =
      this.panelState.sequenceData?.gridMode ?? GridMode.DIAMOND;
    await this.handle.context.renderer.loadGridTexture(gridMode, init.showNonRadialPoints);

    // Thread the resolved prop types into the offscreen engine's STATE before the
    // frame loop. The renderer skips drawing a prop whose image is null
    // (canvas-2d-animation-renderer getBluePropImage), so the prop image must be
    // loaded — but loading the image alone is not enough: frame-parameter-builder
    // reads the prop TYPE from state.currentBluePropType/RedPropType
    // (frame-parameter-builder.ts:227-228,244-245) and the prop DIMENSIONS from
    // state.bluePropDimensions/redPropDimensions (frame-parameter-builder.ts:209-210).
    // The offscreen engine is driven only through renderFrame(), which bypasses
    // PlaybackSync — so those state fields are never synced and stay at the boot
    // default ("staff", staff dimensions). A bare renderer.loadPerColorPropTextures()
    // loaded the image but left the type/dimension desync, so a non-staff export
    // drew the staff body at staff size. prepareExportPropTypes runs the canonical
    // override path (sets state types + loads textures + syncs dimensions to state).
    // "staff" is the floor so a missing type still draws.
    const darkMode = init.previewDarkMode ?? vm.isDarkMode();
    const blue = init.bluePropType ?? "staff";
    const red = init.redPropType ?? "staff";
    await this.handle.engine.prepareExportPropTypes(blue, red, darkMode);

    if (init.needsFluidWarmup) {
      // Deterministic warmup: render the start position repeatedly so the fluid
      // sim reaches steady state, then discard the warmup trail so it doesn't
      // bleed into frame 0. Stationary at beat 0 + constant clock ⇒ no trail
      // stamps accumulate (the overlay's duplicate-timestamp guard).
      for (let w = 0; w < FLUID_WARMUP_FRAMES; w++) {
        this.renderSubStep(0, 0, REFERENCE_STEP_S);
      }
      this.handle.context.trailCapturer.clearTrails();
      this.resetClock();
    }
  }

  /** The offscreen engine canvas for the compositor to read. */
  get canvas(): HTMLCanvasElement {
    if (!this.handle) {
      throw new Error("OffscreenExportRenderer not initialized");
    }
    return this.handle.context.canvas;
  }

  /** Render one export frame at `beatPos` with the export-frame virtual clock (ms). */
  renderFrame(beatPos: number, virtualTimeMs: number): void {
    this.renderAt(beatPos, virtualTimeMs);
  }

  private resetClock(): void {
    this.internalClockMs = 0;
    this.accumulatorMs = 0;
    this.prevBeatPos = null;
    this.prevTargetMs = 0;
  }

  /**
   * Drain fixed 60fps sub-steps up to this export frame's target time, then leave
   * the canvas holding the last sub-step. The beat is interpolated linearly by
   * time across the export frame so each 60fps sub-step lands at the right spot.
   */
  private renderAt(beatPos: number, targetTimeMs: number): void {
    if (!this.handle) {
      throw new Error("OffscreenExportRenderer not initialized");
    }

    const prevBeat = this.prevBeatPos ?? beatPos;
    const spanMs = Math.max(0, targetTimeMs - this.prevTargetMs);
    const beatAt = (clockMs: number): number => {
      if (spanMs <= 0) return beatPos;
      const frac = Math.min(1, Math.max(0, (clockMs - this.prevTargetMs) / spanMs));
      return prevBeat + (beatPos - prevBeat) * frac;
    };

    this.accumulatorMs += spanMs;

    let stepped = false;
    while (this.accumulatorMs >= REFERENCE_STEP_MS) {
      this.internalClockMs += REFERENCE_STEP_MS;
      this.accumulatorMs -= REFERENCE_STEP_MS;
      this.renderSubStep(beatAt(this.internalClockMs), this.internalClockMs, REFERENCE_STEP_S);
      stepped = true;
    }

    // Guarantee one paint per export frame. Hit only when the export fps exceeds
    // 60 (sub-step span < one 60fps step) or on the first/stationary frame: repaint
    // at the exact target so the composited canvas is current. dt is the small real
    // span so trail/fire stay consistent.
    if (!stepped) {
      this.internalClockMs = this.prevTargetMs + spanMs;
      const dtSec = spanMs > 0 ? spanMs / 1000 : REFERENCE_STEP_S;
      this.renderSubStep(beatPos, this.internalClockMs, dtSec);
      this.accumulatorMs = 0;
    }

    this.prevBeatPos = beatPos;
    this.prevTargetMs = targetTimeMs;
  }

  /**
   * One engine render at a beat position + virtual clock. Sets the panel prop
   * states (calculateStateForStep), feeds the trail capturer, then renders the
   * frame synchronously with the explicit dt that drives the overlay tail
   * recession + fluid sim.
   */
  private renderSubStep(beat: number, clockMs: number, dtSeconds: number): void {
    const handle = this.handle!;
    this.playback.calculateStateForStep(beat);

    const frameCtx: ExportFrameContext = {
      virtualTime: clockMs,
      isSeamlesslyLoopable: this.playback.isSeamlesslyLoopable,
      backgroundAlpha: 1,
      showNonRadialPoints: this.init.showNonRadialPoints,
      trailSettings: animationSettings.trail,
      bluePropType: this.init.bluePropType,
      redPropType: this.init.redPropType,
      previewDarkMode: this.init.previewDarkMode,
    };
    const props = assembleExportEngineProps(this.panelState, frameCtx);

    // Feed the capturer at the same cadence the WebGL2 overlay captures its own
    // ring, so the canvas2D fallback path (if ever active) stays consistent.
    handle.context.trailCapturer.captureFrame(
      { blueProp: props.blueProp, redProp: props.redProp },
      Math.floor(beat),
      clockMs,
    );

    handle.engine.renderFrame(props, clockMs, dtSeconds);
  }

  dispose(): void {
    this.handle?.dispose();
    this.handle = null;
  }
}

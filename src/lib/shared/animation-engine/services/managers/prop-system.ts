/**
 * PropSystem
 *
 * Owns the prop pipeline + prop-type manager and centralises all
 * prop-related orchestration that previously lived on AnimationEngine:
 *
 *  - handlePropTypeChanges  — per-frame change detection (update() path)
 *  - reloadTexturesForDarkMode — dark-mode → texture reload (preview + global paths)
 *  - syncPropTypeFromChanger — reads propTypeChanger.state and writes AnimatorState setters
 *
 * This class holds prevDarkMode internally; the engine no longer tracks it.
 *
 * Depends only on AnimatorState (TYPE import), PropPipeline, PropTypeManager,
 * and CanvasLifecycleManager (for the propTypeChanger getter).
 * Does NOT import AnimationEngine — keeps the dependency graph acyclic.
 */

import { animationSettings as animationSettingsState } from "../../state/animation-settings-state.svelte";
import type { AnimatorState } from "../../state/animator-state.svelte";
import type { RenderFrameParams } from "../IAnimationRenderLoop";
import type { AnimationEngineProps } from "../animation-engine.svelte";
import { PropTypeManager } from "../prop-type-manager";
import { PropPipeline } from "../prop-pipeline";
import type { CanvasLifecycleManager } from "../canvas-lifecycle-manager";

export class PropSystem {
  // ── Owned services ──────────────────────────────────────────────────────────
  readonly propTypeManager = new PropTypeManager();
  readonly propPipeline = new PropPipeline(this.propTypeManager);

  // ── Internal prev-state (was engine.prevDarkMode) ───────────────────────────
  private _prevDarkMode: boolean = false;

  constructor(
    private readonly state: AnimatorState,
    private readonly deps: { lifecycleManager: CanvasLifecycleManager }
  ) {}

  // ── Public accessor used by engine.buildFrameParams ─────────────────────────
  get prevDarkMode(): boolean {
    return this._prevDarkMode;
  }

  /**
   * Initialise prevDarkMode to match the current dark-mode reading.
   * Called from engine.initialize() after the VM is first queried — same
   * ordering as the previous `this.prevDarkMode = vm.isDarkMode()` assignment.
   */
  initPrevDarkMode(darkMode: boolean): void {
    this._prevDarkMode = darkMode;
  }

  // ── Prop-type change detection (per-frame, called from update()) ────────────

  /**
   * Handles prop-type change detection and delegates to PropPipeline.
   * Absorbed from engine.update() ~line 453-455.
   */
  handlePropTypeChanges(
    props: AnimationEngineProps,
    getFrameParamsFn: () => RenderFrameParams
  ): void {
    this.propPipeline.handlePropTypeChanges(
      props,
      this.state,
      getFrameParamsFn,
      this._prevDarkMode
    );
  }

  // ── Dark-mode texture reload ─────────────────────────────────────────────────

  /**
   * Reload prop textures when dark mode has changed, then trigger a re-render.
   * Shared by two callers:
   *   1. update() — preview dark mode override (previewDarkMode prop)
   *   2. handleVisibilityChange() — global dark-mode toggle
   *
   * The caller must already have updated prevDarkMode (via setPrevDarkMode) and
   * issued the renderer.setDarkMode() call before invoking this method so that
   * the texture load sees the correct new dark-mode value.
   *
   * Returns the Promise so the caller can chain a render trigger after load.
   */
  async reloadTexturesForDarkMode(
    triggerRender: () => void
  ): Promise<void> {
    await this.propPipeline.loadTextures(this.state, this._prevDarkMode);
    triggerRender();
  }

  /**
   * Update prevDarkMode. Separated from reloadTexturesForDarkMode so the
   * engine can guard the change check before deciding to reload.
   */
  setPrevDarkMode(darkMode: boolean): void {
    this._prevDarkMode = darkMode;
  }

  // ── PropTypeChanger sync (called from syncServiceState()) ────────────────────

  /**
   * Reads propTypeChanger.state and writes into AnimatorState.
   * Absorbed from engine.syncServiceState() ~lines 1099-1112.
   * Guard: only writes when no prop-type overrides are active.
   */
  syncPropTypeFromChanger(): void {
    const propTypeChanger = this.deps.lifecycleManager.propTypeChanger;
    if (
      propTypeChanger &&
      this.propTypeManager.propTypeOverrideBlue == null &&
      this.propTypeManager.propTypeOverrideRed == null
    ) {
      const pts = propTypeChanger.state;
      this.state.setBluePropType(pts.bluePropType);
      this.state.setRedPropType(pts.redPropType);
      if (this.state.currentPropType !== pts.legacyPropType) {
        this.state.setLegacyPropType(pts.legacyPropType);
        animationSettingsState.setCurrentPropType(pts.bluePropType);
      }
    }
  }
}

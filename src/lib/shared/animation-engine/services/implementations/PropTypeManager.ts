/**
 * PropTypeManager
 *
 * Hot-swaps prop types, loads/reloads textures asynchronously.
 * Suppresses trails during texture transitions.
 *
 * Extracted from AnimationEngine to reduce its line count.
 * This is a plain TypeScript class - no Svelte reactivity needed.
 */

import { animationSettings as animationSettingsState } from "../../state/animation-settings-state.svelte";
import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";
import type { IPropTextureLoader } from "../contracts/IPropTextureLoader";
import type { TrailCapturer } from "$lib/shared/animation-engine/services/implementations/TrailCapturer";
import type { IAnimationRenderLoop, RenderFrameParams } from "../contracts/IAnimationRenderLoop";
import type { IAnimationPrecomputer } from "../contracts/IAnimationPrecomputer";
import type { PropTypeChanger } from "./PropTypeChanger.svelte";
import type { FireTipTracker } from "./FireTipTracker";
import type { IAnimationRenderer as AnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import { TUNNEL_LAYER_COLORS } from "$lib/shared/animation-engine/domain/compose-types";

import type { AnimationEngineProps } from "./AnimationEngine.svelte";
import type { AnimatorState } from "../../state/animator-state.svelte";

/** Callback to obtain current frame params. */
export type FrameParamsProvider = () => RenderFrameParams;

export class PropTypeManager {
  // ── State ───────────────────────────────────────────────────────────
  propTypeOverrideBlue: string | null = null;
  propTypeOverrideRed: string | null = null;
  trailsSuppressedUntilTextureLoad = false;

  // Additional layer texture loading for tunnel mode (indexed by layer)
  additionalLayerTexturesLoaded: boolean[] = [];
  additionalLayerTexturesLoading: boolean[] = [];

  // ── Dependencies (injected) ─────────────────────────────────────────
  private settingsService: SettingsState | null = null;
  private propTextureService: IPropTextureLoader | null = null;
  private trailCapturer: TrailCapturer | null = null;
  private renderLoopService: IAnimationRenderLoop | null = null;
  private precomputationService: IAnimationPrecomputer | null = null;
  private propTypeChangeService: PropTypeChanger | null = null;
  private fireTipTracker: FireTipTracker | null = null;
  private animationRenderer: AnimationRenderer | null = null;
  private lastTextureReloadSignal: number = 0;

  /**
   * Wire dependencies after construction. Called from AnimationEngine.
   */
  wire(deps: {
    settingsService: SettingsState | null;
    propTextureService: IPropTextureLoader | null;
    trailCapturer: TrailCapturer | null;
    renderLoopService: IAnimationRenderLoop | null;
    precomputationService: IAnimationPrecomputer | null;
    propTypeChangeService: PropTypeChanger | null;
    fireTipTracker: FireTipTracker | null;
    animationRenderer: AnimationRenderer | null;
  }): void {
    this.settingsService = deps.settingsService;
    this.propTextureService = deps.propTextureService;
    this.trailCapturer = deps.trailCapturer;
    this.renderLoopService = deps.renderLoopService;
    this.precomputationService = deps.precomputationService;
    this.propTypeChangeService = deps.propTypeChangeService;
    this.fireTipTracker = deps.fireTipTracker;
    this.animationRenderer = deps.animationRenderer;
  }

  /** Update mutable refs that change after wire(). */
  updateRefs(refs: {
    renderLoopService?: IAnimationRenderLoop | null;
    precomputationService?: IAnimationPrecomputer | null;
    propTextureService?: IPropTextureLoader | null;
    trailCapturer?: TrailCapturer | null;
    fireTipTracker?: FireTipTracker | null;
    animationRenderer?: AnimationRenderer | null;
  }): void {
    if (refs.renderLoopService !== undefined) this.renderLoopService = refs.renderLoopService;
    if (refs.precomputationService !== undefined) this.precomputationService = refs.precomputationService;
    if (refs.propTextureService !== undefined) this.propTextureService = refs.propTextureService;
    if (refs.trailCapturer !== undefined) this.trailCapturer = refs.trailCapturer;
    if (refs.fireTipTracker !== undefined) this.fireTipTracker = refs.fireTipTracker;
    if (refs.animationRenderer !== undefined) this.animationRenderer = refs.animationRenderer;
  }

  /**
   * Handle prop type changes from overrides (props.bluePropType/redPropType).
   * Returns true if a texture reload was triggered.
   */
  handleOverrides(
    props: AnimationEngineProps,
    state: AnimatorState,
    getFrameParams: FrameParamsProvider,
    prevDarkMode: boolean
  ): boolean {
    const newBlue =
      props.bluePropType ?? this.propTypeOverrideBlue ?? "staff";
    const newRed = props.redPropType ?? this.propTypeOverrideRed ?? "staff";

    // Check if overrides changed
    if (
      newBlue !== this.propTypeOverrideBlue ||
      newRed !== this.propTypeOverrideRed
    ) {
      this.propTypeOverrideBlue = newBlue;
      this.propTypeOverrideRed = newRed;
      state.setBluePropType(newBlue);
      state.setRedPropType(newRed);
      state.setLegacyPropType(newBlue);

      // Update global settings so UI (e.g. trail tracking labels) reflects current prop
      animationSettingsState.setCurrentPropType(newBlue);

      // Invalidate path cache FIRST - it holds pre-computed endpoint positions
      // for the old prop geometry. If the render loop reads stale cache data
      // before the new textures load, it draws a jump line to the wrong position.
      this.precomputationService?.clearCaches();
      this.renderLoopService?.updateConfig({ pathCache: null });

      // Clear trail buffers - old points are at wrong endpoint positions
      this.trailCapturer?.clearTrails();

      // Suppress trail rendering until new textures load - prevents stale
      // endpoint data from flashing as a jump line during the async gap
      this.trailsSuppressedUntilTextureLoad = true;

      // Reset additional layer textures so they reload with new prop type
      this.additionalLayerTexturesLoaded = [];
      this.additionalLayerTexturesLoading = [];

      // Reset fire tip tracker so fire points recalculate for the new prop geometry
      this.fireTipTracker?.reset();

      // Hot-swap textures
      this.loadPropTextures(state, prevDarkMode).then(() => {
        // Clear trails again after texture load to discard any points
        // captured during the async gap with old prop dimensions
        this.trailCapturer?.clearTrails();
        this.trailsSuppressedUntilTextureLoad = false;
        if (state.isInitialized) {
          this.renderLoopService?.triggerRender(getFrameParams);
        }
      });

      return true;
    }
    return false;
  }

  /**
   * Handle prop type changes from settings (via PropTypeChanger).
   * Returns true if a texture reload was triggered.
   */
  handleSettingsChange(
    state: AnimatorState,
    getFrameParams: FrameParamsProvider,
    prevDarkMode: boolean
  ): boolean {
    // No overrides - use settings via propTypeChangeService
    this.propTypeChangeService?.checkForChanges(this.settingsService);

    // Handle texture reload signal (track last signal to detect changes)
    const textureSignal =
      this.propTypeChangeService?.state.textureReloadSignal ?? 0;
    if (textureSignal > 0 && textureSignal !== this.lastTextureReloadSignal) {
      this.lastTextureReloadSignal = textureSignal;

      // CRITICAL: Sync prop type state AFTER checkForChanges() detected the new values
      // Otherwise loadPropTextures() would use stale values from the earlier syncServiceState() call
      if (this.propTypeChangeService) {
        state.setBluePropType(this.propTypeChangeService.state.bluePropType);
        state.setRedPropType(this.propTypeChangeService.state.redPropType);
        state.setLegacyPropType(this.propTypeChangeService.state.legacyPropType);
        animationSettingsState.setCurrentPropType(
          this.propTypeChangeService.state.bluePropType
        );
      }

      // Invalidate path cache FIRST - it holds pre-computed endpoint positions
      // for the old prop geometry. If the render loop reads stale cache data
      // before the new textures load, it draws a jump line to the wrong position.
      this.precomputationService?.clearCaches();
      this.renderLoopService?.updateConfig({ pathCache: null });

      // Clear trail buffers - old points are at wrong endpoint positions
      this.trailCapturer?.clearTrails();

      // Suppress trail rendering until new textures load
      this.trailsSuppressedUntilTextureLoad = true;

      // Reset additional layer textures so they reload with new prop type
      this.additionalLayerTexturesLoaded = [];
      this.additionalLayerTexturesLoading = [];

      // Reset fire tip tracker so fire points recalculate for the new prop geometry
      this.fireTipTracker?.reset();

      // Hot-swap textures without full re-initialization
      // The render loop keeps running with old textures until new ones load
      this.loadPropTextures(state, prevDarkMode).then(() => {
        this.trailCapturer?.clearTrails();
        this.trailsSuppressedUntilTextureLoad = false;
        // Trigger immediate re-render once new textures are ready
        if (state.isInitialized) {
          this.renderLoopService?.triggerRender(getFrameParams);
        }
      });

      return true;
    }
    return false;
  }

  /**
   * Handle additional layer prop textures for tunnel mode.
   * When additional layers are passed, load per-layer colored textures.
   */
  handleAdditionalLayers(
    props: AnimationEngineProps,
    state: AnimatorState,
    getFrameParams: FrameParamsProvider
  ): void {
    const additionalLayers = props.additionalLayers ?? [];

    if (additionalLayers.length > 0 && this.animationRenderer) {
      for (let i = 0; i < additionalLayers.length; i++) {
        const layer = additionalLayers[i]!;
        const hasProps = layer.blueProp != null || layer.redProp != null;

        if (
          hasProps &&
          !this.additionalLayerTexturesLoaded[i] &&
          !this.additionalLayerTexturesLoading[i]
        ) {
          this.additionalLayerTexturesLoading[i] = true;

          // Use TUNNEL_LAYER_COLORS for this layer (offset by 1 since index 0 = primary layer)
          const colors = TUNNEL_LAYER_COLORS[i + 1] ?? TUNNEL_LAYER_COLORS[1]!;

          this.animationRenderer
            .loadAdditionalLayerPropTextures(
              i,
              state.currentBluePropType,
              colors.left,
              colors.right
            )
            .then(() => {
              this.additionalLayerTexturesLoaded[i] = true;
              this.additionalLayerTexturesLoading[i] = false;

              // Trigger re-render with new layer textures
              if (state.isInitialized) {
                this.renderLoopService?.triggerRender(getFrameParams);
              }
            })
            .catch((err) => {
              console.error(`Failed to load layer ${i} prop textures:`, err);
              this.additionalLayerTexturesLoading[i] = false;
            });
        }
      }
    }
  }

  /**
   * Load prop textures (used by both override and settings paths).
   */
  async loadPropTextures(
    state: AnimatorState,
    prevDarkMode: boolean
  ): Promise<void> {
    if (!this.propTextureService) return;

    // Use overrides if set, otherwise read from settings
    let bluePropType = state.currentBluePropType;
    let redPropType = state.currentRedPropType;

    if (this.propTypeOverrideBlue != null || this.propTypeOverrideRed != null) {
      // Use overrides - bypass settings entirely
      bluePropType = this.propTypeOverrideBlue ?? "staff";
      redPropType = this.propTypeOverrideRed ?? "staff";
    } else if (this.settingsService?.currentSettings) {
      // No overrides - read from settings
      const settings = this.settingsService.currentSettings;
      bluePropType = settings.bluePropType || settings.propType || "staff";
      redPropType = settings.redPropType || settings.propType || "staff";

      // Also update engine state to keep it in sync
      state.setBluePropType(bluePropType);
      state.setRedPropType(redPropType);
      state.setLegacyPropType(bluePropType);
    }

    // Pass dark mode state for prop color selection
    // This allows preview isolation - local preview dark mode instead of global
    await this.propTextureService.loadPropTextures(
      bluePropType,
      redPropType,
      prevDarkMode
    );

    // CRITICAL: Sync dimensions to engine state immediately after loading
    // This ensures getFrameParams() has correct dimensions for the first render
    state.setBluePropDimensions(this.propTextureService.state.blueDimensions);
    state.setRedPropDimensions(this.propTextureService.state.redDimensions);

    // CRITICAL: Clear animation path caches when prop types/dimensions change
    // The path cache uses prop dimensions for endpoint calculations - stale cache = wrong trails
    this.precomputationService?.clearCaches();
  }
}

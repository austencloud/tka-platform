/**
 * PropTypeManager
 *
 * Hot-swaps prop types, loads/reloads textures asynchronously.
 * Suppresses trails during texture transitions.
 *
 * Extracted from AnimationEngine to reduce its line count.
 * This is a plain TypeScript class - no Svelte reactivity needed.
 */

import { animationSettings as animationSettingsState } from "../state/animation-settings-state.svelte";
import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
import type { IPropTextureLoader } from "./IPropTextureLoader";
import type { TrailCapturer } from "$lib/shared/animation-engine/services/trail-capturer";
import type { IAnimationRenderLoop, RenderFrameParams } from "./IAnimationRenderLoop";
import type { IAnimationPrecomputer } from "./IAnimationPrecomputer";
import type { PropTypeChanger } from "./prop-type-changer.svelte";
import type { FireTipTracker } from "./fire-tip-tracker";
import type { IAnimationRenderer as AnimationRenderer } from "$lib/shared/animation-engine/services/IAnimationRenderer";
import { tunnelPropColor } from "$lib/shared/sequence-viewer/tunnel/tunnel-prop-colors";
import { getBaseMotionColors } from "./svg-generator";

import type { AnimationEngineProps } from "./animation-engine.svelte";
import type { AnimatorState } from "../state/animator-state.svelte";

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
  // Last seen tunnel layer count; spectrum hues depend on it, so a change forces
  // a sprite regenerate (see handleAdditionalLayers).
  private lastLayerCount = 0;
  private lastSpectrum = true;
  // Per-layer prop-type signature. A performer-set change (a copy swapping its
  // prop) must regenerate that layer's sprite even when count + spectrum hold.
  private lastLayerPropSig = "";

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
      // Per-color hot-swap flags for the morph crossfade below. Gated on
      // propTypeOverrideBlue/Red already being non-null: the FIRST time an
      // override is ever registered (mount, coming from null) is establishing
      // initial state, not swapping an already-displayed prop, so it must not
      // fade — only a genuine value-to-value change does.
      const blueChanged =
        this.propTypeOverrideBlue !== null && newBlue !== this.propTypeOverrideBlue;
      const redChanged =
        this.propTypeOverrideRed !== null && newRed !== this.propTypeOverrideRed;

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
        // Start the morph crossfade only for the color(s) whose type actually
        // changed. loadPropTextures always reloads both colors together, but
        // an unchanged color reloads a visually identical sprite, so there is
        // nothing to fade there even though a "previous" image now exists.
        if (blueChanged) this.animationRenderer?.startBluePropMorphFade();
        if (redChanged) this.animationRenderer?.startRedPropMorphFade();
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

      // Per-color hot-swap flags for the morph crossfade below, captured
      // against AnimatorState's currently-displayed type BEFORE it's
      // overwritten. This naturally excludes the mount-time sync (settings
      // already loaded the correct type during initial load, so the "old"
      // and "new" values here are equal and nothing fades) from a genuine
      // later settings-driven change (old and new differ, so it fades).
      const blueChanged =
        this.propTypeChangeService != null &&
        this.propTypeChangeService.state.bluePropType !== state.currentBluePropType;
      const redChanged =
        this.propTypeChangeService != null &&
        this.propTypeChangeService.state.redPropType !== state.currentRedPropType;

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
        // Same per-color morph start as handleOverrides — see its comment.
        if (blueChanged) this.animationRenderer?.startBluePropMorphFade();
        if (redChanged) this.animationRenderer?.startRedPropMorphFade();
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
    const layerCount = additionalLayers.length;
    const spectrum = props.tunnelSpectrum ?? true;
    // Signature of every layer's per-hand prop type. Empty entries fall back to
    // the global prop, so an all-default set yields "|"-joined blanks — a
    // performer swapping a prop changes the signature and re-generates sprites.
    const propSig = additionalLayers
      .map((l) => `${l.bluePropType ?? ""}:${l.redPropType ?? ""}`)
      .join("|");

    // Spectrum colors fan across the active stack, so they depend on layerCount
    // AND the spectrum toggle. Per-performer props depend on propSig. When any
    // change, every affected layer's sprite must regenerate — drop the cache.
    if (
      layerCount !== this.lastLayerCount ||
      spectrum !== this.lastSpectrum ||
      propSig !== this.lastLayerPropSig
    ) {
      this.lastLayerCount = layerCount;
      this.lastSpectrum = spectrum;
      this.lastLayerPropSig = propSig;
      this.additionalLayerTexturesLoaded = [];
      this.additionalLayerTexturesLoading = [];
    }

    if (layerCount > 0 && this.animationRenderer) {
      for (let i = 0; i < layerCount; i++) {
        const layer = additionalLayers[i]!;
        const hasProps = layer.blueProp != null || layer.redProp != null;

        if (
          hasProps &&
          !this.additionalLayerTexturesLoaded[i] &&
          !this.additionalLayerTexturesLoading[i]
        ) {
          this.additionalLayerTexturesLoading[i] = true;

          const { blue: blueColor, red: redColor } =
            this.additionalLayerColors(i, layerCount, spectrum);
          // Each performer's per-hand prop; falls back to the global prop when a
          // layer carries no explicit type (default 1-skin appearance = today).
          const bluePropType = layer.bluePropType ?? state.currentBluePropType;
          const redPropType = layer.redPropType ?? state.currentRedPropType;

          this.animationRenderer
            .loadAdditionalLayerPropTextures(
              i,
              bluePropType,
              redPropType,
              blueColor,
              redColor
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
   * Canonical per-layer staff colors, shared by the live load path
   * (handleAdditionalLayers) and the export preload so both color the
   * kaleidoscope identically. Colors each layer sprite through the same
   * selective SVG pipeline the base pair uses (gold sword blade preserved, only
   * the hardware takes the hue). propIndex convention: layer blue = 2+2i,
   * red = 3+2i.
   *
   * Spectrum off: every layer staff matches the base pair exactly — the native
   * blue/red SVG (getBaseMotionColors), NOT tunnelPropColor's anchor (the anchor
   * blue is a touch more violet, which read as "one odd staff" against the
   * native base), so all four blues (and reds) are identical.
   */
  private additionalLayerColors(
    layerIndex: number,
    layerCount: number,
    spectrum: boolean,
  ): { blue: string; red: string } {
    const baseColors = spectrum ? null : getBaseMotionColors();
    return {
      blue: baseColors ? baseColors.blue : tunnelPropColor(2 + layerIndex * 2, layerCount).hex,
      red: baseColors ? baseColors.red : tunnelPropColor(3 + layerIndex * 2, layerCount).hex,
    };
  }

  /**
   * Pre-load every additional-layer prop texture up front and await them. The
   * offscreen export engine is driven only through renderFrame() and never runs
   * PlaybackSync.update → handleAdditionalLayers, so the per-layer images would
   * otherwise stay null and the renderer would skip the kaleidoscope copies
   * (canvas-2d-animation-renderer getAdditionalLayerImages) — the export showing
   * only the base pair. Deterministic: every load resolves before frame 0.
   */
  async preloadAdditionalLayerTextures(
    layerCount: number,
    spectrum: boolean,
    propType: string,
    perLayerTypes?: ReadonlyArray<{ blue: string; red: string }>,
  ): Promise<void> {
    if (layerCount <= 0 || !this.animationRenderer) return;
    this.lastLayerCount = layerCount;
    this.lastSpectrum = spectrum;
    // Reset the prop-type signature so the next live handleAdditionalLayers pass
    // re-evaluates against the freshly-preloaded sprites.
    this.lastLayerPropSig = "";
    this.additionalLayerTexturesLoaded = [];
    this.additionalLayerTexturesLoading = [];
    await Promise.all(
      Array.from({ length: layerCount }, (_, i) => {
        const { blue, red } = this.additionalLayerColors(i, layerCount, spectrum);
        // Per-performer prop types when supplied (Performer Set export); else the
        // single global prop for both hands — today's export behavior, unchanged.
        const t = perLayerTypes?.[i];
        const blueType = t?.blue ?? propType;
        const redType = t?.red ?? propType;
        return this.animationRenderer!
          .loadAdditionalLayerPropTextures(i, blueType, redType, blue, red)
          .then(() => {
            this.additionalLayerTexturesLoaded[i] = true;
          });
      }),
    );
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

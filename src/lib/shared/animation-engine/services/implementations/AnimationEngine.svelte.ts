/**
 * AnimationEngine - Pure TypeScript orchestration for canvas animation
 *
 * This class owns all animation services and handles orchestration logic.
 * The component just passes props to engine.update() and derives state.
 *
 * Heavy subsystems are extracted into focused modules:
 * - EffectRendererManager: 14 overlay renderers + lifecycle + configs
 * - FrameParameterBuilder: per-frame param computation + caching
 * - PropTypeManager: prop hot-swap + texture loading
 *
 * Key benefits:
 * - Testable (pure TypeScript class)
 * - Component reduced to ~80 lines
 * - All 23 effects consolidated into update() method
 * - Standard canvas animation architecture
 */

import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import { type TrailSettings } from "../../domain/types/TrailTypes";
import type { AdditionalLayerProps } from "../../domain/types/TrailCaptureTypes";
import type { AnimationVisibilityState } from "./AnimationVisibilitySynchronizer";
import type { PreRenderProgress } from "$lib/shared/animation-engine/services/implementations/SequenceFramePreRenderer";

import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { TipEffortMap } from "../../domain/types/TipEffectTypes";

// Services
import {
  DEFAULT_CANVAS_SIZE,
} from "./CanvasResizer.svelte";
import { FrameBudgetMonitor } from "./FrameBudgetMonitor";
import { DeviceTierDetector } from "./DeviceTierDetector";
import { AnimatorCanvasInitializer } from "./AnimatorCanvasInitializer";
import type { FireOverlayConfig } from "../../domain/types/FireTypes";
import type { FireDefaultsLoader } from "./FireDefaultsLoader";
import type { LedOverlayConfig } from "../../domain/types/LedTypes";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

import { LiveRenderContext } from "./RenderContext";
import type { RenderContext } from "./RenderContextRegistry";

// Extracted modules
import { StateSynchronizer } from "./StateSynchronizer";
import { CanvasLifecycleManager, type LifecycleInitCtx } from "./CanvasLifecycleManager";
import { PropSystem } from "./managers/PropSystem";
import { FrameSystem } from "./managers/FrameSystem";
import { EffectSystem } from "./managers/EffectSystem";
import type { EffectType, TipEffectMap } from '../../domain/types/TipEffectTypes';
import { createAnimatorState, type AnimatorState } from '../../state/animator-state.svelte';

// ── Effects helper utilities ────────────────────────────────────────────────

/** Returns true if any entry in the map has the given effect type. */
function hasEffectInMap(map: TipEffectMap | undefined, effect: string): boolean {
  if (!map) return false;
  return Object.values(map).some(a => a.effect === effect);
}

/**
 * Props passed to engine.update()
 */
export interface AnimationEngineProps {
  blueProp: PropState | null;
  redProp: PropState | null;
  additionalLayers?: AdditionalLayerProps[];
  gridVisible?: boolean;
  gridMode?: GridMode | null;
  backgroundAlpha?: number;
  letter?: Letter | null;
  stepData?: StartPositionData | StepData | null;
  sequenceData?: SequenceData | null;
  currentStep?: number;
  isPlaying?: boolean;
  externalTrailSettings?: TrailSettings;
  // Prop type overrides - bypass settings when provided (useful for demos/previews)
  bluePropType?: string | null;
  redPropType?: string | null;
  // Preview-only dark mode override - when provided, bypasses global setting
  // Used in sequence viewer preview so dark mode toggle doesn't affect global app state
  previewDarkMode?: boolean | null;
  // Whether sequence returns to start position - controls trail clearing on loop
  isSeamlesslyLoopable?: boolean;
  /** Virtual time for this frame (in ms). Used during video export. */
  virtualTime?: number;
  /** When false, hides nonradial (layer2/intercardinal) grid points. Default true. */
  showNonRadialPoints?: boolean;
}

/**
 * Default props for initial render (when no props have been passed yet)
 */
const DEFAULT_ENGINE_PROPS: AnimationEngineProps = {
  blueProp: null,
  redProp: null,
};

/**
 * Callbacks for component to receive events
 */
export interface AnimationEngineCallbacks {
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onTrailSettingsChange?: (settings: TrailSettings) => void;
  /** Called when an effect (fire/charcoal/LED) fails repeatedly and is auto-disabled */
  onEffectError?: (effectName: string, error: Error) => void;
}


export class AnimationEngine {
  // ============================================================================
  // REACTIVE STATE - Component derives from this
  // ============================================================================
  private readonly _animatorState = createAnimatorState();

  get state(): AnimatorState { return this._animatorState; }
  get animatorState(): AnimatorState { return this._animatorState; }

  // ============================================================================
  // EXTRACTED MODULES
  // ============================================================================
  private readonly lifecycleManager = new CanvasLifecycleManager();
  private readonly effectSystem = new EffectSystem(this._animatorState, { lifecycleManager: this.lifecycleManager });
  private readonly stateSynchronizer = new StateSynchronizer();
  private readonly propSystem = new PropSystem(this._animatorState, { lifecycleManager: this.lifecycleManager });
  private readonly frameSystem = new FrameSystem(this._animatorState, {
    lifecycleManager: this.lifecycleManager,
    propSystem: this.propSystem,
  });

  // ============================================================================
  // PRIVATE SERVICES
  // ============================================================================
  private readonly canvasInitializer = new AnimatorCanvasInitializer();
  private readonly frameBudgetMonitor: FrameBudgetMonitor =
    new FrameBudgetMonitor(new DeviceTierDetector().detect());
  private fireDefaultsLoader: FireDefaultsLoader | null = null;

  // ============================================================================
  // PRIVATE STATE
  // ============================================================================
  private containerElement: HTMLDivElement | null = null;
  private callbacks: AnimationEngineCallbacks = {};
  private canvasSize = DEFAULT_CANVAS_SIZE;
  private instanceId = Math.random().toString(36).substring(2, 8);
  /** Per-instance visibility manager override. When set, this engine uses its own
   * manager instead of the global singleton, allowing multiple canvases to have
   * independent visibility/effect settings. */
  private visibilityManagerOverride: AnimationVisibilityStateManager | null = null;
  private settingsLoaded = false;
  private trailCapturerInitialized = false;
  private previousGridMode: string | null = null;
  private previousShowNonRadialPoints: boolean = true;
  private cacheSequenceId: string | null = null;
  private unsubscribeVisibility: (() => void) | null = null;
  private lastClearSignal: number = 0;
  private lastPreRenderClearSignal: number = 0;

  // Previous props for change detection (only track what we compare)
  private prevStepData: StartPositionData | StepData | null = null;
  private prevSequenceData: SequenceData | null = null;
  private prevIsPlaying: boolean = false;
  private prevGridMode: GridMode | null = null;

  private previewDarkModeActive: boolean = false; // true when previewDarkMode prop overrides global
  private prevTrailsActive: boolean = true;
  private prevPropsVisible: boolean = true;
  private prevPathShape: "arc" | "linear" | "concave" = "arc";
  private prevMotionAwarePaths: boolean = false;

  /** Per-performer effort resolver. When set, getEffortForPerformer() calls it
   *  instead of reading the global visibility manager. */
  private _performerEffortResolver: ((performerId: string) => EffortId) | null = null;

  // Simple reference to last props for initial render (not a copy - avoids GC)
  private lastPropsRef: AnimationEngineProps | null = null;

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Set a per-instance visibility manager override. Must be called before
   * initialize() so that the engine (and its sub-services) read from the
   * correct manager from the start.
   */
  setVisibilityManager(manager: AnimationVisibilityStateManager): void {
    this.visibilityManagerOverride = manager;
  }

  /**
   * Wire the shared EffectsConfigState so the engine reads live per-effect
   * intents (zap, etc.) from the same source the Customize panels write to.
   *
   * Pass null to detach (falls back to DEFAULT_EFFECTS_CONFIG-resolved values).
   * Call before initialize() so first-frame render uses the correct params.
   */
  setEffectsConfigState(state: EffectsConfigState | null): void {
    this.effectSystem.setEffectsConfigState(state);
    const vss = this.lifecycleManager.visibilitySynchronizer;
    if (vss) {
      vss.effectsConfigState = state;
    }
  }

  /**
   * Update motion visibility from the viewer-scoped state.
   * Called by AnimatorCanvas whenever the user toggles Blue/Red in the
   * header popover. Mutates the engine's internal visibilityState so the
   * next render frame reflects it. Also triggers an immediate re-render
   * so the change takes effect without waiting for the next animation tick.
   */
  setMotionVisibility(blue: boolean, red: boolean): void {
    if (
      this.state.blueMotionVisible === blue &&
      this.state.redMotionVisible === red
    ) {
      return;
    }
    this.state.setMotionVisibility(blue, red);
    if (this.state.isInitialized) {
      this.lifecycleManager.renderLoop?.triggerRender(() =>
        this.frameSystem.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS, this.buildFrameDeps())
      );
    }
  }

  /**
   * Set a per-performer effort resolver. When set, getEffortForPerformer()
   * calls the resolver instead of reading the global visibility manager.
   * Pass null to clear and restore global-fallback behavior.
   */
  setPerformerEffortResolver(
    resolver: ((performerId: string) => EffortId) | null
  ): void {
    this._performerEffortResolver = resolver;
  }

  /**
   * Return the effort preset for a given performer.
   * Uses the per-performer resolver when set; falls back to the global
   * visibility manager otherwise.
   */
  getEffortForPerformer(performerId: string): EffortId {
    if (this._performerEffortResolver) {
      return this._performerEffortResolver(performerId);
    }
    return this.getVM().getEffortPreset();
  }

  /** Return the per-instance override if set, otherwise the global singleton. */
  private getVM(): AnimationVisibilityStateManager {
    return this.visibilityManagerOverride ?? getAnimationVisibilityManager();
  }

  /**
   * Initialize the engine with a container element.
   *
   * Assembles the LifecycleInitCtx and delegates all service creation/wiring to
   * CanvasLifecycleManager.initialize(). The engine retains only the state,
   * callbacks, and collaborator modules it needs for update() / dispose().
   */
  async initialize(
    containerElement: HTMLDivElement,
    callbacks: AnimationEngineCallbacks = {}
  ): Promise<void> {
    this.containerElement = containerElement;
    this.callbacks = callbacks;

    this.lifecycleManager.configure({
      canvasInitializer: this.canvasInitializer,
      effectManager: this.effectSystem.rendererManager,
    });

    // Initialize visibility manager prev-state flags (engine owns these for
    // change-detection in handleVisibilityChange / update()).
    const vm = this.getVM();
    const ecs = this.effectSystem.effectsConfigState;
    this.propSystem.initPrevDarkMode(vm.isDarkMode());
    this.prevTrailsActive = hasEffectInMap(ecs?.tipEffectMap, "trails");
    this.prevPropsVisible = vm.getVisibility("props");

    // Initialize effect-system prev-state (fire sliders, charcoal, effort, ERM flags)
    this.effectSystem.initPrevState(ecs);

    // fireDefaultsLoader - load on demand via getter
    try {
      const { getFireDefaultsLoader } = await import("$lib/shared/animation-engine/getFireDefaultsLoader");
      this.fireDefaultsLoader = getFireDefaultsLoader();
    } catch {
      console.warn("[AnimationEngine] Fire defaults loader not available");
    }

    this.state.setVisibilityState({
      grid: vm.getGridMode() !== "none",
      stepNumbers: vm.getVisibility("stepNumbers"),
      props: vm.getVisibility("props"),
      trails: hasEffectInMap(ecs?.tipEffectMap, "trails"),
      tkaGlyph: vm.getVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      darkMode: vm.isDarkMode(),
      wordHeader: vm.getVisibility("wordHeader"),
      activeEffect: (ecs?.activeEffect ?? "none") as EffectType,
      tipEffectMap: ecs?.tipEffectMap ?? {},
    });

    // Build the init context and delegate service creation to the manager.
    const ctx: LifecycleInitCtx = {
      containerElement,
      visibilityManagerOverride: this.visibilityManagerOverride,
      effectsConfigState: this.effectSystem.effectsConfigState,
      effectRendererManager: this.effectSystem.rendererManager,
      propSystem: this.propSystem,
      frameBudgetMonitor: this.frameBudgetMonitor,
      canvasSize: this.canvasSize,
      getLastPropsRef: () => this.lastPropsRef,
      state: this._animatorState,
      callbacks,
      prevDarkMode: this.propSystem.prevDarkMode,
      initialGridMode: this.lastPropsRef?.gridMode,
      initialShowNonRadialPoints: this.lastPropsRef?.showNonRadialPoints ?? true,
      buildFrameParams: (props) => this.frameSystem.buildFrameParams(props, this.buildFrameDeps()),
      getVM: () => this.getVM(),
      onVisibilityChange: (state) => this.handleVisibilityChange(state),
      instanceId: this.instanceId,
    };

    await this.lifecycleManager.initialize(ctx);

    // Sync previousGridMode with the grid texture loaded during initialization,
    // so the change-detection in update() doesn't redundantly reload the same texture.
    const initGridMode = this.lastPropsRef?.gridMode?.toString() ?? "diamond";
    this.previousGridMode = initGridMode;
    this.previousShowNonRadialPoints = this.lastPropsRef?.showNonRadialPoints ?? true;

    // Wire overlay renderers that may have been created during the async
    // initializeCanvas gap.
    this.effectSystem.rendererManager.wirePostInitOverlays();

    // Create overlays that weren't created yet (e.g. enabled before HMR/reload
    // but the $effect hasn't triggered, or the rAF hasn't fired yet).
    this.effectSystem.rendererManager.ensureEnabledOverlays();
  }

  /**
   * Update with new props - handles all orchestration logic
   */
  update(props: AnimationEngineProps): void {
    // Keep simple reference for initial render (no copy, just reference)
    this.lastPropsRef = props;

    // Track only what we actually compare (avoid object spread GC pressure)
    this.prevStepData = props.stepData ?? null;
    this.prevSequenceData = props.sequenceData ?? null;
    this.prevIsPlaying = props.isPlaying ?? false;
    this.prevGridMode = props.gridMode ?? null;

    // Sync state from services that own reactive state
    this.syncServiceState();

    // Handle settings/trail capturer initialization
    const shouldInitTrailCapturer =
      this.state.currentBluePropType !== "staff" ||
      this.state.currentRedPropType !== "staff" ||
      this.lifecycleManager.settingsService?.currentSettings ||
      props.externalTrailSettings !== undefined;

    if (shouldInitTrailCapturer && this.lifecycleManager.trailCapturer && !this.trailCapturerInitialized) {
      if (!this.settingsLoaded) {
        this.settingsLoaded = true;
      }
      this.initializeTrailCapturer(props);
      this.trailCapturerInitialized = true;
    }

    // Handle prop type changes (delegated to PropSystem)
    const getFrameParamsFn = () => this.frameSystem.buildFrameParams(props, this.buildFrameDeps());
    this.propSystem.handlePropTypeChanges(props, getFrameParamsFn);

    // Handle trail settings changes - enforce unilateral constraint before syncing
    if (props.externalTrailSettings !== undefined) {
      this.lifecycleManager.trailSettingsSync?.handleExternalSettingsSync(
        this.frameSystem.enforceUnilateralConstraint(
          props.externalTrailSettings,
          this.state.currentBluePropType,
          this.state.currentRedPropType
        )
      );
    }

    // Handle synced trail settings from service
    const syncedSettings = this.lifecycleManager.trailSettingsSync?.state.syncedSettings;
    if (syncedSettings) {
      // Only update and notify if settings actually changed (shallow comparison - faster than JSON.stringify)
      const settingsChanged = this.trailSettingsChanged(
        this.state.trailSettings,
        syncedSettings
      );

      // CRITICAL: Only write to $state if settings actually changed to prevent infinite loops
      // In Svelte 5, assigning to a $state property triggers reactivity even for same value
      if (settingsChanged) {
        this.state.setTrailSettings(syncedSettings);

        // Only call handleSettingsChange if we're NOT using external settings
        // (external settings flow: parent -> engine; internal settings flow: engine -> parent)
        if (props.externalTrailSettings === undefined) {
          this.lifecycleManager.trailSettingsSync?.handleSettingsChange(
            this.state.trailSettings,
            false
          );
        }

        // Notify parent of the change
        this.callbacks.onTrailSettingsChange?.(syncedSettings);
      }
    }

    // Handle sequence changes
    this.lifecycleManager.sequenceCache?.handleSequenceChange(props.sequenceData ?? null);

    // Detect sequence content changes and re-initialize orchestrator if needed
    if (props.sequenceData && this.lifecycleManager.orchestrator) {
      const newHash = this.frameSystem.getSequenceContentHash(props.sequenceData);
      if (newHash !== this.frameSystem.lastSequenceContentHash) {
        this.lifecycleManager.orchestrator.initializeWithDomainData(props.sequenceData);
        this.frameSystem.lastSequenceContentHash = newHash;

        // Flush stale trail data so old ring buffer points don't draw
        // artifact lines to the new prop positions.
        this.effectSystem.trailOverlay?.clearBuffers();
        this.effectSystem.fireTipTracker?.reset();
        this.effectSystem.fireRenderer?.clearSimulation();
        this.effectSystem.charcoalRenderer?.clearSimulation();

        // Trigger path cache precomputation for smooth trails during stutters
        if (
          this.state.trailSettings.usePathCache &&
          this.lifecycleManager.precomputer
        ) {
          const totalSteps = props.sequenceData.steps.length;
          const stepDurationMs = 1000;

          this.lifecycleManager.precomputer
            .precomputeAnimationPaths(
              props.sequenceData,
              totalSteps,
              stepDurationMs,
              this.state.trailSettings
            )
            .then(() => {
              const pathCache = this.lifecycleManager.precomputer?.getPathCache();
              if (pathCache && this.lifecycleManager.renderLoop) {
                this.lifecycleManager.renderLoop.updateConfig({ pathCache });
              }
            })
            .catch((err) => {
              console.error(`[TRANSFORM-DIAG] Precomputation FAILED:`, err);
            });
        }
      }
    }

    // Handle cache clear signals (only process once per signal)
    const clearSignal = this.lifecycleManager.sequenceCache?.state.clearSignal ?? 0;
    if (clearSignal > this.lastClearSignal) {
      this.lifecycleManager.precomputer?.clearCaches();
      if (!this.effectSystem.trailOverlay) {
        this.lifecycleManager.trailCapturer?.clearTrails();
      }
      this.cacheSequenceId = null;
      this.lastClearSignal = clearSignal;
    }

    // Handle pre-render clear signals (only process once per signal)
    const preRenderClearSignal =
      this.lifecycleManager.sequenceCache?.state.preRenderClearSignal ?? 0;
    if (preRenderClearSignal > this.lastPreRenderClearSignal) {
      this.lifecycleManager.precomputer?.clearPreRenderedFrames();
      this.lastPreRenderClearSignal = preRenderClearSignal;
    }

    // Sync pre-rendered frames flag
    this.lifecycleManager.sequenceCache?.setHasPreRenderedFrames(
      this.lifecycleManager.precomputer?.state.preRenderedFramesReady ?? false
    );

    // Handle playback changes
    this.lifecycleManager.sequenceCache?.handlePlaybackChange(props.isPlaying ?? false);

    // Handle grid mode changes (also reload when nonradial visibility changes)
    const currentGridMode = props.gridMode?.toString() ?? null;
    const currentShowNonRadial = props.showNonRadialPoints ?? true;
    if (
      this.state.isInitialized &&
      this.lifecycleManager.animationRenderer &&
      (currentGridMode !== this.previousGridMode ||
        currentShowNonRadial !== this.previousShowNonRadialPoints)
    ) {
      this.previousGridMode = currentGridMode;
      this.previousShowNonRadialPoints = currentShowNonRadial;
      this.lifecycleManager.animationRenderer
        .loadGridTexture(currentGridMode ?? "diamond", currentShowNonRadial)
        .then(() => {
          this.lifecycleManager.renderLoop?.triggerRender(() =>
            this.frameSystem.buildFrameParams(props, this.buildFrameDeps())
          );
        });
    }

    // Handle preview dark mode override
    if (props.previewDarkMode !== undefined && props.previewDarkMode !== null) {
      this.previewDarkModeActive = true;
      const previewDarkMode = props.previewDarkMode;
      if (previewDarkMode !== this.propSystem.prevDarkMode) {
        this.propSystem.setPrevDarkMode(previewDarkMode);
        this.lifecycleManager.animationRenderer?.setDarkMode(previewDarkMode);

        if (this.state.isInitialized) {
          this.lifecycleManager.renderLoop?.triggerRender(() =>
            this.frameSystem.buildFrameParams(props, this.buildFrameDeps())
          );

          this.propSystem.reloadTexturesForDarkMode(() => {
            this.lifecycleManager.renderLoop?.triggerRender(() =>
              this.frameSystem.buildFrameParams(props, this.buildFrameDeps())
            );
          });
        }
      }
    } else {
      this.previewDarkModeActive = false;
    }

    // Update trail capturer with prop type and loopability changes
    if (this.lifecycleManager.trailCapturer && this.settingsLoaded) {
      this.lifecycleManager.trailCapturer.updateConfig({
        bluePropType: this.state.currentBluePropType,
        redPropType: this.state.currentRedPropType,
        isSeamlesslyLoopable: props.isSeamlesslyLoopable,
      });
    }

    // Update glyph transition
    const stepNumber = this.frameSystem.calculateBeatNumber(props);
    const turnsTuple = this.frameSystem.calculateTurnsTuple(props);
    const musicalPosition = this.frameSystem.calculateMusicalPosition(props);
    this.lifecycleManager.glyphTransition?.updateTarget(
      props.letter ?? null,
      turnsTuple,
      stepNumber,
      musicalPosition
    );

    // Sync glyph state immediately after update so component sees new values
    this.frameSystem.syncGlyphState();

    // Trigger render if initialized
    if (this.state.isInitialized) {
      this.lifecycleManager.renderLoop?.triggerRender(() =>
        this.frameSystem.buildFrameParams(props, this.buildFrameDeps())
      );
    }
  }

  /**
   * Handle glyph SVG ready callback from GlyphRenderer
   */
  handleGlyphSvgReady(
    svgString: string,
    width: number,
    height: number,
    x: number,
    y: number
  ): void {
    this.lifecycleManager.glyphTextureLoader?.handleGlyphSvgReady(
      svgString,
      width,
      height,
      x,
      y
    );
  }

  /**
   * Process pending glyph if any
   */
  processPendingGlyph(): void {
    const glyphLoader = this.lifecycleManager.glyphTextureLoader;
    if (
      this.state.isInitialized &&
      glyphLoader?.getPendingGlyph() &&
      this.lifecycleManager.animationRenderer
    ) {
      glyphLoader.processPendingGlyph();
    }
  }

  /**
   * Set target FPS for preview throttling.
   * null = render at native refresh rate (no throttling).
   */
  setTargetFps(fps: number | null): void {
    this.lifecycleManager.renderLoop?.setTargetFps(fps);
  }

  /**
   * Invalidate the fire frame cache so the simulation re-records from scratch.
   * Call after video export (which uses jumpToStep frame-by-frame) to prevent
   * stale cached fire frames from replaying when normal playback resumes.
   */
  invalidateFireCache(): void {
    this.effectSystem.invalidateFireCache();
  }

  /**
   * Invalidate the fire frame cache without clearing simulation FBOs.
   * Use before video export so the cache records fresh frames while the
   * Navier-Stokes simulation retains its warm (steady-state) fluid fields.
   */
  invalidateFireFrameCacheOnly(): void {
    this.effectSystem.invalidateFireFrameCacheOnly();
  }

  clearFireThermalFields(): void {
    this.effectSystem.clearFireThermalFields();
  }

  // --- EXPORT DIAGNOSTIC (remove after debugging) ---
  getLedRenderer() { return this.effectSystem.getLedRenderer(); }

  enableFireDiagnostics(): void {
    this.effectSystem.enableFireDiagnostics();
  }
  disableFireDiagnostics(): void {
    this.effectSystem.disableFireDiagnostics();
  }
  resetFireDiagnosticCounter(): void {
    this.effectSystem.resetFireDiagnosticCounter();
  }
  sampleFireCanvas(): string {
    return this.effectSystem.sampleFireCanvas();
  }
  snapshotFireCanvas(): void {
    this.effectSystem.snapshotFireCanvas();
  }

  /**
   * Capture a diagnostic snapshot of the entire effect pipeline.
   * Called from the canvas context menu when the user sees a visual glitch.
   * Returns a JSON-serializable object with all relevant state.
   */
  captureEffectDiagnostics(): Record<string, unknown> {
    const vm = this.getVM();
    const settings = vm.getSettings();
    const lastProps = this.lastPropsRef;

    const core = this.effectSystem.captureDiagnostics({
      isInitialized: this.state.isInitialized,
      isPlaying: lastProps?.isPlaying ?? false,
      currentStep: lastProps?.currentStep ?? 0,
      canvasSize: this.canvasSize,
      instanceId: this.instanceId,
    });

    return {
      ...core,
      visibility: {
        activeEffect: this.effectSystem.effectsConfigState?.activeEffect ?? "none",
        tipEffectMap: this.effectSystem.effectsConfigState?.tipEffectMap ?? {},
        effortPreset: settings.effortPreset,
        pathShape: settings.pathShape,
      },
      renderLoop: this.lifecycleManager.renderLoop?.getDiagnostics() ?? null,
      qualityHints: this.frameBudgetMonitor?.getQualityHints() ?? null,
      sequenceInfo: this.prevSequenceData ? {
        word: this.prevSequenceData.word,
        stepCount: this.prevSequenceData.steps?.length ?? 0,
        gridMode: this.prevSequenceData.gridMode,
      } : null,
      propTypes: {
        blue: this.state.currentBluePropType,
        red: this.state.currentRedPropType,
      },
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };
  }

  getRenderContext(id: string, container: HTMLDivElement): RenderContext | null {
    const renderer = this.lifecycleManager.animationRenderer;
    const renderLoop = this.lifecycleManager.renderLoop;
    const trailCapturer = this.lifecycleManager.trailCapturer;
    const resizer = this.lifecycleManager.resizer;
    const precomputer = this.lifecycleManager.precomputer;
    const canvas = renderer?.getCanvas();
    if (!canvas || !renderLoop || !trailCapturer || !resizer) {
      return null;
    }

    return new LiveRenderContext({
      id,
      canvas,
      container,
      renderer: renderer!,
      effectManager: this.effectSystem.rendererManager,
      trailCapturer,
      renderLoop,
      resizer,
      precomputer: precomputer!,
    });
  }

  dispose(): void {
    this.lifecycleManager.dispose({
      onCanvasReady: (canvas) => this.callbacks.onCanvasReady?.(canvas),
      onInitialized: (initialized) => { this.state.setInitialized(initialized); },
    });

    this.containerElement = null;
    this.lastPropsRef = null;
    this.prevStepData = null;
    this.prevSequenceData = null;
    this.frameSystem.resetHandPresenceCache();
  }

  pauseResize(): void { this.lifecycleManager.pauseResize(); }
  resumeResize(): void { this.lifecycleManager.resumeResize(); }

  setFireConfig(config: Partial<FireOverlayConfig>): void {
    this.effectSystem.setFireConfig(config);
  }

  getFireConfig(): FireOverlayConfig {
    return this.effectSystem.getFireConfig();
  }

  setLedConfig(config: Partial<LedOverlayConfig>): void {
    this.effectSystem.setLedConfig(config);
  }

  getLedConfig(): LedOverlayConfig {
    return this.effectSystem.getLedConfig();
  }

  setCellTipEffectMap(map: TipEffectMap | undefined): void {
    this.effectSystem.setCellTipEffectMap(map);
  }

  setCellTipEffortMap(map: TipEffortMap | undefined): void {
    this.effectSystem.setCellTipEffortMap(map);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private initializeTrailCapturer(props: AnimationEngineProps): void {
    const trailCapturer = this.lifecycleManager.trailCapturer;
    if (!trailCapturer || !this.settingsLoaded) return;

    // Use external trail settings if provided, otherwise use internal state
    const effectiveTrailSettings =
      props.externalTrailSettings ?? this.state.trailSettings;

    // Also update internal state if external settings provided
    if (props.externalTrailSettings) {
      this.state.setTrailSettings(props.externalTrailSettings);
    }

    trailCapturer.initialize({
      canvasSize: this.canvasSize,
      bluePropDimensions: this.state.bluePropDimensions,
      redPropDimensions: this.state.redPropDimensions,
      trailSettings: this.frameSystem.enforceUnilateralConstraint(
        effectiveTrailSettings,
        this.state.currentBluePropType,
        this.state.currentRedPropType
      ),
      bluePropType: this.state.currentBluePropType,
      redPropType: this.state.currentRedPropType,
    });

    this.lifecycleManager.trailSettingsSync?.initialize(trailCapturer, () =>
      this.lifecycleManager.renderLoop?.triggerRender(() =>
        this.frameSystem.buildFrameParams(props, this.buildFrameDeps())
      )
    );

    // CRITICAL: Immediately sync external settings after initializing the sync service
    if (props.externalTrailSettings) {
      this.lifecycleManager.trailSettingsSync?.handleExternalSettingsSync(
        props.externalTrailSettings
      );
    }
  }

  /**
   * Handle visibility state changes from the subscription.
   * This was previously an inline closure inside initialize().
   */
  private handleVisibilityChange(state: AnimationVisibilityState): void {
    this.state.setVisibilityState(state);

    const vm = this.getVM();

    // Sync Dark Mode to renderer when it changes
    if (state.darkMode !== this.propSystem.prevDarkMode && !this.previewDarkModeActive) {
      this.propSystem.setPrevDarkMode(state.darkMode);
      this.lifecycleManager.animationRenderer?.setDarkMode(state.darkMode);

      if (this.state.isInitialized) {
        this.lifecycleManager.renderLoop?.triggerRender(() =>
          this.frameSystem.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS, this.buildFrameDeps())
        );

        this.propSystem.reloadTexturesForDarkMode(() => {
          this.lifecycleManager.renderLoop?.triggerRender(() =>
            this.frameSystem.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS, this.buildFrameDeps())
          );
        });
      }
    }

    // Trigger render when trails visibility changes
    const trailsInMap = hasEffectInMap(this.effectSystem.effectsConfigState?.tipEffectMap, "trails");
    if (trailsInMap !== this.prevTrailsActive) {
      const trailsTurnedOff = this.prevTrailsActive && !trailsInMap;
      this.prevTrailsActive = trailsInMap;

      if (trailsTurnedOff && this.effectSystem.trailOverlay) {
        this.effectSystem.trailOverlay.clear();
        this.effectSystem.trailOverlay.setVisible(false);
      } else if (trailsInMap && this.effectSystem.trailOverlay) {
        this.effectSystem.trailOverlay.setVisible(true);
      }

      if (this.state.isInitialized) {
        this.lifecycleManager.renderLoop?.triggerRender(() =>
          this.frameSystem.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS, this.buildFrameDeps())
        );
      }
    }

    // Trigger render when props visibility changes
    if (state.props !== this.prevPropsVisible) {
      const becameVisible = state.props && !this.prevPropsVisible;
      this.prevPropsVisible = state.props;

      if (becameVisible) {
        this.lifecycleManager.trailCapturer?.clearTrails();
      }

      if (this.state.isInitialized) {
        this.lifecycleManager.renderLoop?.triggerRender(() =>
          this.frameSystem.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS, this.buildFrameDeps())
        );
      }
    }

    // Delegate all effect-specific sync to EffectSystem
    this.effectSystem.syncEffects(state, vm);

    // Path shape or hybrid mode changed.
    const pathShape = vm.getPathShape();
    const motionAwarePaths = vm.getMotionAwarePaths();
    if (pathShape !== this.prevPathShape || motionAwarePaths !== this.prevMotionAwarePaths) {
      this.prevPathShape = pathShape;
      this.prevMotionAwarePaths = motionAwarePaths;

      this.effectSystem.fireTipTracker?.reset();

      if (this.effectSystem.fireRenderer?.isInitialized()) {
        this.effectSystem.fireRenderer.clearSimulation();
      }
      if (this.effectSystem.charcoalRenderer?.isInitialized()) {
        this.effectSystem.charcoalRenderer.clearSimulation();
      }

      this.lifecycleManager.trailCapturer?.clearTrails();

      this.lifecycleManager.precomputer?.clearCaches();
      this.lifecycleManager.renderLoop?.updateConfig({ pathCache: null });

      if (
        this.lifecycleManager.precomputer &&
        this.state.trailSettings.usePathCache &&
        this.prevSequenceData
      ) {
        const totalSteps = this.prevSequenceData.steps.length;
        const stepDurationMs = 1000;
        this.lifecycleManager.precomputer
          .precomputeAnimationPaths(
            this.prevSequenceData,
            totalSteps,
            stepDurationMs,
            this.state.trailSettings
          )
          .then(() => {
            const pathCache = this.lifecycleManager.precomputer?.getPathCache();
            if (pathCache && this.lifecycleManager.renderLoop) {
              this.lifecycleManager.renderLoop.updateConfig({ pathCache });
              this.lifecycleManager.trailCapturer?.clearTrails();
            }
          })
          .catch(() => {
            // Precomputation failed - real-time capture continues
          });
      }

      if (this.state.isInitialized) {
        this.lifecycleManager.renderLoop?.triggerRender(() =>
          this.frameSystem.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS, this.buildFrameDeps())
        );
      }
    }
  }

  private syncServiceState(): void {
    const precomputer = this.lifecycleManager.precomputer;
    if (precomputer) {
      const ps = precomputer.state;
      this.state.setPreRendering(ps.isPreRendering);
      this.state.setPreRenderProgress(ps.preRenderProgress);
      this.state.setPreRenderedFramesReady(ps.preRenderedFramesReady);
    }

    // Sync from glyph transition service
    this.frameSystem.syncGlyphState();

    // Sync from prop type service - delegated to PropSystem.
    this.propSystem.syncPropTypeFromChanger();

    // Sync from prop texture service
    const propTextureLoader = this.lifecycleManager.propTextureLoader;
    if (propTextureLoader) {
      const pts = propTextureLoader.state;
      this.state.setBluePropDimensions(pts.blueDimensions);
      this.state.setRedPropDimensions(pts.redDimensions);
    }

    // Sync from resize service (delegated to StateSynchronizer)
    this.canvasSize = this.stateSynchronizer.syncResizeState({
      canvasResizerService: this.lifecycleManager.resizer,
      trailCapturer: this.lifecycleManager.trailCapturer,
      renderLoopService: this.lifecycleManager.renderLoop,
      effectRendererManager: this.effectSystem.rendererManager,
    });
  }

  /**
   * Shallow comparison of trail settings (faster than JSON.stringify)
   */
  private trailSettingsChanged(a: TrailSettings, b: TrailSettings): boolean {
    return (
      a.mode !== b.mode ||
      a.effect !== b.effect ||
      a.fadeDurationMs !== b.fadeDurationMs ||
      a.maxPoints !== b.maxPoints ||
      a.lineWidth !== b.lineWidth ||
      a.glowBlur !== b.glowBlur ||
      a.blueColor !== b.blueColor ||
      a.redColor !== b.redColor ||
      a.minOpacity !== b.minOpacity ||
      a.maxOpacity !== b.maxOpacity ||
      a.trackingMode !== b.trackingMode ||
      a.hideProps !== b.hideProps ||
      a.usePathCache !== b.usePathCache ||
      a.previewMode !== b.previewMode ||
      a.tailLength !== b.tailLength
    );
  }

  /**
   * Build the per-frame deps object passed to FrameSystem.buildFrameParams().
   * Extracted so all call sites share the same construction logic.
   */
  private buildFrameDeps() {
    return {
      effectsConfigState: this.effectSystem.effectsConfigState,
      effectRendererManager: this.effectSystem.rendererManager,
      getVM: () => this.getVM(),
    };
  }
}

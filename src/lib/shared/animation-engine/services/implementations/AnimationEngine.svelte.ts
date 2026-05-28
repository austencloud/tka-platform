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
import { animationSettings as animationSettingsState } from "../../state/animation-settings-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { IAnimationRenderer as AnimationRenderer } from "$lib/shared/animation-engine/services/contracts/IAnimationRenderer";
import type { ISVGGenerator as SVGGenerator } from "$lib/shared/animation-engine/services/contracts/ISVGGenerator";
import type { TurnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
import { type TrailSettings } from "../../domain/types/TrailTypes";
import type { AdditionalLayerProps } from "../../domain/types/TrailCaptureTypes";
import type { AnimationVisibilityState } from "./AnimationVisibilitySynchronizer";
import type { PreRenderProgress } from "$lib/shared/animation-engine/services/implementations/SequenceFramePreRenderer";

import { loadAnimatorServices as loadServices } from "../animator-loader";
import { loadTrailSettings } from "$lib/shared/animation-engine/utils/animation-panel-persistence";
import { TrailCapturer } from "$lib/shared/animation-engine/services/implementations/TrailCapturer";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceAnimationOrchestrator";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/implementations/AnimationStateManager";
import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { TipEffortMap } from "../../domain/types/TipEffectTypes";

// Services
import { CanvasResizer } from "./CanvasResizer.svelte";
import {
  DEFAULT_CANVAS_SIZE,
} from "./CanvasResizer.svelte";
import { PropTextureLoader } from "./PropTextureLoader.svelte";
import {
  DEFAULT_PROP_DIMENSIONS,
  type IPropTextureLoader,
  type PropDimensions,
} from "../contracts/IPropTextureLoader";
import { GlyphTextureLoader } from "./GlyphTextureLoader.svelte";
import type { IGlyphTextureLoader } from "../contracts/IGlyphTextureLoader";
import { AnimationPrecomputer } from "./AnimationPrecomputer.svelte";
import type { IAnimationPrecomputer } from "../contracts/IAnimationPrecomputer";
import { AnimationRenderLoop } from "./AnimationRenderLoop";
import type { IAnimationRenderLoop } from "../contracts/IAnimationRenderLoop";

import { FrameBudgetMonitor } from "./FrameBudgetMonitor";
import { DeviceTierDetector } from "./DeviceTierDetector";
import { AnimationVisibilitySynchronizer } from "./AnimationVisibilitySynchronizer";
import { GlyphTransitionController } from "./GlyphTransitionController.svelte";
import { SequenceCache } from "./SequenceCache.svelte";
import { TrailSettingsSynchronizer } from "./TrailSettingsSynchronizer.svelte";
import { PropTypeChanger } from "./PropTypeChanger.svelte";
import { AnimatorCanvasInitializer } from "./AnimatorCanvasInitializer";
import { FireTipTracker } from "./FireTipTracker";
import type { FireOverlayConfig } from "../../domain/types/FireTypes";
import type { FireDefaultsLoader } from "./FireDefaultsLoader";
import {
  BASE_FIRE_PHYSICS,
  BASE_COLOR_CURVE,
  intensityToPhysics,
} from "../../domain/types/FireTypes";
import { LedTipTracker } from "./LedTipTracker";
import type { LedOverlayConfig } from "../../domain/types/LedTypes";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

import { getPropInterpolator } from "$lib/shared/animation-engine/getPropInterpolator";
import { LiveRenderContext } from "./RenderContext";
import type { RenderContext } from "./RenderContextRegistry";

// Extracted modules
import { EffectRendererManager } from "./EffectRendererManager";
import { FrameParameterBuilder } from "./FrameParameterBuilder";
import { PropTypeManager } from "./PropTypeManager";
import { CanvasLifecycleManager } from "./CanvasLifecycleManager";
import type { EffectType, TipEffectMap } from '../../domain/types/TipEffectTypes';
import type { FireColorCurve } from '../../domain/types/FireTypes';
import { semanticToCharcoalParams, type CharcoalSparkParams } from '../../domain/types/CharcoalSparkTypes';

// ── Effects helper utilities ────────────────────────────────────────────────

/** Returns true if any entry in the map has the given effect type. */
function hasEffectInMap(map: TipEffectMap | undefined, effect: string): boolean {
  if (!map) return false;
  return Object.values(map).some(a => a.effect === effect);
}

/** Extract CharcoalSparkParams from EffectsConfigState, with defaults. */
function getCharcoalParamsFromConfig(ecs: EffectsConfigState | null | undefined): CharcoalSparkParams {
  if (!ecs) {
    return semanticToCharcoalParams({ intensity: 0.5, spread: 0.5, glow: 0.6 });
  }
  const { intensity, spread, glow, coreColor, midColor, coolColor } = ecs.charcoal;
  return semanticToCharcoalParams({ intensity, spread, glow }, { coreColor, midColor, coolColor });
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

/**
 * State exposed to component via $derived
 */
export interface AnimationEngineState {
  // Loading/error state
  rendererLoading: boolean;
  rendererError: string | null;
  isInitialized: boolean;
  servicesReady: boolean;

  // Visibility state
  visibilityState: AnimationVisibilityState;

  // Pre-computation state
  isPreRendering: boolean;
  preRenderProgress: PreRenderProgress | null;
  preRenderedFramesReady: boolean;

  // Glyph transition state
  displayedLetter: Letter | null;
  displayedTurnsTuple: string;
  displayedStepNumber: number | null;
  displayedMusicalPosition: string | null;
  fadingOutLetter: Letter | null;
  fadingOutTurnsTuple: string | null;
  fadingOutStepNumber: number | null;
  isNewLetter: boolean;

  // Trail settings (can be synced back to component)
  trailSettings: TrailSettings;

  // Prop dimensions for rendering
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;

  // Prop types from settings
  currentBluePropType: string;
  currentRedPropType: string;
  currentPropType: string;

  // 3D mode flag - when true, 2D effect overlays (fire/charcoal/LED/trails) are suppressed
  suppress2DOverlays: boolean;

  // Viewer-scoped motion visibility (not stored in AnimationVisibilityState)
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

export class AnimationEngine {
  // ============================================================================
  // REACTIVE STATE - Component derives from this
  // ============================================================================
  state = $state<AnimationEngineState>({
    rendererLoading: false,
    rendererError: null,
    isInitialized: false,
    servicesReady: false,
    visibilityState: {
      grid: true,
      stepNumbers: true,
      props: true,
      trails: true,
      tkaGlyph: true, // TKA Glyph includes turn numbers
      darkMode: false,
      wordHeader: true,
      activeEffect: "trails" as EffectType,
      tipEffectMap: {} as TipEffectMap,
    },
    isPreRendering: false,
    preRenderProgress: null,
    preRenderedFramesReady: false,
    displayedLetter: null,
    displayedTurnsTuple: "(s, 0, 0)",
    displayedStepNumber: null,
    displayedMusicalPosition: null,
    fadingOutLetter: null,
    fadingOutTurnsTuple: null,
    fadingOutStepNumber: null,
    isNewLetter: false,
    trailSettings: loadTrailSettings(),
    bluePropDimensions: DEFAULT_PROP_DIMENSIONS,
    redPropDimensions: DEFAULT_PROP_DIMENSIONS,
    currentBluePropType: "staff",
    currentRedPropType: "staff",
    currentPropType: "staff",
    suppress2DOverlays: false,
    blueMotionVisible: true,
    redMotionVisible: true,
  });

  // ============================================================================
  // EXTRACTED MODULES
  // ============================================================================
  private readonly effectRendererManager = new EffectRendererManager();
  private readonly frameParameterBuilder = new FrameParameterBuilder();
  private readonly propTypeManager = new PropTypeManager();
  private readonly lifecycleManager = new CanvasLifecycleManager();

  // ============================================================================
  // PRIVATE SERVICES
  // ============================================================================
  private svgGenerator: SVGGenerator | null = null;
  private settingsService: SettingsState | null = null;
  private orchestrator: SequenceAnimationOrchestrator | null = null;
  private trailCapturer: TrailCapturer | null = null;
  private turnsTupleGenerator: TurnsTupleGenerator | null = null;
  private animationRenderer: AnimationRenderer | null = null;

  private canvasResizerService: CanvasResizer | null = null;
  private propTextureService: IPropTextureLoader | null = null;
  private glyphTextureService: IGlyphTextureLoader | null = null;
  private precomputationService: IAnimationPrecomputer | null = null;
  private renderLoopService: IAnimationRenderLoop | null = null;
  private visibilitySyncService: AnimationVisibilitySynchronizer | null = null;
  private glyphTransitionService: GlyphTransitionController | null = null;
  private sequenceCacheService: SequenceCache | null = null;
  private trailSettingsSyncService: TrailSettingsSynchronizer | null = null;
  private propTypeChangeService: PropTypeChanger | null = null;
  private canvasInitializer = new AnimatorCanvasInitializer();
  private frameBudgetMonitor: FrameBudgetMonitor =
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

  private prevDarkMode: boolean = false;
  private previewDarkModeActive: boolean = false; // true when previewDarkMode prop overrides global
  private prevTrailsActive: boolean = true;
  private prevPropsVisible: boolean = true;
  private prevColorBlend: number = 0.5;
  private prevFireIntensity: number = 0.7;
  private prevFireTurbulence: number = 0.5;
  private prevFireColorCurve: FireColorCurve | null = null;
  private prevCharcoalParamsJson: string = "";
  private prevEffortPreset: EffortId = "linear";
  private prevPathShape: "arc" | "linear" | "concave" = "arc";
  private prevMotionAwarePaths: boolean = false;

  /** Per-performer effort resolver. When set, getEffortForPerformer() calls it
   *  instead of reading the global visibility manager. */
  private _performerEffortResolver: ((performerId: string) => EffortId) | null = null;

  // Live effects config state (zap intent, plus other intents in later phases).
  // Wired by the host via setEffectsConfigState() before initialize() runs.
  // Optional - when null, zapConfig stays at defaults (sequence viewer, etc.).
  private effectsConfigState: EffectsConfigState | null = null;

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
    this.effectsConfigState = state;
    this.effectRendererManager.effectsConfigState = state;
    if (this.visibilitySyncService) {
      this.visibilitySyncService.effectsConfigState = state;
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
    this.state.blueMotionVisible = blue;
    this.state.redMotionVisible = red;
    if (this.state.isInitialized) {
      this.renderLoopService?.triggerRender(() =>
        this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
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
   * Initialize the engine with a container element
   */
  async initialize(
    containerElement: HTMLDivElement,
    callbacks: AnimationEngineCallbacks = {}
  ): Promise<void> {
    this.containerElement = containerElement;
    this.callbacks = callbacks;

    this.lifecycleManager.setCanvasInitializer(this.canvasInitializer);
    this.lifecycleManager.setEffectManager(this.effectRendererManager);

    // Initialize visibility manager
    const vm = this.getVM();
    const ecs = this.effectsConfigState;
    this.prevDarkMode = vm.isDarkMode();
    this.prevTrailsActive = hasEffectInMap(ecs?.tipEffectMap, "trails");
    this.prevPropsVisible = vm.getVisibility("props");
    this.prevColorBlend = ecs?.fire.colorBlend ?? 0.5;
    this.prevFireIntensity = ecs?.fire.intensity ?? 0.7;
    this.prevCharcoalParamsJson = JSON.stringify(getCharcoalParamsFromConfig(ecs));
    this.prevEffortPreset = vm.getEffortPreset();

    // Initialize effect renderer manager's prev* flags from EffectsConfigState
    const erm = this.effectRendererManager;
    erm.prevHasFireTips = hasEffectInMap(ecs?.tipEffectMap, "fire");
    erm.prevHasCharcoalTips = hasEffectInMap(ecs?.tipEffectMap, "charcoal");
    erm.prevHasZapTips = hasEffectInMap(ecs?.tipEffectMap, "zap");
    erm.prevHasSparklesTips = hasEffectInMap(ecs?.tipEffectMap, "sparkles");
    erm.prevHasEchoTips = hasEffectInMap(ecs?.tipEffectMap, "echo");
    erm.prevHasBloomTips = hasEffectInMap(ecs?.tipEffectMap, "bloom");
    erm.prevHasWaterTips = hasEffectInMap(ecs?.tipEffectMap, "water");
    erm.prevHasBubblesTips = hasEffectInMap(ecs?.tipEffectMap, "bubbles");
    erm.prevHasPetalsTips = hasEffectInMap(ecs?.tipEffectMap, "petals");
    erm.prevHasSmokeTips = hasEffectInMap(ecs?.tipEffectMap, "smoke");
    erm.prevHasInkTips = hasEffectInMap(ecs?.tipEffectMap, "ink");
    erm.prevHasFrostTips = hasEffectInMap(ecs?.tipEffectMap, "frost");
    erm.prevHasSilkTips = hasEffectInMap(ecs?.tipEffectMap, "silk");
    erm.prevHasPulseTips = hasEffectInMap(ecs?.tipEffectMap, "pulse");

    // fireDefaultsLoader - load on demand via getter
    try {
      const { getFireDefaultsLoader } = await import("$lib/shared/animation-engine/getFireDefaultsLoader");
      this.fireDefaultsLoader = getFireDefaultsLoader();
    } catch {
      console.warn("[AnimationEngine] Fire defaults loader not available");
    }

    // Build fireConfig from base params + slider mappings
    this.prevFireTurbulence = ecs?.fire.turbulence ?? 0.5;
    erm.fireConfig.colorBlend = this.prevColorBlend;
    erm.fireConfig.intensity = this.prevFireIntensity;
    erm.fireConfig.flameHeight = this.prevFireIntensity;
    erm.fireConfig.turbulence = this.prevFireTurbulence;
    erm.fireConfig.fuelRendererType = "fluid";

    const basePhysics = BASE_FIRE_PHYSICS;
    const intensityOverrides = intensityToPhysics(this.prevFireIntensity);
    erm.fireConfig.physicsPreset = {
      ...basePhysics,
      ...intensityOverrides,
    };
    erm.fireConfig.colorCurve = ecs?.fire.colorCurve ?? BASE_COLOR_CURVE;
    erm.fireConfig.charcoalParams = getCharcoalParamsFromConfig(ecs);

    // Initialize LED state from EffectsConfigState
    erm.initLedConfigFromEffectsState(ecs);

    this.state.visibilityState = {
      grid: vm.getGridMode() !== "none",
      stepNumbers: vm.getVisibility("stepNumbers"),
      props: vm.getVisibility("props"),
      trails: hasEffectInMap(ecs?.tipEffectMap, "trails"),
      tkaGlyph: vm.getVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      darkMode: vm.isDarkMode(),
      wordHeader: vm.getVisibility("wordHeader"),
      activeEffect: (ecs?.activeEffect ?? "none") as EffectType,
      tipEffectMap: ecs?.tipEffectMap ?? {},
    };

    // Initialize services that don't need renderer
    this.visibilitySyncService = new AnimationVisibilitySynchronizer(this.visibilityManagerOverride ?? undefined);
    this.visibilitySyncService.effectsConfigState = this.effectsConfigState;
    this.unsubscribeVisibility = this.visibilitySyncService.subscribe(
      (state) => this.handleVisibilityChange(state)
    );
    this.lifecycleManager.setVisibilitySyncService(this.visibilitySyncService);
    this.lifecycleManager.setUnsubscribeVisibility(this.unsubscribeVisibility);

    this.glyphTransitionService = new GlyphTransitionController();
    this.lifecycleManager.setGlyphTransitionService(this.glyphTransitionService);
    this.sequenceCacheService = new SequenceCache();
    this.lifecycleManager.setSequenceCacheService(this.sequenceCacheService);
    this.trailSettingsSyncService = new TrailSettingsSynchronizer();
    this.lifecycleManager.setTrailSettingsSyncService(this.trailSettingsSyncService);
    this.propTypeChangeService = new PropTypeChanger();
    this.lifecycleManager.setPropTypeChangeService(this.propTypeChangeService);

    // Initialize canvas (async process)
    await this.initializeCanvas();

    // Sync previousGridMode with the grid texture loaded during initialization,
    // so the change-detection in update() doesn't redundantly reload the same texture.
    const initGridMode = this.lastPropsRef?.gridMode?.toString() ?? "diamond";
    this.previousGridMode = initGridMode;
    this.previousShowNonRadialPoints = this.lastPropsRef?.showNonRadialPoints ?? true;

    // Wire overlay renderers that may have been created during the async
    // initializeCanvas gap.
    erm.wirePostInitOverlays();

    // Create overlays that weren't created yet (e.g. enabled before HMR/reload
    // but the $effect hasn't triggered, or the rAF hasn't fired yet).
    erm.ensureEnabledOverlays();
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
      this.settingsService?.currentSettings ||
      props.externalTrailSettings !== undefined;

    if (shouldInitTrailCapturer && this.trailCapturer && !this.trailCapturerInitialized) {
      if (!this.settingsLoaded) {
        this.settingsLoaded = true;
      }
      this.initializeTrailCapturer(props);
      this.trailCapturerInitialized = true;
    }

    // Handle prop type changes
    const hasOverrides =
      props.bluePropType != null || props.redPropType != null;

    const getFrameParamsFn = () => this.buildFrameParams(props);

    if (hasOverrides) {
      this.propTypeManager.handleOverrides(
        props,
        this.state,
        getFrameParamsFn,
        this.prevDarkMode
      );
    } else {
      this.propTypeManager.handleSettingsChange(
        this.state,
        getFrameParamsFn,
        this.prevDarkMode
      );
    }

    // Handle additional layer prop textures for tunnel mode
    this.propTypeManager.handleAdditionalLayers(props, this.state, getFrameParamsFn);

    // Handle trail settings changes - enforce unilateral constraint before syncing
    if (props.externalTrailSettings !== undefined) {
      this.trailSettingsSyncService?.handleExternalSettingsSync(
        this.frameParameterBuilder.enforceUnilateralConstraint(
          props.externalTrailSettings,
          this.state.currentBluePropType,
          this.state.currentRedPropType
        )
      );
    }

    // Handle synced trail settings from service
    const syncedSettings = this.trailSettingsSyncService?.state.syncedSettings;
    if (syncedSettings) {
      // Only update and notify if settings actually changed (shallow comparison - faster than JSON.stringify)
      const settingsChanged = this.trailSettingsChanged(
        this.state.trailSettings,
        syncedSettings
      );

      // CRITICAL: Only write to $state if settings actually changed to prevent infinite loops
      // In Svelte 5, assigning to a $state property triggers reactivity even for same value
      if (settingsChanged) {
        this.state.trailSettings = syncedSettings;

        // Only call handleSettingsChange if we're NOT using external settings
        // (external settings flow: parent -> engine; internal settings flow: engine -> parent)
        if (props.externalTrailSettings === undefined) {
          this.trailSettingsSyncService?.handleSettingsChange(
            this.state.trailSettings,
            false
          );
        }

        // Notify parent of the change
        this.callbacks.onTrailSettingsChange?.(syncedSettings);
      }
    }

    // Handle sequence changes
    this.sequenceCacheService?.handleSequenceChange(props.sequenceData ?? null);

    // Detect sequence content changes and re-initialize orchestrator if needed
    if (props.sequenceData && this.orchestrator) {
      const newHash = this.frameParameterBuilder.getSequenceContentHash(props.sequenceData);
      if (newHash !== this.frameParameterBuilder.lastSequenceContentHash) {
        this.orchestrator.initializeWithDomainData(props.sequenceData);
        this.frameParameterBuilder.lastSequenceContentHash = newHash;

        // Flush stale trail data so old ring buffer points don't draw
        // artifact lines to the new prop positions.
        this.effectRendererManager.trailOverlay?.clearBuffers();
        this.effectRendererManager.fireTipTracker?.reset();
        this.effectRendererManager.fireRenderer?.clearSimulation();
        this.effectRendererManager.charcoalRenderer?.clearSimulation();

        // Trigger path cache precomputation for smooth trails during stutters
        if (
          this.state.trailSettings.usePathCache &&
          this.precomputationService
        ) {
          const totalSteps = props.sequenceData.steps.length;
          const stepDurationMs = 1000;

          this.precomputationService
            .precomputeAnimationPaths(
              props.sequenceData,
              totalSteps,
              stepDurationMs,
              this.state.trailSettings
            )
            .then(() => {
              const pathCache = this.precomputationService?.getPathCache();
              if (pathCache && this.renderLoopService) {
                this.renderLoopService.updateConfig({ pathCache });
              }
            })
            .catch((err) => {
              console.error(`[TRANSFORM-DIAG] Precomputation FAILED:`, err);
            });
        }
      }
    }

    // Handle cache clear signals (only process once per signal)
    const clearSignal = this.sequenceCacheService?.state.clearSignal ?? 0;
    if (clearSignal > this.lastClearSignal) {
      this.precomputationService?.clearCaches();
      if (!this.effectRendererManager.trailOverlay) {
        this.trailCapturer?.clearTrails();
      }
      this.cacheSequenceId = null;
      this.lastClearSignal = clearSignal;
    }

    // Handle pre-render clear signals (only process once per signal)
    const preRenderClearSignal =
      this.sequenceCacheService?.state.preRenderClearSignal ?? 0;
    if (preRenderClearSignal > this.lastPreRenderClearSignal) {
      this.precomputationService?.clearPreRenderedFrames();
      this.lastPreRenderClearSignal = preRenderClearSignal;
    }

    // Sync pre-rendered frames flag
    this.sequenceCacheService?.setHasPreRenderedFrames(
      this.precomputationService?.state.preRenderedFramesReady ?? false
    );

    // Handle playback changes
    this.sequenceCacheService?.handlePlaybackChange(props.isPlaying ?? false);

    // Handle grid mode changes (also reload when nonradial visibility changes)
    const currentGridMode = props.gridMode?.toString() ?? null;
    const currentShowNonRadial = props.showNonRadialPoints ?? true;
    if (
      this.state.isInitialized &&
      this.animationRenderer &&
      (currentGridMode !== this.previousGridMode ||
        currentShowNonRadial !== this.previousShowNonRadialPoints)
    ) {
      this.previousGridMode = currentGridMode;
      this.previousShowNonRadialPoints = currentShowNonRadial;
      this.animationRenderer
        .loadGridTexture(currentGridMode ?? "diamond", currentShowNonRadial)
        .then(() => {
          this.renderLoopService?.triggerRender(() =>
            this.buildFrameParams(props)
          );
        });
    }

    // Handle preview dark mode override
    if (props.previewDarkMode !== undefined && props.previewDarkMode !== null) {
      this.previewDarkModeActive = true;
      const previewDarkMode = props.previewDarkMode;
      if (previewDarkMode !== this.prevDarkMode) {
        this.prevDarkMode = previewDarkMode;
        this.animationRenderer?.setDarkMode(previewDarkMode);

        if (this.state.isInitialized) {
          this.renderLoopService?.triggerRender(() =>
            this.buildFrameParams(props)
          );

          this.propTypeManager.loadPropTextures(this.state, this.prevDarkMode).then(() => {
            this.renderLoopService?.triggerRender(() =>
              this.buildFrameParams(props)
            );
          });
        }
      }
    } else {
      this.previewDarkModeActive = false;
    }

    // Update trail capturer with prop type and loopability changes
    if (this.trailCapturer && this.settingsLoaded) {
      this.trailCapturer.updateConfig({
        bluePropType: this.state.currentBluePropType,
        redPropType: this.state.currentRedPropType,
        isSeamlesslyLoopable: props.isSeamlesslyLoopable,
      });
    }

    // Update glyph transition
    const stepNumber = this.calculateBeatNumber(props);
    const turnsTuple = this.calculateTurnsTuple(props);
    const musicalPosition = this.calculateMusicalPosition(props);
    this.glyphTransitionService?.updateTarget(
      props.letter ?? null,
      turnsTuple,
      stepNumber,
      musicalPosition
    );

    // Sync glyph state immediately after update so component sees new values
    if (this.glyphTransitionService) {
      this.state.displayedLetter =
        this.glyphTransitionService.state.displayedLetter;
      this.state.displayedTurnsTuple =
        this.glyphTransitionService.state.displayedTurnsTuple;
      this.state.displayedStepNumber =
        this.glyphTransitionService.state.displayedStepNumber;
      this.state.displayedMusicalPosition =
        this.glyphTransitionService.state.displayedMusicalPosition;
      this.state.fadingOutLetter =
        this.glyphTransitionService.state.fadingOutLetter;
      this.state.fadingOutTurnsTuple =
        this.glyphTransitionService.state.fadingOutTurnsTuple;
      this.state.fadingOutStepNumber =
        this.glyphTransitionService.state.fadingOutStepNumber;
      this.state.isNewLetter = this.glyphTransitionService.state.isNewLetter;
    }

    // Trigger render if initialized
    if (this.state.isInitialized) {
      this.renderLoopService?.triggerRender(() => this.buildFrameParams(props));
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
    this.glyphTextureService?.handleGlyphSvgReady(
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
    if (
      this.state.isInitialized &&
      this.glyphTextureService?.getPendingGlyph() &&
      this.animationRenderer
    ) {
      this.glyphTextureService.processPendingGlyph();
    }
  }

  /**
   * Set target FPS for preview throttling.
   * null = render at native refresh rate (no throttling).
   */
  setTargetFps(fps: number | null): void {
    this.renderLoopService?.setTargetFps(fps);
  }

  /**
   * Invalidate the fire frame cache so the simulation re-records from scratch.
   * Call after video export (which uses jumpToStep frame-by-frame) to prevent
   * stale cached fire frames from replaying when normal playback resumes.
   */
  invalidateFireCache(): void {
    this.effectRendererManager.fireRenderer?.clearSimulation();
    this.effectRendererManager.charcoalRenderer?.clearSimulation();
    this.effectRendererManager.ledRenderer?.resetExportState();
  }

  /**
   * Invalidate the fire frame cache without clearing simulation FBOs.
   * Use before video export so the cache records fresh frames while the
   * Navier-Stokes simulation retains its warm (steady-state) fluid fields.
   */
  invalidateFireFrameCacheOnly(): void {
    this.effectRendererManager.fireRenderer?.invalidateFrameCache();
  }

  clearFireThermalFields(): void {
    this.effectRendererManager.fireRenderer?.clearThermalFields();
    // Charcoal is particle-based, not fluid-sim — full clear is fine
    this.effectRendererManager.charcoalRenderer?.clearSimulation();
    this.effectRendererManager.ledRenderer?.resetExportState();
  }

  // --- EXPORT DIAGNOSTIC (remove after debugging) ---
  getLedRenderer() { return this.effectRendererManager.ledRenderer; }

  enableFireDiagnostics(): void {
    this.effectRendererManager.fireRenderer?.enableDiagnostics();
  }
  disableFireDiagnostics(): void {
    this.effectRendererManager.fireRenderer?.disableDiagnostics();
  }
  resetFireDiagnosticCounter(): void {
    this.effectRendererManager.fireRenderer?.resetDiagnosticCounter?.();
  }
  sampleFireCanvas(): string {
    return this.effectRendererManager.fireRenderer?.sampleFireCanvas?.() ?? 'no fire renderer';
  }
  snapshotFireCanvas(): void {
    this.effectRendererManager.fireRenderer?.snapshotFireCanvas?.();
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

    return {
      timestamp: new Date().toISOString(),
      performanceNow: performance.now(),
      instanceId: this.instanceId,
      engineState: {
        isInitialized: this.state.isInitialized,
        isPlaying: lastProps?.isPlaying ?? false,
        currentStep: lastProps?.currentStep ?? 0,
        canvasSize: this.canvasSize,
      },
      visibility: {
        activeEffect: this.effectsConfigState?.activeEffect ?? "none",
        tipEffectMap: this.effectsConfigState?.tipEffectMap ?? {},
        effortPreset: settings.effortPreset,
        pathShape: settings.pathShape,
      },
      fireConfig: this.effectRendererManager.fireConfig,
      renderLoop: this.renderLoopService?.getDiagnostics() ?? null,
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
    const canvas = this.animationRenderer?.getCanvas();
    if (!canvas || !this.renderLoopService || !this.trailCapturer || !this.canvasResizerService) {
      return null;
    }

    return new LiveRenderContext({
      id,
      canvas,
      container,
      renderer: this.animationRenderer!,
      effectManager: this.effectRendererManager,
      trailCapturer: this.trailCapturer,
      renderLoop: this.renderLoopService,
      resizer: this.canvasResizerService,
      precomputer: this.precomputationService!,
    });
  }

  dispose(): void {
    this.lifecycleManager.dispose({
      onCanvasReady: (canvas) => this.callbacks.onCanvasReady?.(canvas),
      onInitialized: (initialized) => { this.state.isInitialized = initialized; },
    });

    this.containerElement = null;
    this.lastPropsRef = null;
    this.prevStepData = null;
    this.prevSequenceData = null;
    this.frameParameterBuilder.resetHandPresenceCache();
  }

  pauseResize(): void { this.lifecycleManager.pauseResize(); }
  resumeResize(): void { this.lifecycleManager.resumeResize(); }

  /**
   * Set fire overlay configuration. Called by visibility state changes.
   */
  setFireConfig(config: Partial<FireOverlayConfig>): void {
    this.effectRendererManager.setFireConfig(config);
  }

  /**
   * Get current fire overlay configuration.
   */
  getFireConfig(): FireOverlayConfig {
    return this.effectRendererManager.getFireConfig();
  }

  /**
   * Set LED overlay configuration. Called by visibility state changes.
   */
  setLedConfig(config: Partial<LedOverlayConfig>): void {
    this.effectRendererManager.setLedConfig(config);
  }

  /**
   * Get current LED overlay configuration.
   */
  getLedConfig(): LedOverlayConfig {
    return this.effectRendererManager.getLedConfig();
  }

  /**
   * Set per-cell tip effect map.
   */
  setCellTipEffectMap(map: TipEffectMap | undefined): void {
    this.effectRendererManager.setCellTipEffectMap(map);
  }

  /**
   * Set per-cell tip effort map.
   */
  setCellTipEffortMap(map: TipEffortMap | undefined): void {
    this.effectRendererManager.setCellTipEffortMap(map);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async initializeCanvas(): Promise<void> {
    if (!this.containerElement) return;

    const initialGridMode = this.lastPropsRef?.gridMode ?? GridMode.DIAMOND;
    const initialShowNonRadial = this.lastPropsRef?.showNonRadialPoints ?? true;

    await this.canvasInitializer.initialize(
      {
        containerElement: this.containerElement,
        backgroundAlpha: 1,
        gridMode: initialGridMode,
        showNonRadialPoints: initialShowNonRadial,
        loadAnimatorServices: () => this.loadAnimatorServices(),
        initializePrecomputationService: () => {
          this.initializePrecomputationService();
          this.precomputationService?.initializeFramePreRenderer();
        },
        initializePropTextureLoader: () => {
          this.initializePropTextureLoader();
          this.propTypeManager.updateRefs({ propTextureService: this.propTextureService });
        },
        initializeResizeService: () => {
          this.initializeResizeService();
          this.canvasResizerService?.setup();
        },
        initializeGlyphTextureLoader: () => this.initializeGlyphTextureLoader(),
        initializeRenderLoopService: () => this.initializeRenderLoopService(),
        loadPropTextures: () => this.propTypeManager.loadPropTextures(this.state, this.prevDarkMode),
        startRenderLoop: () =>
          this.renderLoopService?.triggerRender(() =>
            this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
          ),
      },
      {
        onPixiLoading: (loading) => {
          this.state.rendererLoading = loading;
        },
        onPixiError: (error) => {
          this.state.rendererError = error;
        },
        onPixiRendererReady: (renderer) => {
          this.animationRenderer = renderer;
          renderer.setDarkMode(this.prevDarkMode, false);
        },
        onInitialized: (initialized) => {
          this.state.isInitialized = initialized;
        },
        onCanvasReady: (canvas) => {
          this.callbacks.onCanvasReady?.(canvas);
        },
      }
    );
  }

  private async loadAnimatorServices(): Promise<boolean> {
    const result = await loadServices();

    if (!result.success) {
      this.state.rendererError =
        result.error || "Failed to load animator services";
      return false;
    }

    const { services } = result;
    if (!services.svgGenerator) {
      this.state.rendererError = "Failed to load SVG generator service";
      return false;
    }
    if (!services.TrailCapturer) {
      this.state.rendererError = "Failed to load trail capture service";
      return false;
    }

    this.svgGenerator = services.svgGenerator;
    this.settingsService = services.settingsService;
    this.orchestrator = new SequenceAnimationOrchestrator(
      new AnimationStateManager(),
      getPropInterpolator()
    );
    if (this.visibilityManagerOverride) {
      this.orchestrator.setVisibilityManager(this.visibilityManagerOverride);
    }
    this.trailCapturer = new TrailCapturer();
    this.lifecycleManager.setTrailCapturer(this.trailCapturer);
    this.turnsTupleGenerator = services.turnsTupleGenerator;
    this.state.servicesReady = true;
    return true;
  }

  private initializePrecomputationService(): void {
    if (!this.orchestrator) return;

    this.precomputationService = new AnimationPrecomputer();
    this.lifecycleManager.setPrecomputer(this.precomputationService);
    this.precomputationService.initialize({
      orchestrator: this.orchestrator,
      TrailCapturer: this.trailCapturer,
      renderer: this.animationRenderer,
      propDimensions: this.state.bluePropDimensions,
      canvasSize: this.canvasSize,
      instanceId: this.instanceId,
    });
  }

  private initializePropTextureLoader(): void {
    if (!this.animationRenderer || !this.svgGenerator) {
      this.state.rendererError =
        "Cannot initialize PropTextureLoader: missing dependencies";
      return;
    }

    this.propTextureService = new PropTextureLoader();
    this.lifecycleManager.setPropTextureService(this.propTextureService);
    this.propTextureService.initialize(
      this.animationRenderer,
      this.svgGenerator,
      this.trailCapturer
    );
  }

  private initializeResizeService(): void {
    if (!this.containerElement || !this.animationRenderer) return;

    this.canvasResizerService = new CanvasResizer();
    this.lifecycleManager.setResizer(this.canvasResizerService);
    this.canvasResizerService.initialize(
      this.containerElement,
      this.animationRenderer
    );
  }

  private initializeGlyphTextureLoader(): void {
    if (!this.animationRenderer) return;

    this.glyphTextureService = new GlyphTextureLoader();
    this.lifecycleManager.setGlyphTextureService(this.glyphTextureService);
    this.glyphTextureService.initialize(this.animationRenderer);
  }

  private initializeRenderLoopService(): void {
    if (!this.animationRenderer) return;

    const erm = this.effectRendererManager;

    // Initialize fire/LED tip trackers
    erm.fireTipTracker = new FireTipTracker();
    erm.ledTipTracker = new LedTipTracker();

    this.renderLoopService = new AnimationRenderLoop();
    this.lifecycleManager.setRenderLoop(this.renderLoopService);
    this.renderLoopService.initialize({
      renderer: this.animationRenderer,
      TrailCapturer: this.trailCapturer,
      pathCache: this.precomputationService?.getPathCache() ?? null,
      canvasSize: this.canvasSize,
      frameBudgetMonitor: this.frameBudgetMonitor,
      fireTipTracker: erm.fireTipTracker,
      ledTipTracker: erm.ledTipTracker,
      onEffectError: this.callbacks.onEffectError,
    });

    // Wire effect renderer manager with the render loop
    erm.wire({
      containerElement: this.containerElement!,
      canvasSize: this.canvasSize,
      renderLoopService: this.renderLoopService,
      getFrameParams: () => this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS),
      getVM: () => this.getVM(),
    });
    erm.effectsConfigState = this.effectsConfigState;

    // Wire prop type manager
    this.propTypeManager.wire({
      settingsService: this.settingsService,
      propTextureService: this.propTextureService,
      trailCapturer: this.trailCapturer,
      renderLoopService: this.renderLoopService,
      precomputationService: this.precomputationService,
      propTypeChangeService: this.propTypeChangeService,
      fireTipTracker: erm.fireTipTracker,
      animationRenderer: this.animationRenderer,
    });

    // Create trail overlay
    erm.trailOverlay = erm.createTrailOverlay();
    erm.trailOverlay.initialize(this.containerElement!, this.canvasSize, this.canvasSize);
    this.renderLoopService.updateConfig({ trailOverlay: erm.trailOverlay });
    erm.syncEffectLayers();
  }

  private initializeTrailCapturer(props: AnimationEngineProps): void {
    if (!this.trailCapturer || !this.settingsLoaded) return;

    // Use external trail settings if provided, otherwise use internal state
    const effectiveTrailSettings =
      props.externalTrailSettings ?? this.state.trailSettings;

    // Also update internal state if external settings provided
    if (props.externalTrailSettings) {
      this.state.trailSettings = props.externalTrailSettings;
    }

    this.trailCapturer.initialize({
      canvasSize: this.canvasSize,
      bluePropDimensions: this.state.bluePropDimensions,
      redPropDimensions: this.state.redPropDimensions,
      trailSettings: this.frameParameterBuilder.enforceUnilateralConstraint(
        effectiveTrailSettings,
        this.state.currentBluePropType,
        this.state.currentRedPropType
      ),
      bluePropType: this.state.currentBluePropType,
      redPropType: this.state.currentRedPropType,
    });

    this.trailSettingsSyncService?.initialize(this.trailCapturer, () =>
      this.renderLoopService?.triggerRender(() => this.buildFrameParams(props))
    );

    // CRITICAL: Immediately sync external settings after initializing the sync service
    if (props.externalTrailSettings) {
      this.trailSettingsSyncService?.handleExternalSettingsSync(
        props.externalTrailSettings
      );
    }
  }

  /**
   * Handle visibility state changes from the subscription.
   * This was previously an inline closure inside initialize().
   */
  private handleVisibilityChange(state: AnimationVisibilityState): void {
    this.state.visibilityState = state;

    const erm = this.effectRendererManager;
    const vm = this.getVM();

    // Sync Dark Mode to renderer when it changes
    if (state.darkMode !== this.prevDarkMode && !this.previewDarkModeActive) {
      this.prevDarkMode = state.darkMode;
      this.animationRenderer?.setDarkMode(state.darkMode);

      if (this.state.isInitialized) {
        this.renderLoopService?.triggerRender(() =>
          this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
        );

        this.propTypeManager.loadPropTextures(this.state, this.prevDarkMode).then(() => {
          this.renderLoopService?.triggerRender(() =>
            this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
          );
        });
      }
    }

    // Trigger render when trails visibility changes
    const trailsInMap = hasEffectInMap(this.effectsConfigState?.tipEffectMap, "trails");
    if (trailsInMap !== this.prevTrailsActive) {
      const trailsTurnedOff = this.prevTrailsActive && !trailsInMap;
      this.prevTrailsActive = trailsInMap;

      if (trailsTurnedOff && erm.trailOverlay) {
        erm.trailOverlay.clear();
        erm.trailOverlay.setVisible(false);
      } else if (trailsInMap && erm.trailOverlay) {
        erm.trailOverlay.setVisible(true);
      }

      if (this.state.isInitialized) {
        this.renderLoopService?.triggerRender(() =>
          this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
        );
      }
    }

    // Trigger render when props visibility changes
    if (state.props !== this.prevPropsVisible) {
      const becameVisible = state.props && !this.prevPropsVisible;
      this.prevPropsVisible = state.props;

      if (becameVisible) {
        this.trailCapturer?.clearTrails();
      }

      if (this.state.isInitialized) {
        this.renderLoopService?.triggerRender(() =>
          this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
        );
      }
    }

    // Sync effect toggles - use the effective map (cell-level override
    // takes priority over global VM map) so per-cell assignments properly
    // spin up / tear down overlay renderers.
    erm.syncEffectFlagsFromEffectiveMap();

    // Sync fire slider values + color curve -> physics
    const ecs = this.effectsConfigState;
    const colorBlend = ecs?.fire.colorBlend ?? 0.5;
    const fireIntensity = ecs?.fire.intensity ?? 0.7;
    const fireTurbulence = ecs?.fire.turbulence ?? 0.5;
    const fireColorCurve = ecs?.fire.colorCurve ?? null;

    const slidersChanged =
      colorBlend !== this.prevColorBlend ||
      fireIntensity !== this.prevFireIntensity ||
      fireTurbulence !== this.prevFireTurbulence ||
      fireColorCurve !== this.prevFireColorCurve;

    if (slidersChanged) {
      this.prevColorBlend = colorBlend;
      this.prevFireIntensity = fireIntensity;
      this.prevFireTurbulence = fireTurbulence;
      this.prevFireColorCurve = fireColorCurve;

      const basePhysics = BASE_FIRE_PHYSICS;
      const intOverrides = intensityToPhysics(fireIntensity);
      erm.setFireConfig({
        colorBlend,
        fuelRendererType: "fluid",
        intensity: fireIntensity,
        flameHeight: fireIntensity,
        turbulence: fireTurbulence,
        physicsPreset: {
          ...basePhysics,
          ...intOverrides,
        },
        colorCurve: fireColorCurve ?? BASE_COLOR_CURVE,
      });
    }

    // Reset fire tip tracker when effort preset changes.
    const effortPreset = vm.getEffortPreset();
    if (effortPreset !== this.prevEffortPreset) {
      this.prevEffortPreset = effortPreset;
      erm.fireTipTracker?.reset();
      if (erm.fireRenderer?.isInitialized()) {
        erm.fireRenderer.clearSimulation();
      }
      if (erm.charcoalRenderer?.isInitialized()) {
        erm.charcoalRenderer.clearSimulation();
      }
    }

    // Path shape or hybrid mode changed.
    const pathShape = vm.getPathShape();
    const motionAwarePaths = vm.getMotionAwarePaths();
    if (pathShape !== this.prevPathShape || motionAwarePaths !== this.prevMotionAwarePaths) {
      this.prevPathShape = pathShape;
      this.prevMotionAwarePaths = motionAwarePaths;

      erm.fireTipTracker?.reset();

      if (erm.fireRenderer?.isInitialized()) {
        erm.fireRenderer.clearSimulation();
      }
      if (erm.charcoalRenderer?.isInitialized()) {
        erm.charcoalRenderer.clearSimulation();
      }

      this.trailCapturer?.clearTrails();

      this.precomputationService?.clearCaches();
      this.renderLoopService?.updateConfig({ pathCache: null });

      if (
        this.precomputationService &&
        this.state.trailSettings.usePathCache &&
        this.prevSequenceData
      ) {
        const totalSteps = this.prevSequenceData.steps.length;
        const stepDurationMs = 1000;
        this.precomputationService
          .precomputeAnimationPaths(
            this.prevSequenceData,
            totalSteps,
            stepDurationMs,
            this.state.trailSettings
          )
          .then(() => {
            const pathCache = this.precomputationService?.getPathCache();
            if (pathCache && this.renderLoopService) {
              this.renderLoopService.updateConfig({ pathCache });
              this.trailCapturer?.clearTrails();
            }
          })
          .catch(() => {
            // Precomputation failed - real-time capture continues
          });
      }

      if (this.state.isInitialized) {
        this.renderLoopService?.triggerRender(() =>
          this.buildFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
        );
      }
    }

    // Sync charcoal params independently
    if (erm.prevHasCharcoalTips && erm.charcoalRenderer?.isInitialized()) {
      const currentCharcoalParams = getCharcoalParamsFromConfig(this.effectsConfigState);
      const currentCharcoalJson = JSON.stringify(currentCharcoalParams);
      if (currentCharcoalJson !== this.prevCharcoalParamsJson) {
        this.prevCharcoalParamsJson = currentCharcoalJson;
        erm.charcoalRenderer.setParams(currentCharcoalParams);
      }
    }

    // Sync LED effect from EffectsConfigState
    const ledDiff = erm.diffLedConfigFromEffectsState(this.effectsConfigState);
    if (Object.keys(ledDiff).length > 0) {
      erm.setLedConfig(ledDiff);
    }

    // Sync effect layer ordering
    erm.syncEffectLayers();
  }

  private syncServiceState(): void {
    // PERF: Only write $state properties when the source value actually changed.
    if (this.precomputationService) {
      const ps = this.precomputationService.state;
      if (this.state.isPreRendering !== ps.isPreRendering)
        this.state.isPreRendering = ps.isPreRendering;
      if (this.state.preRenderProgress !== ps.preRenderProgress)
        this.state.preRenderProgress = ps.preRenderProgress;
      if (this.state.preRenderedFramesReady !== ps.preRenderedFramesReady)
        this.state.preRenderedFramesReady = ps.preRenderedFramesReady;
    }

    // Sync from glyph transition service
    if (this.glyphTransitionService) {
      const gs = this.glyphTransitionService.state;
      if (this.state.displayedLetter !== gs.displayedLetter)
        this.state.displayedLetter = gs.displayedLetter;
      if (this.state.displayedTurnsTuple !== gs.displayedTurnsTuple)
        this.state.displayedTurnsTuple = gs.displayedTurnsTuple;
      if (this.state.displayedStepNumber !== gs.displayedStepNumber)
        this.state.displayedStepNumber = gs.displayedStepNumber;
      if (this.state.displayedMusicalPosition !== gs.displayedMusicalPosition)
        this.state.displayedMusicalPosition = gs.displayedMusicalPosition;
      if (this.state.fadingOutLetter !== gs.fadingOutLetter)
        this.state.fadingOutLetter = gs.fadingOutLetter;
      if (this.state.fadingOutTurnsTuple !== gs.fadingOutTurnsTuple)
        this.state.fadingOutTurnsTuple = gs.fadingOutTurnsTuple;
      if (this.state.fadingOutStepNumber !== gs.fadingOutStepNumber)
        this.state.fadingOutStepNumber = gs.fadingOutStepNumber;
      if (this.state.isNewLetter !== gs.isNewLetter)
        this.state.isNewLetter = gs.isNewLetter;
    }

    // Sync from prop type service - but ONLY when overrides are not active.
    if (
      this.propTypeChangeService &&
      this.propTypeManager.propTypeOverrideBlue == null &&
      this.propTypeManager.propTypeOverrideRed == null
    ) {
      const pts = this.propTypeChangeService.state;
      if (this.state.currentBluePropType !== pts.bluePropType)
        this.state.currentBluePropType = pts.bluePropType;
      if (this.state.currentRedPropType !== pts.redPropType)
        this.state.currentRedPropType = pts.redPropType;
      if (this.state.currentPropType !== pts.legacyPropType) {
        this.state.currentPropType = pts.legacyPropType;
        animationSettingsState.setCurrentPropType(pts.bluePropType);
      }
    }

    // Sync from prop texture service
    if (this.propTextureService) {
      const pts = this.propTextureService.state;
      if (
        this.state.bluePropDimensions.width !== pts.blueDimensions.width ||
        this.state.bluePropDimensions.height !== pts.blueDimensions.height
      ) {
        this.state.bluePropDimensions = pts.blueDimensions;
      }
      if (
        this.state.redPropDimensions.width !== pts.redDimensions.width ||
        this.state.redPropDimensions.height !== pts.redDimensions.height
      ) {
        this.state.redPropDimensions = pts.redDimensions;
      }
    }

    // Sync from resize service
    if (this.canvasResizerService) {
      const newSize = this.canvasResizerService.state.currentSize;
      if (newSize && newSize !== this.canvasSize) {
        this.canvasSize = newSize;
        this.trailCapturer?.updateConfig({ canvasSize: newSize });
        this.renderLoopService?.updateConfig({ canvasSize: newSize });
        this.effectRendererManager.resizeAll(newSize);
      }
    }
  }

  private calculateBeatNumber(props: AnimationEngineProps): number {
    if (!props.sequenceData || !props.stepData) return 0;

    const stepIndex = props.sequenceData.steps?.findIndex(
      (b) => b === props.stepData
    );
    if (stepIndex !== undefined && stepIndex >= 0) {
      return stepIndex + 1;
    }
    return 0;
  }

  private calculateTurnsTuple(props: AnimationEngineProps): string {
    if (
      !props.stepData?.motions?.blue ||
      !props.stepData.motions?.red
    ) {
      return "(s, 0, 0)";
    }
    return (
      this.turnsTupleGenerator?.generateTurnsTuple(props.stepData) ??
      "(s, 0, 0)"
    );
  }

  /**
   * Calculate the musical position display string as a continuous decimal.
   */
  private calculateMusicalPosition(props: AnimationEngineProps): string | null {
    if (this.orchestrator?.isInitialized()) {
      const continuousPosition = this.orchestrator.getContinuousMusicalPosition();

      if (continuousPosition <= 0) {
        return null;
      }

      return continuousPosition.toFixed(1);
    }

    if (props.stepData && props.sequenceData) {
      const stepIndex = props.sequenceData.steps?.findIndex(
        (b) => b === props.stepData
      );
      if (stepIndex !== undefined && stepIndex >= 0) {
        const stepNumber = stepIndex + 1;
        return `${stepNumber}.0`;
      }
    }

    return null;
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
   * Build frame params - delegates to FrameParameterBuilder with current engine state.
   */
  private buildFrameParams(props: AnimationEngineProps) {
    return this.frameParameterBuilder.getFrameParams(props, this.state, {
      prevDarkMode: this.prevDarkMode,
      prevHasFireTips: this.effectRendererManager.prevHasFireTips,
      prevHasCharcoalTips: this.effectRendererManager.prevHasCharcoalTips,
      trailsSuppressedUntilTextureLoad: this.propTypeManager.trailsSuppressedUntilTextureLoad,
      effectsConfigState: this.effectsConfigState,
      settingsService: this.settingsService,
      effectRendererManager: this.effectRendererManager,
      getVM: () => this.getVM(),
      orchestrator: this.orchestrator,
    });
  }
}

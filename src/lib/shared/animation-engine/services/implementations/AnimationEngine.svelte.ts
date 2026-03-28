/**
 * AnimationEngine - Pure TypeScript orchestration for canvas animation
 *
 * This class owns all animation services and handles orchestration logic.
 * The component just passes props to engine.update() and derives state.
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
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ISVGGenerator } from "$lib/features/compose/services/contracts/ISVGGenerator";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
import type { PropState } from "../../domain/PropState";
import { type TrailSettings, DEFAULT_TRAIL_SETTINGS } from "../../domain/types/TrailTypes";
import type { RenderFrameParams } from "../contracts/IAnimationRenderLoop";
import type { AdditionalLayerProps } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { AnimationVisibilityState } from "../contracts/IAnimationVisibilitySynchronizer";
import type { PreRenderProgress } from "$lib/features/compose/services/implementations/SequenceFramePreRenderer";
import { TUNNEL_LAYER_COLORS } from "$lib/features/compose/compose/domain/types";

import { loadAnimatorServices as loadServices } from "./AnimatorLoader";
import { loadTrailSettings } from "$lib/features/compose/utils/animation-panel-persistence";
import { TrailCapturer } from "$lib/features/compose/services/implementations/TrailCapturer";
import { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
import { AnimationStateManager } from "$lib/features/compose/services/implementations/AnimationStateManager";
import { container } from "$lib/shared/di";
import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";

// Services
import { CanvasResizer } from "./CanvasResizer.svelte";
import {
  DEFAULT_CANVAS_SIZE,
  type ICanvasResizer,
} from "../contracts/ICanvasResizer";
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
import type { IFrameBudgetMonitor } from "../contracts/IFrameBudgetMonitor";
import { FrameBudgetMonitor } from "./FrameBudgetMonitor";
import { DeviceTierDetector } from "./DeviceTierDetector";
import { AnimationVisibilitySynchronizer } from "./AnimationVisibilitySynchronizer";
import { GlyphTransitionController } from "./GlyphTransitionController.svelte";
import type { IGlyphTransitionController } from "../contracts/IGlyphTransitionController";
import { SequenceCache } from "./SequenceCache.svelte";
import { TrailSettingsSynchronizer } from "./TrailSettingsSynchronizer.svelte";
import { PropTypeChanger } from "./PropTypeChanger.svelte";
import { AnimatorCanvasInitializer } from "./AnimatorCanvasInitializer";
import { FireTipTracker } from "./FireTipTracker";
import { WebGLFireRenderer } from "./fire/WebGLFireRenderer";
import { CharcoalSparkRenderer } from "./charcoal/CharcoalSparkRenderer";
import type { IFireOverlayRenderer } from "../contracts/IFireOverlayRenderer";
import type { ICharcoalRenderer } from "../contracts/ICharcoalRenderer";
import type { IFireTipTracker } from "../contracts/IFireTipTracker";
import { DEFAULT_FIRE_CONFIG, DEFAULT_PROP_FLAME_COLORS, type FireOverlayConfig } from "../../domain/types/FireTypes";
import type { IFireDefaultsLoader } from "../contracts/IFireDefaultsLoader";
import {
  BASE_FIRE_PHYSICS,
  BASE_COLOR_CURVE,
  CHARCOAL_FIRE_PHYSICS,
  CHARCOAL_COLOR_CURVE,
  intensityToPhysics,
} from "../../domain/types/FireTypes";
import { LedTipTracker } from "./LedTipTracker";
import { WebGLLedRenderer } from "./led/WebGLLedRenderer";
import type { ILedOverlayRenderer } from "../contracts/ILedOverlayRenderer";
import type { ILedTipTracker } from "../contracts/ILedTipTracker";
import { DEFAULT_LED_CONFIG, ledBrightnessToFloat, type LedOverlayConfig } from "../../domain/types/LedTypes";
import { TrailOverlayCanvas } from "./TrailOverlayCanvas";
import type { ITrailOverlayCanvas } from "../contracts/ITrailOverlayCanvas";
import { sequenceLoopabilityChecker } from "$lib/features/compose/services/implementations/SequenceLoopabilityChecker";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
import { TrackingMode } from "../../domain/types/TrailTypes";

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
      blueMotion: true,
      redMotion: true,
      darkMode: false,
      wordHeader: true,
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
  });

  // ============================================================================
  // PRIVATE SERVICES
  // ============================================================================
  private svgGenerator: ISVGGenerator | null = null;
  private settingsService: ISettingsState | null = null;
  private orchestrator: ISequenceAnimationOrchestrator | null = null;
  private trailCapturer: ITrailCapturer | null = null;
  private turnsTupleGenerator: ITurnsTupleGenerator | null = null;
  private animationRenderer: IAnimationRenderer | null = null;

  private canvasResizerService: ICanvasResizer | null = null;
  private propTextureService: IPropTextureLoader | null = null;
  private glyphTextureService: IGlyphTextureLoader | null = null;
  private precomputationService: IAnimationPrecomputer | null = null;
  private renderLoopService: IAnimationRenderLoop | null = null;
  private visibilitySyncService: AnimationVisibilitySynchronizer | null = null;
  private glyphTransitionService: IGlyphTransitionController | null = null;
  private sequenceCacheService: SequenceCache | null = null;
  private trailSettingsSyncService: TrailSettingsSynchronizer | null = null;
  private propTypeChangeService: PropTypeChanger | null = null;
  private canvasInitializer = new AnimatorCanvasInitializer();
  private frameBudgetMonitor: IFrameBudgetMonitor =
    new FrameBudgetMonitor(new DeviceTierDetector().detect());
  private fireRenderer: IFireOverlayRenderer | null = null;
  private charcoalRenderer: ICharcoalRenderer | null = null;
  private fireTipTracker: IFireTipTracker | null = null;
  private fireConfig: FireOverlayConfig = { ...DEFAULT_FIRE_CONFIG };
  private fireDefaultsLoader: IFireDefaultsLoader | null = null;
  private ledRenderer: ILedOverlayRenderer | null = null;
  private ledTipTracker: ILedTipTracker | null = null;
  private ledConfig: LedOverlayConfig = { ...DEFAULT_LED_CONFIG };
  private ledInitPending = false;
  private trailOverlay: ITrailOverlayCanvas | null = null;

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
  private cacheSequenceId: string | null = null;
  private unsubscribeVisibility: (() => void) | null = null;
  private lastTextureReloadSignal: number = 0;
  private lastClearSignal: number = 0;
  private lastPreRenderClearSignal: number = 0;

  // Previous props for change detection (only track what we compare)
  private prevStepData: StartPositionData | StepData | null = null;
  private prevSequenceData: SequenceData | null = null;
  private prevIsPlaying: boolean = false;
  private prevGridMode: GridMode | null = null;

  // Sequence content hash for detecting beat duration changes
  private lastSequenceContentHash: string | null = null;

  // Cached loopability result (recomputed only when sequence changes)
  private cachedIsSeamlesslyLoopable: boolean = false;
  private loopabilityCacheHash: string | null = null;

  // Cached flags for single-hand sequences (computed once per sequence change)
  private sequenceHasBlueMotion: boolean = true;
  private sequenceHasRedMotion: boolean = true;
  private handPresenceCacheKey: string | null = null;

  // Prop type overrides (bypass settings when provided)
  private propTypeOverrideBlue: string | null = null;
  private propTypeOverrideRed: string | null = null;

  // When true, the render loop skips trail capture AND rendering for this frame.
  // Set during prop type changes to prevent stale trail data from flashing on screen
  // while new textures are loading asynchronously.
  private trailsSuppressedUntilTextureLoad = false;
  private prevDarkMode: boolean = false;
  private previewDarkModeActive: boolean = false; // true when previewDarkMode prop overrides global
  private prevTrailsVisible: boolean = true;
  private prevPropsVisible: boolean = true;
  private prevBlueMotionVisible: boolean = true;
  private prevRedMotionVisible: boolean = true;
  private prevFireEffect: boolean = false;
  private prevColorBlend: number = 0.5;
  private prevCharcoalEffect: boolean = false;
  private prevFireIntensity: number = 0.7;
  private prevCharcoalParamsJson: string = "";
  private prevEffortPreset: EffortId = "linear";
  private prevPathShape: "arc" | "linear" = "arc";

  // Additional layer texture loading for tunnel mode (indexed by layer)
  private additionalLayerTexturesLoaded: boolean[] = [];
  private additionalLayerTexturesLoading: boolean[] = [];

  // Simple reference to last props for initial render (not a copy - avoids GC)
  private lastPropsRef: AnimationEngineProps | null = null;

  // Reusable frame params object to avoid GC pressure (created once, mutated each frame)
  private readonly frameParams: RenderFrameParams = {
    stepData: null,
    currentStep: 0,
    trailSettings: DEFAULT_TRAIL_SETTINGS,
    gridVisible: true,
    gridMode: GridMode.DIAMOND,
    letter: null,
    props: {
      blueProp: null,
      redProp: null,
      additionalLayers: [],
      bluePropDimensions: DEFAULT_PROP_DIMENSIONS,
      redPropDimensions: DEFAULT_PROP_DIMENSIONS,
    },
    visibility: {
      gridVisible: true,
      propsVisible: true,
      trailsVisible: true,
      blueMotionVisible: true,
      redMotionVisible: true,
    },
    isPlaying: false,
    bluePropFlipped: false,
    redPropFlipped: false,
    bluePropType: undefined,
    redPropType: undefined,
    fireConfig: null,
    darkMode: false,
    propColors: undefined,
    ledConfig: null,
    isSeamlesslyLoopable: false,
    sequenceContentHash: undefined,
  };

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

    // Initialize visibility manager
    const vm = this.getVM();
    this.prevDarkMode = vm.isDarkMode();
    this.prevTrailsVisible = vm.isTrailsVisible();
    this.prevPropsVisible = vm.getVisibility("props");
    this.prevBlueMotionVisible = vm.getVisibility("blueMotion");
    this.prevRedMotionVisible = vm.getVisibility("redMotion");
    this.prevFireEffect = vm.isFireEffectEnabled();
    this.fireConfig.enabled = this.prevFireEffect;
    this.prevColorBlend = vm.getFireColorBlend();
    this.prevCharcoalEffect = vm.isCharcoalEffectEnabled();
    this.prevFireIntensity = vm.getFireIntensity();
    this.prevCharcoalParamsJson = JSON.stringify(vm.getCharcoalParams());
    this.prevEffortPreset = vm.getEffortPreset();
    this.fireDefaultsLoader = container.items.fireDefaultsLoader;

    // Build fireConfig from base params + slider mappings
    this.fireConfig.colorBlend = this.prevColorBlend;
    this.fireConfig.intensity = this.prevFireIntensity;
    this.fireConfig.flameHeight = this.prevFireIntensity;
    this.fireConfig.fuelRendererType = "fluid";

    const basePhysics = BASE_FIRE_PHYSICS;
    const intensityOverrides = intensityToPhysics(this.prevFireIntensity);
    this.fireConfig.physicsPreset = {
      ...basePhysics,
      ...intensityOverrides,
    };
    this.fireConfig.colorCurve = BASE_COLOR_CURVE;
    this.fireConfig.charcoalParams = vm.getCharcoalParams();
    // Initialize LED state from visibility manager
    this.ledConfig.enabled = vm.isLedEffectEnabled();
    this.ledConfig.patternId = vm.getLedPatternId();
    this.ledConfig.primaryColor = vm.getLedPrimaryColor();

    this.state.visibilityState = {
      grid: vm.getGridMode() !== "none",
      stepNumbers: vm.getVisibility("stepNumbers"),
      props: vm.getVisibility("props"),
      trails: vm.getTrailStyle() !== "off",
      tkaGlyph: vm.getVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      blueMotion: vm.getVisibility("blueMotion"),
      redMotion: vm.getVisibility("redMotion"),
      darkMode: vm.isDarkMode(),
      wordHeader: vm.getVisibility("wordHeader"),
    };

    // Initialize services that don't need renderer
    this.visibilitySyncService = new AnimationVisibilitySynchronizer(this.visibilityManagerOverride ?? undefined);
    this.unsubscribeVisibility = this.visibilitySyncService.subscribe(
      (state) => {
        this.state.visibilityState = state;

        // Sync Dark Mode to renderer when it changes
        // Skip if previewDarkMode is active (component overrides global)
        if (state.darkMode !== this.prevDarkMode && !this.previewDarkModeActive) {
          this.prevDarkMode = state.darkMode;
          // Note: setDarkMode on renderer controls the "Dark Mode" effect (dark bg, inverted grid)
          this.animationRenderer?.setDarkMode(state.darkMode);

          // CRITICAL: Trigger immediate render so dark mode takes effect visually
          // Don't wait for prop textures - render with existing textures first
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
            );

            // THEN reload prop textures (they need theme-aware colors)
            // This runs async and triggers another render when complete
            this.loadPropTextures().then(() => {
              this.renderLoopService?.triggerRender(() =>
                this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
              );
            });
          }
        }

        // Trigger render when trails visibility changes
        if (state.trails !== this.prevTrailsVisible) {
          const trailsTurnedOff = this.prevTrailsVisible && !state.trails;
          this.prevTrailsVisible = state.trails;

          // When trails are turned off (e.g. switching to fire mode),
          // clear and hide the overlay so stale trail pixels don't persist
          if (trailsTurnedOff && this.trailOverlay) {
            this.trailOverlay.clear();
            this.trailOverlay.setVisible(false);
          } else if (state.trails && this.trailOverlay) {
            this.trailOverlay.setVisible(true);
          }

          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
            );
          }
        }

        // Trigger render when props visibility changes (enables fade in/out animation)
        if (state.props !== this.prevPropsVisible) {
          const becameVisible = state.props && !this.prevPropsVisible;
          this.prevPropsVisible = state.props;

          // When props become visible again, clear trails so they regenerate fresh
          // This prevents awkward trail animation from old positions
          if (becameVisible) {
            this.trailCapturer?.clearTrails();
          }

          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
            );
          }
        }

        // Trigger render when blue motion visibility changes (enables individual fade)
        if (state.blueMotion !== this.prevBlueMotionVisible) {
          this.prevBlueMotionVisible = state.blueMotion;
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
            );
          }
        }

        // Trigger render when red motion visibility changes (enables individual fade)
        if (state.redMotion !== this.prevRedMotionVisible) {
          this.prevRedMotionVisible = state.redMotion;
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
            );
          }
        }

        // Sync fire effect toggle from visibility manager
        const vm = this.getVM();
        const fireEnabled = vm.isFireEffectEnabled();
        if (fireEnabled !== this.prevFireEffect) {
          this.prevFireEffect = fireEnabled;
          this.setFireConfig({ enabled: fireEnabled });
        }

        // Sync charcoal effect toggle (independent from fire)
        const charcoalEnabled = vm.isCharcoalEffectEnabled();
        if (charcoalEnabled !== this.prevCharcoalEffect) {
          this.prevCharcoalEffect = charcoalEnabled;
          this.syncCharcoalOverlay();
        }

        // Sync fire slider values → physics
        const colorBlend = vm.getFireColorBlend();
        const fireIntensity = vm.getFireIntensity();

        const slidersChanged =
          colorBlend !== this.prevColorBlend ||
          fireIntensity !== this.prevFireIntensity;

        if (slidersChanged) {
          this.prevColorBlend = colorBlend;
          this.prevFireIntensity = fireIntensity;

          const basePhysics = BASE_FIRE_PHYSICS;
          const intOverrides = intensityToPhysics(fireIntensity);
          this.setFireConfig({
            colorBlend,
            fuelRendererType: "fluid",
            intensity: fireIntensity,
            flameHeight: fireIntensity,
            physicsPreset: {
              ...basePhysics,
              ...intOverrides,
            },
            colorCurve: BASE_COLOR_CURVE,
          });
        }

        // Reset fire tip tracker when effort preset changes.
        // Effort easing changes prop positions instantly (different curve = different
        // position for the same stepProgress), causing a velocity spike that pushes
        // flames away from prop tips.
        const effortPreset = vm.getEffortPreset();
        if (effortPreset !== this.prevEffortPreset) {
          this.prevEffortPreset = effortPreset;
          // Reset tip tracker (stored positions/velocities)
          this.fireTipTracker?.reset();
          // Clear WebGL simulation buffers + frame cache so residual
          // velocity/fuel from the old effort curve doesn't persist
          if (this.fireRenderer?.isInitialized()) {
            this.fireRenderer.clearSimulation();
          }
          if (this.charcoalRenderer?.isInitialized()) {
            this.charcoalRenderer.clearSimulation();
          }
        }

        // Path shape changed (arc ↔ linear). The props follow a different
        // trajectory, so effects that cache positions/velocities from the old
        // path will visually lag behind the new one until their buffers flush.
        // Reset everything that carries state from the previous path shape.
        const pathShape = vm.getPathShape();
        if (pathShape !== this.prevPathShape) {
          this.prevPathShape = pathShape;

          // Reset fire tip tracker — stored positions/velocities are from the old trajectory
          this.fireTipTracker?.reset();

          // Clear WebGL simulation buffers so residual fuel/sparks from the
          // old path don't linger
          if (this.fireRenderer?.isInitialized()) {
            this.fireRenderer.clearSimulation();
          }
          if (this.charcoalRenderer?.isInitialized()) {
            this.charcoalRenderer.clearSimulation();
          }

          // Clear existing trail points — they were captured along the old path
          this.trailCapturer?.clearTrails();

          // Immediately invalidate the path cache so the render loop stops
          // reading stale trail positions from the old trajectory.
          this.precomputationService?.clearCaches();
          this.renderLoopService?.updateConfig({ pathCache: null });

          // Don't suppress trails — the real-time trail capturer reads
          // pathShape dynamically via PropInterpolator every frame, so new
          // captures will immediately follow the correct trajectory. The
          // 120fps cache rebuilds in the background and seamlessly takes
          // over when ready.
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
                  // Clear real-time trail points so the cache takes over
                  // cleanly without mixing two sources
                  this.trailCapturer?.clearTrails();
                }
              })
              .catch(() => {
                // Precomputation failed — real-time capture continues
              });
          }

          // Force an immediate render so the visual state updates
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
            );
          }
        }

        // Sync charcoal params independently of the fire sliders above.
        // Charcoal param changes (gravity, burst threshold, etc.) don't affect
        // fire sliders, so slidersChanged won't detect them.
        // Forward directly to the renderer when changed.
        if (charcoalEnabled && this.charcoalRenderer?.isInitialized()) {
          const currentCharcoalJson = JSON.stringify(vm.getCharcoalParams());
          if (currentCharcoalJson !== this.prevCharcoalParamsJson) {
            this.prevCharcoalParamsJson = currentCharcoalJson;
            this.charcoalRenderer.setParams(vm.getCharcoalParams());
          }
        }

        // Sync LED effect from visibility manager — batch into a single setLedConfig call
        // to avoid calling syncLedOverlay (WebGL init) multiple times per notification.
        const ledEnabled = vm.isLedEffectEnabled();
        const ledPatternId = vm.getLedPatternId();
        const ledColor = vm.getLedPrimaryColor();
        const ledBrightness = ledBrightnessToFloat(vm.getLedBrightness());

        const ledDiff: Partial<LedOverlayConfig> = {};
        if (ledEnabled !== this.ledConfig.enabled) ledDiff.enabled = ledEnabled;
        if (ledPatternId !== this.ledConfig.patternId)
          ledDiff.patternId = ledPatternId;
        if (ledColor !== this.ledConfig.primaryColor)
          ledDiff.primaryColor = ledColor;
        if (ledBrightness !== this.ledConfig.brightness)
          ledDiff.brightness = ledBrightness;

        if (Object.keys(ledDiff).length > 0) {
          this.setLedConfig(ledDiff);
        }
      }
    );

    this.glyphTransitionService = new GlyphTransitionController();
    this.sequenceCacheService = new SequenceCache();
    this.trailSettingsSyncService = new TrailSettingsSynchronizer();
    this.propTypeChangeService = new PropTypeChanger();

    // Initialize canvas (async process)
    await this.initializeCanvas();

    // Sync previousGridMode with the grid texture loaded during initialization,
    // so the change-detection in update() doesn't redundantly reload the same texture.
    const initGridMode = this.lastPropsRef?.gridMode?.toString() ?? "diamond";
    this.previousGridMode = initGridMode;

    // Wire overlay renderers that may have been created during the async
    // initializeCanvas gap. Svelte $effects fire while the canvas is still
    // initializing, so syncOverlay's rAF can create the WebGL renderer before
    // renderLoopService exists — the ?.updateConfig() silently no-ops.
    // Re-wire them now that renderLoopService is ready.
    if (this.fireRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        fireRenderer: this.fireRenderer,
      });
    } else if (this.charcoalRenderer?.isInitialized() && this.renderLoopService) {
      // Charcoal spark renderer was created during the gap — wire it now
      this.renderLoopService.updateConfig({
        charcoalRenderer: this.charcoalRenderer,
      });
    }
    if (this.ledRenderer?.isInitialized() && this.renderLoopService) {
      this.renderLoopService.updateConfig({
        ledRenderer: this.ledRenderer,
      });
    }

    // Create overlays that weren't created yet (e.g. enabled before HMR/reload
    // but the $effect hasn't triggered, or the rAF hasn't fired yet).
    if (this.fireConfig.enabled && !this.fireRenderer?.isInitialized()) {
      this.syncFireOverlay();
    }
    if (this.prevCharcoalEffect && !this.charcoalRenderer?.isInitialized()) {
      this.syncCharcoalOverlay();
    }
    if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
      this.syncLedOverlay();
    }
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
    // Initialize trail capturer when we have any indication settings are ready:
    // - Prop types changed from default "staff"
    // - Settings service has loaded
    // - External trail settings are provided (standalone/gallery mode)
    // Also retry if settingsLoaded but trail capturer init hasn't completed
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

    // Handle prop type changes - check for overrides first, then settings
    const hasOverrides =
      props.bluePropType != null || props.redPropType != null;

    if (hasOverrides) {
      // Use overrides - bypass settings entirely
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
        this.state.currentBluePropType = newBlue;
        this.state.currentRedPropType = newRed;
        this.state.currentPropType = newBlue;

        // Update global settings so UI (e.g. trail tracking labels) reflects current prop
        animationSettingsState.setCurrentPropType(newBlue);

        // Invalidate path cache FIRST — it holds pre-computed endpoint positions
        // for the old prop geometry. If the render loop reads stale cache data
        // before the new textures load, it draws a jump line to the wrong position.
        this.precomputationService?.clearCaches();
        this.renderLoopService?.updateConfig({ pathCache: null });

        // Clear trail buffers — old points are at wrong endpoint positions
        this.trailCapturer?.clearTrails();

        // Suppress trail rendering until new textures load — prevents stale
        // endpoint data from flashing as a jump line during the async gap
        this.trailsSuppressedUntilTextureLoad = true;

        // Reset additional layer textures so they reload with new prop type
        this.additionalLayerTexturesLoaded = [];
        this.additionalLayerTexturesLoading = [];

        // Reset fire tip tracker so fire points recalculate for the new prop geometry
        this.fireTipTracker?.reset();

        // Hot-swap textures
        this.loadPropTextures().then(() => {
          // Clear trails again after texture load to discard any points
          // captured during the async gap with old prop dimensions
          this.trailCapturer?.clearTrails();
          this.trailsSuppressedUntilTextureLoad = false;
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(props)
            );
          }
        });
      }
    } else {
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
          this.state.currentBluePropType =
            this.propTypeChangeService.state.bluePropType;
          this.state.currentRedPropType =
            this.propTypeChangeService.state.redPropType;
          this.state.currentPropType =
            this.propTypeChangeService.state.legacyPropType;
          animationSettingsState.setCurrentPropType(
            this.propTypeChangeService.state.bluePropType
          );
        }

        // Invalidate path cache FIRST — it holds pre-computed endpoint positions
        // for the old prop geometry. If the render loop reads stale cache data
        // before the new textures load, it draws a jump line to the wrong position.
        this.precomputationService?.clearCaches();
        this.renderLoopService?.updateConfig({ pathCache: null });

        // Clear trail buffers — old points are at wrong endpoint positions
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
        this.loadPropTextures().then(() => {
          this.trailCapturer?.clearTrails();
          this.trailsSuppressedUntilTextureLoad = false;
          // Trigger immediate re-render once new textures are ready
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(props)
            );
          }
        });
      }
    }

    // Handle additional layer prop textures for tunnel mode
    // When additional layers are passed, load per-layer colored textures
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
              this.state.currentBluePropType,
              colors.left,
              colors.right
            )
            .then(() => {
              this.additionalLayerTexturesLoaded[i] = true;
              this.additionalLayerTexturesLoading[i] = false;

              // Trigger re-render with new layer textures
              if (this.state.isInitialized) {
                this.renderLoopService?.triggerRender(() =>
                  this.getFrameParams(props)
                );
              }
            })
            .catch((err) => {
              console.error(`Failed to load layer ${i} prop textures:`, err);
              this.additionalLayerTexturesLoading[i] = false;
            });
        }
      }
    }

    // Handle trail settings changes — enforce unilateral constraint before syncing
    if (props.externalTrailSettings !== undefined) {
      this.trailSettingsSyncService?.handleExternalSettingsSync(
        this.enforceUnilateralConstraint(props.externalTrailSettings)
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
    // This ensures duration changes are reflected in the animation
    if (props.sequenceData && this.orchestrator) {
      const newHash = this.getSequenceContentHash(props.sequenceData);
      if (newHash !== this.lastSequenceContentHash) {
        console.log(`[TRAIL-DIAG] Sequence changed, hash: ${this.lastSequenceContentHash} → ${newHash}`);
        this.orchestrator.initializeWithDomainData(props.sequenceData);
        this.lastSequenceContentHash = newHash;

        // Log what the orchestrator just set as prop state — this is what the
        // trail overlay will see on the NEXT renderFrame() call
        const postInitStates = this.orchestrator.getCurrentPropStates();
        console.log(`[TRAIL-DIAG] Post-orchestrator prop state: blue.path=${postInitStates.blue.centerPathAngle?.toFixed(3)} blue.staff=${postInitStates.blue.staffRotationAngle?.toFixed(3)} blue.xy=(${postInitStates.blue.x},${postInitStates.blue.y}) | red.path=${postInitStates.red.centerPathAngle?.toFixed(3)} red.staff=${postInitStates.red.staffRotationAngle?.toFixed(3)} red.xy=(${postInitStates.red.x},${postInitStates.red.y})`);
        // BUT: the trail overlay reads from props.blueProp which comes from the Svelte component.
        // If there's a reactive propagation delay, the trail overlay might see STALE props on
        // the first frame after clearBuffers(). Log what's in the current props for comparison:
        console.log(`[TRAIL-DIAG] Current props.blueProp: path=${props.blueProp?.centerPathAngle?.toFixed(3)} staff=${props.blueProp?.staffRotationAngle?.toFixed(3)} xy=(${props.blueProp?.x},${props.blueProp?.y}) | props.redProp: path=${props.redProp?.centerPathAngle?.toFixed(3)} staff=${props.redProp?.staffRotationAngle?.toFixed(3)} xy=(${props.redProp?.x},${props.redProp?.y})`);

        // Flush stale trail data so old ring buffer points don't draw
        // artifact lines to the new prop positions. Use clearBuffers()
        // instead of clear() — props are already positioned correctly by
        // the orchestrator above, so no warmup delay needed.
        this.trailOverlay?.clearBuffers();
        this.fireTipTracker?.reset();
        this.fireRenderer?.clearSimulation();
        this.charcoalRenderer?.clearSimulation();
        console.log(`[TRAIL-DIAG] Cleared trail buffers + reset fire tip tracker + cleared fire/charcoal simulations`);

        // Trigger path cache precomputation for smooth trails during stutters
        // This pre-computes the entire animation at 120fps so the render loop can
        // retrieve smooth trail points even when frames are dropped
        if (
          this.state.trailSettings.usePathCache &&
          this.precomputationService
        ) {
          const totalSteps = props.sequenceData.steps.length;
          // 1 second per beat (step.duration is beat COUNT, not milliseconds)
          const stepDurationMs = 1000;

          // Precompute paths and update render loop's cache reference
          this.precomputationService
            .precomputeAnimationPaths(
              props.sequenceData,
              totalSteps,
              stepDurationMs,
              this.state.trailSettings
            )
            .then(() => {
              // Update render loop with the now-populated cache
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
      console.log(`[trail-overlay] 🔄 Cache clear signal fired — clearing path caches`);
      this.precomputationService?.clearCaches();
      // When the trail overlay is active, DON'T clear the trail capturer
      // buffer. Old trail points stay in the buffer and continue being
      // drawn at their old positions (fading naturally via destination-out).
      // When new points start accumulating, they push old ones out of the
      // leading-edge window — smooth handoff, zero gap.
      if (!this.trailOverlay) {
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

    // Handle grid mode changes
    const currentGridMode = props.gridMode?.toString() ?? null;
    if (
      this.state.isInitialized &&
      this.animationRenderer &&
      currentGridMode !== this.previousGridMode
    ) {
      this.previousGridMode = currentGridMode;
      this.animationRenderer
        .loadGridTexture(currentGridMode ?? "diamond")
        .then(() => {
          this.renderLoopService?.triggerRender(() =>
            this.getFrameParams(props)
          );
        });
    }

    // Handle preview dark mode override
    // When previewDarkMode is provided (not null), it overrides global dark mode
    // This allows the sequence viewer preview and Flame Lab to control dark mode locally
    if (props.previewDarkMode !== undefined && props.previewDarkMode !== null) {
      this.previewDarkModeActive = true;
      const previewDarkMode = props.previewDarkMode;
      if (previewDarkMode !== this.prevDarkMode) {
        this.prevDarkMode = previewDarkMode;
        this.animationRenderer?.setDarkMode(previewDarkMode);

        // Trigger render with new dark mode
        if (this.state.isInitialized) {
          this.renderLoopService?.triggerRender(() =>
            this.getFrameParams(props)
          );

          // Reload prop textures (they need theme-aware colors)
          this.loadPropTextures().then(() => {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(props)
            );
          });
        }
      }
    } else {
      this.previewDarkModeActive = false;
    }

    // NOTE: Don't clear trails when props are null - props are temporarily null
    // during loading/transitions, and clearing trails causes them to disappear.
    // TrailCapturer handles clearing appropriately based on settings and loop detection.

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
    // (syncServiceState() at start of update() syncs previous frame's values)
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
      this.renderLoopService?.triggerRender(() => this.getFrameParams(props));
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
    this.fireRenderer?.clearSimulation();
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
        fireEffect: settings.fireEffect,
        charcoalEffect: settings.charcoalEffect,
        ledEffect: settings.ledEffect,
        trailStyle: settings.trailStyle,
        effortPreset: settings.effortPreset,
        pathShape: settings.pathShape,
      },
      fireConfig: this.fireConfig,
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

  /**
   * Dispose all resources
   */
  dispose(): void {
    // Unsubscribe from visibility
    this.unsubscribeVisibility?.();
    this.unsubscribeVisibility = null;

    // Dispose services
    this.visibilitySyncService?.dispose();
    this.glyphTransitionService?.dispose();
    this.sequenceCacheService?.dispose();
    this.trailSettingsSyncService?.dispose();
    this.propTypeChangeService?.dispose();

    // Dispose render loop
    this.renderLoopService?.dispose();
    this.canvasResizerService?.teardown();

    // Dispose texture services
    this.glyphTextureService?.dispose?.();
    this.propTextureService?.dispose?.();

    // Dispose precomputation
    this.precomputationService?.dispose?.();

    // Dispose fire overlay
    this.fireRenderer?.dispose();
    this.fireRenderer = null;
    this.charcoalRenderer?.dispose();
    this.charcoalRenderer = null;
    this.fireTipTracker = null;

    // Dispose LED overlay (also prevent any pending deferred init from running)
    this.ledConfig.enabled = false;
    this.ledRenderer?.dispose();
    this.ledRenderer = null;
    this.ledTipTracker = null;

    // Dispose trail overlay
    this.trailOverlay?.dispose();
    this.trailOverlay = null;

    // Clear trails
    this.trailCapturer?.clearTrails();

    // Destroy canvas
    this.canvasInitializer.destroy({
      onCanvasReady: (canvas) => {
        this.callbacks.onCanvasReady?.(canvas);
      },
      onInitialized: (initialized) => {
        this.state.isInitialized = initialized;
      },
    });

    // Clear references
    this.containerElement = null;
    this.lastPropsRef = null;
    this.prevStepData = null;
    this.prevSequenceData = null;
    this.handPresenceCacheKey = null;
    this.sequenceHasBlueMotion = true;
    this.sequenceHasRedMotion = true;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async initializeCanvas(): Promise<void> {
    if (!this.containerElement) return;

    // Use gridMode from the most recent props update (set by the $effect that
    // runs engine.update() before initialization completes). Falls back to
    // DIAMOND if no props have arrived yet.
    const initialGridMode = this.lastPropsRef?.gridMode ?? GridMode.DIAMOND;

    await this.canvasInitializer.initialize(
      {
        containerElement: this.containerElement,
        backgroundAlpha: 1,
        gridMode: initialGridMode,
        loadAnimatorServices: () => this.loadAnimatorServices(),
        initializePrecomputationService: () => {
          this.initializePrecomputationService();
          this.precomputationService?.initializeFramePreRenderer();
        },
        initializePropTextureLoader: () => this.initializePropTextureLoader(),
        initializeResizeService: () => {
          this.initializeResizeService();
          this.canvasResizerService?.setup();
        },
        initializeGlyphTextureLoader: () => this.initializeGlyphTextureLoader(),
        initializeRenderLoopService: () => this.initializeRenderLoopService(),
        loadPropTextures: () => this.loadPropTextures(),
        startRenderLoop: () =>
          this.renderLoopService?.triggerRender(() =>
            this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
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
          // Set initial Dark Mode on renderer (no animation for initial sync)
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
    // Per-instance orchestrator instead of shared DI singleton.
    // The singleton causes trail data corruption when multiple canvases
    // (e.g. compose grid cells) precompute paths concurrently — each cell's
    // precomputation yields between chunks (setTimeout(0)), allowing another
    // cell to re-initialize the shared orchestrator with different sequence data.
    // Stateless services (StepCalculator, PropInterpolator) are safe to share.
    this.orchestrator = new SequenceAnimationOrchestrator(
      new AnimationStateManager(),
      container.items.stepCalculationService,
      container.items.propInterpolationService
    );
    // Per-instance TrailCapturer instead of shared DI singleton.
    // The singleton causes trail data contamination when multiple canvases
    // (e.g. compose grid cells) all write to the same trail buffers.
    this.trailCapturer = new TrailCapturer();
    this.turnsTupleGenerator = services.turnsTupleGenerator;
    this.state.servicesReady = true;
    return true;
  }

  private initializePrecomputationService(): void {
    if (!this.orchestrator) return;

    this.precomputationService = new AnimationPrecomputer();
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
    this.propTextureService.initialize(
      this.animationRenderer,
      this.svgGenerator,
      this.trailCapturer
    );
  }

  private async loadPropTextures(): Promise<void> {
    if (!this.propTextureService) return;

    // Use overrides if set, otherwise read from settings
    let bluePropType = this.state.currentBluePropType;
    let redPropType = this.state.currentRedPropType;

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
      this.state.currentBluePropType = bluePropType;
      this.state.currentRedPropType = redPropType;
      this.state.currentPropType = bluePropType;
    }

    // Pass dark mode state for prop color selection
    // This allows preview isolation - local preview dark mode instead of global
    await this.propTextureService.loadPropTextures(
      bluePropType,
      redPropType,
      this.prevDarkMode
    );

    // CRITICAL: Sync dimensions to engine state immediately after loading
    // This ensures getFrameParams() has correct dimensions for the first render
    this.state.bluePropDimensions =
      this.propTextureService.state.blueDimensions;
    this.state.redPropDimensions = this.propTextureService.state.redDimensions;

    // CRITICAL: Clear animation path caches when prop types/dimensions change
    // The path cache uses prop dimensions for endpoint calculations - stale cache = wrong trails
    this.precomputationService?.clearCaches();
  }

  private initializeResizeService(): void {
    if (!this.containerElement || !this.animationRenderer) return;

    this.canvasResizerService = new CanvasResizer();
    this.canvasResizerService.initialize(
      this.containerElement,
      this.animationRenderer
    );
  }

  private initializeGlyphTextureLoader(): void {
    if (!this.animationRenderer) return;

    this.glyphTextureService = new GlyphTextureLoader();
    this.glyphTextureService.initialize(this.animationRenderer);
  }

  private initializeRenderLoopService(): void {
    if (!this.animationRenderer) return;

    // Initialize fire overlay (lazy: only creates WebGL when first enabled)
    this.fireTipTracker = new FireTipTracker();
    this.ledTipTracker = new LedTipTracker();

    this.renderLoopService = new AnimationRenderLoop();
    this.renderLoopService.initialize({
      renderer: this.animationRenderer,
      TrailCapturer: this.trailCapturer,
      pathCache: this.precomputationService?.getPathCache() ?? null,
      canvasSize: this.canvasSize,
      frameBudgetMonitor: this.frameBudgetMonitor,
      fireTipTracker: this.fireTipTracker,
      ledTipTracker: this.ledTipTracker,
      onEffectError: this.callbacks.onEffectError,
    });

    this.trailOverlay = new TrailOverlayCanvas();
    this.trailOverlay.initialize(this.containerElement!, this.canvasSize, this.canvasSize);
    this.renderLoopService.updateConfig({ trailOverlay: this.trailOverlay });
  }

  /**
   * Initialize or destroy the fire overlay based on config.enabled.
   * Fire and charcoal are independent effects with independent renderers.
   */
  private syncFireOverlay(): void {
    const enabled = this.fireConfig.enabled;

    if (enabled) {
      if (!this.fireRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.fireRenderer = new WebGLFireRenderer();
        const success = this.fireRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.renderLoopService?.updateConfig({
            fireRenderer: this.fireRenderer,
          });
        } else {
          this.fireRenderer = null;
        }
      }
    } else {
      if (this.fireRenderer?.isInitialized()) {
        this.fireRenderer.dispose();
        this.fireRenderer = null;
      }
      this.renderLoopService?.updateConfig({ fireRenderer: null });
      if (!this.prevCharcoalEffect) {
        this.fireTipTracker?.reset();
      }
    }
  }

  /**
   * Initialize or destroy the charcoal overlay based on charcoalEffect state.
   * Charcoal is an independent effect with its own particle renderer.
   */
  private syncCharcoalOverlay(): void {
    const enabled = this.prevCharcoalEffect;

    if (enabled) {
      if (!this.charcoalRenderer?.isInitialized()) {
        if (!this.containerElement) return;
        this.charcoalRenderer = new CharcoalSparkRenderer();
        const success = this.charcoalRenderer.initialize(
          this.containerElement,
          this.canvasSize,
          this.canvasSize
        );
        if (success) {
          this.charcoalRenderer.setParams(this.getVM().getCharcoalParams());
          this.renderLoopService?.updateConfig({
            charcoalRenderer: this.charcoalRenderer,
          });
        } else {
          this.charcoalRenderer = null;
        }
      }
    } else {
      if (this.charcoalRenderer?.isInitialized()) {
        this.charcoalRenderer.dispose();
        this.charcoalRenderer = null;
      }
      this.renderLoopService?.updateConfig({ charcoalRenderer: null });
      if (!this.fireConfig.enabled) {
        this.fireTipTracker?.reset();
      }
    }

    // Trigger a render to start/stop charcoal loop
    if (this.renderLoopService && this.lastPropsRef) {
      this.renderLoopService.triggerRender(() =>
        this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
      );
    }
  }

  /**
   * Pause canvas resize observation during CSS transitions.
   * Prevents canvas buffer clears that cause black frames.
   */
  pauseResize(): void {
    this.canvasResizerService?.pauseObservation();
  }

  /**
   * Resume canvas resize observation after transitions complete.
   */
  resumeResize(): void {
    this.canvasResizerService?.resumeObservation();
  }

  /**
   * Set fire overlay configuration. Called by visibility state changes.
   */
  setFireConfig(config: Partial<FireOverlayConfig>): void {
    const wasEnabled = this.fireConfig.enabled;
    Object.assign(this.fireConfig, config);
    // Forward quality setting to renderer if present
    if (config.quality !== undefined && this.fireRenderer) {
      this.fireRenderer.setQuality(config.quality);
    }
    this.syncFireOverlay();

    // When fire toggles, trigger a dark mode sync so the renderer reflects current state
    if (config.enabled !== undefined && config.enabled !== wasEnabled && !this.previewDarkModeActive) {
      this.animationRenderer?.setDarkMode(this.prevDarkMode);
    }

    // Trigger a render to start/stop fire loop
    if (this.renderLoopService && this.lastPropsRef) {
      this.renderLoopService.triggerRender(() =>
        this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
      );
    }
  }

  /**
   * Get current fire overlay configuration.
   */
  getFireConfig(): FireOverlayConfig {
    return { ...this.fireConfig };
  }

  /**
   * Initialize or destroy the LED overlay based on config.enabled.
   * Creates the WebGL canvas lazily on first enable, removes on disable.
   *
   * IMPORTANT: LED WebGL initialization (shader compilation, framebuffer creation)
   * is deferred via requestAnimationFrame to prevent blocking the main thread
   * during Svelte effect processing. On Windows/ANGLE, synchronous shader
   * compilation can hang the page for seconds.
   */
  private syncLedOverlay(): void {
    if (this.ledConfig.enabled && !this.ledRenderer?.isInitialized()) {
      if (!this.containerElement || this.ledInitPending) return;
      // Defer WebGL initialization to avoid blocking the reactive effect chain.
      // Without this, shader compilation on Windows/ANGLE can freeze the entire page.
      this.ledInitPending = true;
      requestAnimationFrame(() => {
        this.ledInitPending = false;
        // Re-check: config or container may have changed while deferred
        if (!this.ledConfig.enabled || !this.containerElement) return;
        if (this.ledRenderer?.isInitialized()) return;
        try {
          this.ledRenderer = new WebGLLedRenderer();
          const success = this.ledRenderer.initialize(
            this.containerElement,
            this.canvasSize,
            this.canvasSize
          );
          if (success) {
            this.renderLoopService?.updateConfig({
              ledRenderer: this.ledRenderer,
            });
            // Trigger a render now that the renderer is ready
            if (this.renderLoopService && this.lastPropsRef) {
              this.renderLoopService.triggerRender(() =>
                this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
              );
            }
          } else {
            console.warn("[AnimationEngine] LED WebGL initialization failed");
            this.ledRenderer = null;
          }
        } catch (err) {
          console.error("[AnimationEngine] LED overlay init error:", err);
          this.ledRenderer = null;
        }
      });
    } else if (!this.ledConfig.enabled && this.ledRenderer) {
      this.ledRenderer.dispose();
      this.ledRenderer = null;
      this.renderLoopService?.updateConfig({ ledRenderer: null });
      this.ledTipTracker?.reset();
    }
  }

  /**
   * Set LED overlay configuration. Called by visibility state changes.
   */
  setLedConfig(config: Partial<LedOverlayConfig>): void {
    Object.assign(this.ledConfig, config);
    this.syncLedOverlay();

    // Trigger a render to start/stop LED loop
    if (this.renderLoopService && this.lastPropsRef) {
      this.renderLoopService.triggerRender(() =>
        this.getFrameParams(this.lastPropsRef ?? DEFAULT_ENGINE_PROPS)
      );
    }
  }

  /**
   * Get current LED overlay configuration.
   */
  getLedConfig(): LedOverlayConfig {
    return { ...this.ledConfig };
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
      trailSettings: this.enforceUnilateralConstraint(effectiveTrailSettings),
      bluePropType: this.state.currentBluePropType,
      redPropType: this.state.currentRedPropType,
    });

    this.trailSettingsSyncService?.initialize(this.trailCapturer, () =>
      this.renderLoopService?.triggerRender(() => this.getFrameParams(props))
    );

    // CRITICAL: Immediately sync external settings after initializing the sync service
    // This ensures trails work even if no more update() calls happen after initialization
    if (props.externalTrailSettings) {
      this.trailSettingsSyncService?.handleExternalSettingsSync(
        props.externalTrailSettings
      );
    }
  }

  private syncServiceState(): void {
    // PERF: Only write $state properties when the source value actually changed.
    // Unconditional writes trigger Svelte reactivity cascades (~15 $derived re-evaluations)
    // every frame even when nothing changed, causing measurable jank on mid-range devices.

    // Sync from precomputation service
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

    // Sync from prop type service — but ONLY when overrides are not active.
    // When overrides are set (e.g., landing page demo), the override detection
    // block in update() owns the prop type state. If we overwrite here, the
    // next frame's override check sees no change and the state reverts.
    if (
      this.propTypeChangeService &&
      this.propTypeOverrideBlue == null &&
      this.propTypeOverrideRed == null
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
    // Compare by value, not reference — $state proxies break === identity
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
        this.fireRenderer?.resize(newSize, newSize);
        this.ledRenderer?.resize(newSize, newSize);
        this.trailOverlay?.resize(newSize, newSize);
        // Reset fire/LED tip trackers so positions recalculate at the new canvas size.
        // Without this, after HMR the tracker uses stale positions from the old size.
        this.fireTipTracker?.reset();
        this.ledTipTracker?.reset();
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
   * Shows real-time position during animation (e.g., "2.5" for halfway through beat 2).
   * For steps with duration > 1, the decimal increments through the full range.
   *
   * Example: Beat 2 with duration 2 at 50% progress shows "3.0" (2 + 0.5×2)
   * Returns null to use the default beat number display.
   */
  private calculateMusicalPosition(props: AnimationEngineProps): string | null {
    // During animation playback, get continuous position from the orchestrator
    if (this.orchestrator && this.orchestrator.isInitialized()) {
      const continuousPosition = this.orchestrator.getContinuousMusicalPosition();

      // At start position (returns 0), show nothing
      if (continuousPosition <= 0) {
        return null;
      }

      // Format with one decimal place for cleaner display
      // e.g., 2.0, 2.5, 3.0, 3.5
      return continuousPosition.toFixed(1);
    }

    // Fallback: use beat data from props (static display, not animation)
    if (props.stepData && props.sequenceData) {
      const stepIndex = props.sequenceData.steps?.findIndex(
        (b) => b === props.stepData
      );
      if (stepIndex !== undefined && stepIndex >= 0) {
        const stepNumber = stepIndex + 1;
        // For static display, just show the beat number with .0
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
      a.enabled !== b.enabled ||
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
      a.previewMode !== b.previewMode
    );
  }

  /**
   * Enforce unilateral prop constraint on trail settings.
   * Unilateral props (fan, club, minihoop, etc.) only have one meaningful
   * endpoint, so BOTH_ENDS must be overridden to RIGHT_END.
   */
  private enforceUnilateralConstraint(settings: TrailSettings): TrailSettings {
    if (settings.trackingMode !== TrackingMode.BOTH_ENDS) return settings;

    const blue = this.state.currentBluePropType;
    const red = this.state.currentRedPropType;
    const blueIsBilateral = isBilateralProp(blue);
    const redIsBilateral = isBilateralProp(red);

    // Only allow BOTH_ENDS when at least one prop is bilateral
    if (blueIsBilateral || redIsBilateral) return settings;

    return { ...settings, trackingMode: TrackingMode.RIGHT_END };
  }

  /**
   * Return trail settings with unilateral prop constraint enforced.
   * During prop type changes, trails are suppressed entirely to prevent
   * stale endpoint data from rendering as a visible jump line.
   */
  private getEffectiveTrailSettings(): TrailSettings {
    const settings = this.enforceUnilateralConstraint(this.state.trailSettings);
    if (this.trailsSuppressedUntilTextureLoad) {
      return { ...settings, enabled: false };
    }
    return settings;
  }

  /**
   * Generate a hash string representing sequence content that affects animation.
   * Includes motion data fingerprint so transforms (rotate, mirror, etc.) trigger re-precomputation.
   */
  private getSequenceContentHash(seq: SequenceData): string {
    const stepCount = seq.steps?.length || 0;
    // Build a compact fingerprint of each step's motion data.
    // Transforms change startLocation, endLocation, rotationDirection, orientations —
    // we must detect these changes to re-precompute path caches.
    const motionFingerprint = seq.steps
      ?.map((s) => {
        const b = s.motions?.blue;
        const r = s.motions?.red;
        const bPart = b
          ? `${b.startLocation}${b.endLocation}${b.motionType}${b.rotationDirection}${b.turns}`
          : "_";
        const rPart = r
          ? `${r.startLocation}${r.endLocation}${r.motionType}${r.rotationDirection}${r.turns}`
          : "_";
        return `${bPart}|${rPart}`;
      })
      .join(";") || "";
    return `${seq.id || seq.word || "unknown"}-${stepCount}-${motionFingerprint}`;
  }

  /**
   * Recompute which hands have motion data, cached per sequence identity.
   * For single-hand sequences (assembly in progress), this lets us null out
   * the missing hand's prop so the renderer doesn't draw it.
   */
  private updateHandPresenceCache(): void {
    const seq = this.prevSequenceData;
    const steps = seq?.steps;
    const cacheKey = seq ? (seq.id || seq.word || "") + "-" + (steps?.length ?? 0) : null;

    if (cacheKey === this.handPresenceCacheKey) return;
    this.handPresenceCacheKey = cacheKey;

    if (!seq || !steps || steps.length === 0) {
      this.sequenceHasBlueMotion = true;
      this.sequenceHasRedMotion = true;
      return;
    }

    let hasBlue = false;
    let hasRed = false;

    // Check start position
    const startPos = seq.startPosition ?? seq.startingPosition;
    if (startPos?.motions?.blue) hasBlue = true;
    if (startPos?.motions?.red) hasRed = true;

    // Check all steps
    for (const step of steps) {
      if (step.motions?.blue) hasBlue = true;
      if (step.motions?.red) hasRed = true;
      if (hasBlue && hasRed) break;
    }

    this.sequenceHasBlueMotion = hasBlue;
    this.sequenceHasRedMotion = hasRed;
  }

  /**
   * Get frame params by mutating reusable object (avoids 180 allocations/sec GC pressure)
   */
  private getFrameParams(props: AnimationEngineProps): RenderFrameParams {
    // Mutate the reusable object instead of creating new ones each frame
    const fp = this.frameParams;
    fp.stepData = props.stepData ?? null;
    fp.currentStep = props.currentStep ?? 0;
    fp.trailSettings = this.getEffectiveTrailSettings();
    fp.gridVisible = props.gridVisible ?? true;
    fp.gridMode = props.gridMode ?? GridMode.DIAMOND;
    fp.letter = props.letter ?? null;

    // Mutate nested props object
    fp.props.blueProp = props.blueProp;
    fp.props.redProp = props.redProp;

    // For single-hand sequences (e.g., during assembly), null out the missing
    // hand's prop so the renderer skips drawing it entirely.
    this.updateHandPresenceCache();
    if (!this.sequenceHasBlueMotion) fp.props.blueProp = null;
    if (!this.sequenceHasRedMotion) fp.props.redProp = null;
    fp.props.additionalLayers = props.additionalLayers ?? [];
    fp.props.bluePropDimensions = this.state.bluePropDimensions;
    fp.props.redPropDimensions = this.state.redPropDimensions;

    // Mutate nested visibility object
    fp.visibility.gridVisible = this.state.visibilityState.grid;
    fp.visibility.propsVisible = this.state.visibilityState.props;
    fp.visibility.trailsVisible = this.state.visibilityState.trails;
    fp.visibility.blueMotionVisible = this.state.visibilityState.blueMotion;
    fp.visibility.redMotionVisible = this.state.visibilityState.redMotion;

    // Set isPlaying to control render loop continuation
    fp.isPlaying = props.isPlaying ?? false;

    // Get flip settings from settings service
    // - Buugeng family: user preference (asymmetric props)
    // - Hand: red hand always flipped (left/right hands are anatomically mirrored)
    const settings = this.settingsService?.currentSettings;
    const buugengFamily = ["buugeng", "bigbuugeng", "fractalgeng"];
    const bluePropType = this.state.currentBluePropType.toLowerCase();
    const redPropType = this.state.currentRedPropType.toLowerCase();

    // Blue prop: Buugeng family uses user preference, hand is never flipped (it's the left hand)
    fp.bluePropFlipped = buugengFamily.includes(bluePropType)
      ? (settings?.blueBuugengFlipped ?? false)
      : false;

    // Red prop: Hand is always flipped (right hand mirror), Buugeng uses user preference
    fp.redPropFlipped =
      redPropType === "hand"
        ? true
        : buugengFamily.includes(redPropType)
          ? (settings?.redBuugengFlipped ?? false)
          : false;

    // Pass prop types for prop-specific rendering rules (e.g., hands never rotate)
    fp.bluePropType = bluePropType;
    fp.redPropType = redPropType;

    // Fire/charcoal overlay config — pass when either effect is active
    fp.fireConfig = (this.fireConfig.enabled || this.prevCharcoalEffect) ? this.fireConfig : null;
    fp.darkMode = this.prevDarkMode;
    // Prop colors for colored flames (default blue/red)
    fp.propColors = DEFAULT_PROP_FLAME_COLORS;

    // LED overlay config
    fp.ledConfig = this.ledConfig.enabled ? this.ledConfig : null;

    // Playback speed for fire cache invalidation
    const vmRef = this.getVM();
    fp.playbackSpeed = vmRef.getSpeed();

    // Step mode: disable fire frame cache so flames track actual prop positions.
    // The cache records during continuous playback and replays using wall-clock time,
    // which drifts from prop positions during step mode's discrete pauses.
    if (fp.fireConfig) {
      fp.fireConfig.disableFrameCache = vmRef.getPlaybackMode() === "step";
    }

    // Sequence identity for fire cache invalidation (new sequence = invalidate stale fire frames)
    fp.sequenceContentHash = this.lastSequenceContentHash ?? undefined;

    // Seamless loop flag for trail wrap-around.
    // Auto-detect from sequence data when not explicitly provided by parent.
    // Cached per sequence to avoid recomputing on every frame.
    if (props.isSeamlesslyLoopable != null) {
      fp.isSeamlesslyLoopable = props.isSeamlesslyLoopable;
    } else if (props.sequenceData) {
      const hash = this.lastSequenceContentHash;
      if (hash !== this.loopabilityCacheHash) {
        this.cachedIsSeamlesslyLoopable =
          sequenceLoopabilityChecker.isSeamlesslyLoopable(props.sequenceData);
        this.loopabilityCacheHash = hash;
      }
      fp.isSeamlesslyLoopable = this.cachedIsSeamlesslyLoopable;
    } else {
      fp.isSeamlesslyLoopable = false;
    }

    return fp;
  }
}

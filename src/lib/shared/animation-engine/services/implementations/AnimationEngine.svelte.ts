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
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ISVGGenerator } from "$lib/features/compose/services/contracts/ISVGGenerator";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
import type { PropState } from "../../domain/PropState";
import type { TrailSettings } from "../../domain/types/TrailTypes";
import type { RenderFrameParams } from "../contracts/IAnimationRenderLoop";
import type { AnimationVisibilityState } from "../contracts/IAnimationVisibilitySynchronizer";
import type { PreRenderProgress } from "$lib/features/compose/services/implementations/SequenceFramePreRenderer";

import { loadAnimatorServices as loadServices } from "./AnimatorLoader";
import { loadTrailSettings } from "$lib/features/compose/utils/animation-panel-persistence";
import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";

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
import { AnimationVisibilitySynchronizer } from "./AnimationVisibilitySynchronizer";
import { GlyphTransitionController } from "./GlyphTransitionController.svelte";
import type { IGlyphTransitionController } from "../contracts/IGlyphTransitionController";
import { SequenceCache } from "./SequenceCache.svelte";
import { TrailSettingsSynchronizer } from "./TrailSettingsSynchronizer.svelte";
import { PropTypeChanger } from "./PropTypeChanger.svelte";
import { AnimatorCanvasInitializer } from "./AnimatorCanvasInitializer";

/**
 * Props passed to engine.update()
 */
export interface AnimationEngineProps {
  blueProp: PropState | null;
  redProp: PropState | null;
  secondaryBlueProp?: PropState | null;
  secondaryRedProp?: PropState | null;
  gridVisible?: boolean;
  gridMode?: GridMode | null;
  backgroundAlpha?: number;
  letter?: Letter | null;
  beatData?: StartPositionData | BeatData | null;
  sequenceData?: SequenceData | null;
  currentBeat?: number;
  isPlaying?: boolean;
  externalTrailSettings?: TrailSettings;
  // Prop type overrides - bypass settings when provided (useful for demos/previews)
  bluePropType?: string | null;
  redPropType?: string | null;
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
  displayedBeatNumber: number | null;
  fadingOutLetter: Letter | null;
  fadingOutTurnsTuple: string | null;
  fadingOutBeatNumber: number | null;
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
      beatNumbers: true,
      props: true,
      trails: true,
      tkaGlyph: true, // TKA Glyph includes turn numbers
      blueMotion: true,
      redMotion: true,
      darkMode: false,
    },
    isPreRendering: false,
    preRenderProgress: null,
    preRenderedFramesReady: false,
    displayedLetter: null,
    displayedTurnsTuple: "(s, 0, 0)",
    displayedBeatNumber: null,
    fadingOutLetter: null,
    fadingOutTurnsTuple: null,
    fadingOutBeatNumber: null,
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

  // ============================================================================
  // PRIVATE STATE
  // ============================================================================
  private containerElement: HTMLDivElement | null = null;
  private callbacks: AnimationEngineCallbacks = {};
  private canvasSize = DEFAULT_CANVAS_SIZE;
  private instanceId = Math.random().toString(36).substring(2, 8);
  private settingsLoaded = false;
  private previousGridMode: string | null = null;
  private cacheSequenceId: string | null = null;
  private unsubscribeVisibility: (() => void) | null = null;
  private lastTextureReloadSignal: number = 0;

  // Previous props for change detection (only track what we compare)
  private prevBeatData: StartPositionData | BeatData | null = null;
  private prevSequenceData: SequenceData | null = null;
  private prevIsPlaying: boolean = false;
  private prevGridMode: GridMode | null = null;

  // Prop type overrides (bypass settings when provided)
  private propTypeOverrideBlue: string | null = null;
  private propTypeOverrideRed: string | null = null;
  private prevDarkMode: boolean = false;

  // Simple reference to last props for initial render (not a copy - avoids GC)
  private lastPropsRef: AnimationEngineProps | null = null;

  // Reusable frame params object to avoid GC pressure (created once, mutated each frame)
  private readonly frameParams: RenderFrameParams = {
    beatData: null,
    currentBeat: 0,
    trailSettings: null as unknown as TrailSettings,
    gridVisible: true,
    gridMode: GridMode.DIAMOND,
    letter: null,
    props: {
      blueProp: null,
      redProp: null,
      secondaryBlueProp: null,
      secondaryRedProp: null,
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
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

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
    const visibilityManager = getAnimationVisibilityManager();
    this.prevDarkMode = visibilityManager.isDarkMode();
    this.state.visibilityState = {
      grid: visibilityManager.getGridMode() !== "none",
      beatNumbers: visibilityManager.getVisibility("beatNumbers"),
      props: visibilityManager.getVisibility("props"),
      trails: visibilityManager.getTrailStyle() !== "off",
      tkaGlyph: visibilityManager.getVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      blueMotion: visibilityManager.getVisibility("blueMotion"),
      redMotion: visibilityManager.getVisibility("redMotion"),
      darkMode: visibilityManager.isDarkMode(),
    };

    // Initialize services that don't need renderer
    this.visibilitySyncService = new AnimationVisibilitySynchronizer();
    this.unsubscribeVisibility = this.visibilitySyncService.subscribe(
      (state) => {
        this.state.visibilityState = state;

        // Sync Dark Mode to renderer when it changes
        if (state.darkMode !== this.prevDarkMode) {
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
      }
    );

    this.glyphTransitionService = new GlyphTransitionController();
    this.sequenceCacheService = new SequenceCache();
    this.trailSettingsSyncService = new TrailSettingsSynchronizer();
    this.propTypeChangeService = new PropTypeChanger();

    // Initialize canvas (async process)
    await this.initializeCanvas();
  }

  /**
   * Update with new props - handles all orchestration logic
   */
  update(props: AnimationEngineProps): void {
    // Keep simple reference for initial render (no copy, just reference)
    this.lastPropsRef = props;

    // Track only what we actually compare (avoid object spread GC pressure)
    const prevBeatData = this.prevBeatData;
    const prevSequenceData = this.prevSequenceData;
    this.prevBeatData = props.beatData ?? null;
    this.prevSequenceData = props.sequenceData ?? null;
    this.prevIsPlaying = props.isPlaying ?? false;
    this.prevGridMode = props.gridMode ?? null;

    // Sync state from services that own reactive state
    this.syncServiceState();

    // Handle settings loaded detection
    if (!this.settingsLoaded) {
      if (
        this.state.currentBluePropType !== "staff" ||
        this.state.currentRedPropType !== "staff" ||
        this.settingsService?.currentSettings
      ) {
        this.settingsLoaded = true;
        this.initializeTrailCapturer(props);
      }
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

        // Hot-swap textures
        this.loadPropTextures().then(() => {
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
        }

        // Hot-swap textures without full re-initialization
        // The render loop keeps running with old textures until new ones load
        this.loadPropTextures().then(() => {
          // Trigger immediate re-render once new textures are ready
          if (this.state.isInitialized) {
            this.renderLoopService?.triggerRender(() =>
              this.getFrameParams(props)
            );
          }
        });
      }
    }

    // Handle trail settings changes
    if (props.externalTrailSettings !== undefined) {
      this.trailSettingsSyncService?.handleExternalSettingsSync(
        props.externalTrailSettings
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

    // Handle cache clear signals
    const clearSignal = this.sequenceCacheService?.state.clearSignal;
    if (clearSignal && clearSignal > 0) {
      this.precomputationService?.clearCaches();
      this.trailCapturer?.clearTrails();
      this.cacheSequenceId = null;
    }

    // Handle pre-render clear signals
    const preRenderClearSignal =
      this.sequenceCacheService?.state.preRenderClearSignal;
    if (preRenderClearSignal && preRenderClearSignal > 0) {
      this.precomputationService?.clearPreRenderedFrames();
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

    // Handle prop visibility changes - clear trails when both hidden
    if (!props.blueProp && !props.redProp) {
      this.trailCapturer?.clearTrails();
    }

    // Update trail capturer with prop type changes
    if (this.trailCapturer && this.settingsLoaded) {
      this.trailCapturer.updateConfig({
        bluePropType: this.state.currentBluePropType,
        redPropType: this.state.currentRedPropType,
      });
    }

    // Update glyph transition
    const beatNumber = this.calculateBeatNumber(props);
    const turnsTuple = this.calculateTurnsTuple(props);
    this.glyphTransitionService?.updateTarget(
      props.letter ?? null,
      turnsTuple,
      beatNumber
    );

    // Sync glyph state immediately after update so component sees new values
    // (syncServiceState() at start of update() syncs previous frame's values)
    if (this.glyphTransitionService) {
      this.state.displayedLetter =
        this.glyphTransitionService.state.displayedLetter;
      this.state.displayedTurnsTuple =
        this.glyphTransitionService.state.displayedTurnsTuple;
      this.state.displayedBeatNumber =
        this.glyphTransitionService.state.displayedBeatNumber;
      this.state.fadingOutLetter =
        this.glyphTransitionService.state.fadingOutLetter;
      this.state.fadingOutTurnsTuple =
        this.glyphTransitionService.state.fadingOutTurnsTuple;
      this.state.fadingOutBeatNumber =
        this.glyphTransitionService.state.fadingOutBeatNumber;
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
    this.prevBeatData = null;
    this.prevSequenceData = null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async initializeCanvas(): Promise<void> {
    if (!this.containerElement) return;

    await this.canvasInitializer.initialize(
      {
        containerElement: this.containerElement,
        backgroundAlpha: 1,
        gridMode: GridMode.DIAMOND,
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
          // Set initial Dark Mode on renderer
          renderer.setDarkMode(this.prevDarkMode);
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
    if (!services.orchestrator) {
      this.state.rendererError =
        "Failed to load animation orchestrator service";
      return false;
    }
    if (!services.TrailCapturer) {
      this.state.rendererError = "Failed to load trail capture service";
      return false;
    }

    this.svgGenerator = services.svgGenerator;
    this.settingsService = services.settingsService;
    this.orchestrator = services.orchestrator;
    this.trailCapturer = services.TrailCapturer;
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

    await this.propTextureService.loadPropTextures(bluePropType, redPropType);

    // CRITICAL: Sync dimensions to engine state immediately after loading
    // This ensures getFrameParams() has correct dimensions for the first render
    this.state.bluePropDimensions =
      this.propTextureService.state.blueDimensions;
    this.state.redPropDimensions = this.propTextureService.state.redDimensions;
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

    this.renderLoopService = new AnimationRenderLoop();
    this.renderLoopService.initialize({
      renderer: this.animationRenderer,
      TrailCapturer: this.trailCapturer,
      pathCache: this.precomputationService?.getPathCache() ?? null,
      canvasSize: this.canvasSize,
    });
  }

  private initializeTrailCapturer(props: AnimationEngineProps): void {
    if (!this.trailCapturer || !this.settingsLoaded) return;

    this.trailCapturer.initialize({
      canvasSize: this.canvasSize,
      bluePropDimensions: this.state.bluePropDimensions,
      redPropDimensions: this.state.redPropDimensions,
      trailSettings: this.state.trailSettings,
      bluePropType: this.state.currentBluePropType,
      redPropType: this.state.currentRedPropType,
    });

    this.trailSettingsSyncService?.initialize(this.trailCapturer, () =>
      this.renderLoopService?.triggerRender(() => this.getFrameParams(props))
    );
  }

  private syncServiceState(): void {
    // Sync from precomputation service
    if (this.precomputationService) {
      this.state.isPreRendering =
        this.precomputationService.state.isPreRendering;
      this.state.preRenderProgress =
        this.precomputationService.state.preRenderProgress;
      this.state.preRenderedFramesReady =
        this.precomputationService.state.preRenderedFramesReady;
    }

    // Sync from glyph transition service
    if (this.glyphTransitionService) {
      this.state.displayedLetter =
        this.glyphTransitionService.state.displayedLetter;
      this.state.displayedTurnsTuple =
        this.glyphTransitionService.state.displayedTurnsTuple;
      this.state.displayedBeatNumber =
        this.glyphTransitionService.state.displayedBeatNumber;
      this.state.fadingOutLetter =
        this.glyphTransitionService.state.fadingOutLetter;
      this.state.fadingOutTurnsTuple =
        this.glyphTransitionService.state.fadingOutTurnsTuple;
      this.state.fadingOutBeatNumber =
        this.glyphTransitionService.state.fadingOutBeatNumber;
      this.state.isNewLetter = this.glyphTransitionService.state.isNewLetter;
    }

    // Sync from prop type service
    if (this.propTypeChangeService) {
      this.state.currentBluePropType =
        this.propTypeChangeService.state.bluePropType;
      this.state.currentRedPropType =
        this.propTypeChangeService.state.redPropType;
      this.state.currentPropType =
        this.propTypeChangeService.state.legacyPropType;
    }

    // Sync from prop texture service
    if (this.propTextureService) {
      this.state.bluePropDimensions =
        this.propTextureService.state.blueDimensions;
      this.state.redPropDimensions =
        this.propTextureService.state.redDimensions;
    }

    // Sync from resize service
    if (this.canvasResizerService) {
      const newSize = this.canvasResizerService.state.currentSize;
      if (newSize && newSize !== this.canvasSize) {
        this.canvasSize = newSize;
        this.trailCapturer?.updateConfig({ canvasSize: newSize });
      }
    }
  }

  private calculateBeatNumber(props: AnimationEngineProps): number {
    if (!props.sequenceData || !props.beatData) return 0;

    const beatIndex = props.sequenceData.beats?.findIndex(
      (b) => b === props.beatData
    );
    if (beatIndex !== undefined && beatIndex >= 0) {
      return beatIndex + 1;
    }
    return 0;
  }

  private calculateTurnsTuple(props: AnimationEngineProps): string {
    if (
      !props.beatData ||
      !props.beatData.motions?.blue ||
      !props.beatData.motions?.red
    ) {
      return "(s, 0, 0)";
    }
    return (
      this.turnsTupleGenerator?.generateTurnsTuple(props.beatData) ??
      "(s, 0, 0)"
    );
  }

  /**
   * Shallow comparison of trail settings (faster than JSON.stringify)
   */
  private trailSettingsChanged(a: TrailSettings, b: TrailSettings): boolean {
    return (
      a.enabled !== b.enabled ||
      a.mode !== b.mode ||
      a.style !== b.style ||
      a.fadeDurationMs !== b.fadeDurationMs ||
      a.maxPoints !== b.maxPoints ||
      a.lineWidth !== b.lineWidth ||
      a.glowEnabled !== b.glowEnabled ||
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
   * Get frame params by mutating reusable object (avoids 180 allocations/sec GC pressure)
   */
  private getFrameParams(props: AnimationEngineProps): RenderFrameParams {
    // Mutate the reusable object instead of creating new ones each frame
    const fp = this.frameParams;
    fp.beatData = props.beatData ?? null;
    fp.currentBeat = props.currentBeat ?? 0;
    fp.trailSettings = this.state.trailSettings;
    fp.gridVisible = props.gridVisible ?? true;
    fp.gridMode = props.gridMode ?? GridMode.DIAMOND;
    fp.letter = props.letter ?? null;

    // Mutate nested props object
    fp.props.blueProp = props.blueProp;
    fp.props.redProp = props.redProp;
    fp.props.secondaryBlueProp = props.secondaryBlueProp ?? null;
    fp.props.secondaryRedProp = props.secondaryRedProp ?? null;
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

    // Get Buugeng flip settings from settings service
    // Only apply flip for Buugeng family props (buugeng, bigbuugeng, fractalgeng)
    const settings = this.settingsService?.currentSettings;
    const buugengFamily = ["buugeng", "bigbuugeng", "fractalgeng"];
    const bluePropType = this.state.currentBluePropType.toLowerCase();
    const redPropType = this.state.currentRedPropType.toLowerCase();

    fp.bluePropFlipped = buugengFamily.includes(bluePropType)
      ? (settings?.blueBuugengFlipped ?? false)
      : false;
    fp.redPropFlipped = buugengFamily.includes(redPropType)
      ? (settings?.redBuugengFlipped ?? false)
      : false;

    return fp;
  }
}

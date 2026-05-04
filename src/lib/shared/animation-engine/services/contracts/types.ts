import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { TrailSettings } from "../../domain/types/TrailTypes";
import type { SequenceAnimationOrchestrator } from "$lib/features/compose/services/implementations/SequenceAnimationOrchestrator";
import type { ITrailCapturer as TrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { IAnimationRenderer as AnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { AnimationPathCache, AnimationPathCacheData } from "$lib/features/compose/services/implementations/AnimationPathCache";
import type { PreRenderProgress, SequenceFramePreRenderer } from "$lib/features/compose/services/implementations/SequenceFramePreRenderer";
import type { AdditionalLayerProps } from "$lib/features/compose/services/contracts/types";
import type { PropState } from "$lib/shared/animation-engine/domain/PropState";
import type { FrameBudgetMonitor } from "$lib/shared/animation-engine/services/implementations/FrameBudgetMonitor";
import type { WebGLFireRenderer } from "$lib/shared/animation-engine/services/implementations/fire/WebGLFireRenderer";
import type { CharcoalSparkRenderer } from "$lib/shared/animation-engine/services/implementations/charcoal/CharcoalSparkRenderer";
import type { FireTipTracker } from "../implementations/FireTipTracker";
import type {
  FireOverlayConfig,
  PropFlameColor,
  PropTipData,
  RenderedPropTransform,
} from "../../domain/types/FireTypes";
import type { WebGLLedRenderer } from "$lib/shared/animation-engine/services/implementations/led/WebGLLedRenderer";
import type { LedTipTracker } from "../implementations/LedTipTracker";
import type { ITrailOverlayCanvas } from "./ITrailOverlayCanvas";
import type { ZapOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/ZapOverlayRenderer";
import type { SparklesOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/SparklesOverlayRenderer";
import type { EchoOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/EchoOverlayRenderer";
import type { BloomOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/BloomOverlayRenderer";
import type { WaterOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/WaterOverlayRenderer";
import type { BubblesOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/BubblesOverlayRenderer";
import type { PetalsOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/PetalsOverlayRenderer";
import type { SmokeOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/SmokeOverlayRenderer";
import type { InkOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/InkOverlayRenderer";
import type { FrostOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/FrostOverlayRenderer";
import type { SilkOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/SilkOverlayRenderer";
import type { PulseOverlayRenderer } from "$lib/shared/animation-engine/services/implementations/PulseOverlayRenderer";
import type { LedOverlayConfig, LedTipData } from "../../domain/types/LedTypes";
import type {
  Bloom2DParams,
  Bubbles2DParams,
  Echo2DParams,
  Frost2DParams,
  Ink2DParams,
  Petals2DParams,
  Pulse2DParams,
  Silk2DParams,
  Smoke2DParams,
  Sparkles2DParams,
  Water2DParams,
  Zap2DParams,
} from "$lib/shared/effects/translators/canvas2d-types";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { EffectType, TipEffectMap } from "../../domain/types/TipEffectTypes";
import type { KeyboardShortcutManager } from "$lib/shared/keyboard/services/implementations/KeyboardShortcutManager";
import type { ISVGGenerator } from "$lib/features/compose/services/contracts/ISVGGenerator";
import type { TurnsTupleGenerator } from "../../../pictograph/arrow/positioning/placement/services/implementations/TurnsTupleGenerator";
import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";
import type { AnimationPlaybackController } from "$lib/features/compose/services/implementations/AnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
// --- From AnimationPrecomputer ---
/**
 * Animation Precomputer Interface
 *
 * Manages pre-computation of animation data for smooth playback:
 * - Path cache pre-computation for gap-free trail rendering
 * - Frame pre-rendering for perfect smooth playback
 */

/**
 * Prop dimensions for cache configuration
 */
export interface PropDimensions {
  width: number;
  height: number;
}

/**
 * Configuration for precomputation service
 */
export interface PrecomputationServiceConfig {
  orchestrator: SequenceAnimationOrchestrator;
  TrailCapturer: TrailCapturer | null;
  renderer: AnimationRenderer | null;
  propDimensions: PropDimensions;
  canvasSize: number;
  instanceId?: string;
}

/**
 * Reactive state owned by the service
 */
export interface PrecomputationState {
  pathCacheData: AnimationPathCacheData | null;
  isCachePrecomputing: boolean;
  isPreRendering: boolean;
  preRenderProgress: PreRenderProgress | null;
  preRenderedFramesReady: boolean;
}

/**
 * Service for managing animation precomputation
 */

// --- From AnimationRenderLoop ---
/**
 * Animation Render Loop Interface
 *
 * Manages the requestAnimationFrame render loop for AnimatorCanvas.
 * Handles RAF scheduling, trail point gathering, and scene rendering.
 */

/**
 * Configuration for render loop initialization
 */
export interface RenderLoopConfig {
  renderer: AnimationRenderer;
  TrailCapturer: TrailCapturer | null;
  pathCache: AnimationPathCache | null;
  canvasSize: number;
  frameBudgetMonitor?: FrameBudgetMonitor | null;
  /** Optional fire overlay renderer (WebGL fluid simulation on top of Canvas2D) */
  fireRenderer?: WebGLFireRenderer | null;
  /** Optional charcoal overlay renderer (WebGL2 point-sprite particles) */
  charcoalRenderer?: CharcoalSparkRenderer | null;
  /** Optional fire/charcoal tip position/velocity tracker (shared by both) */
  fireTipTracker?: FireTipTracker | null;
  /** Optional LED overlay renderer (WebGL layer on top of fire) */
  ledRenderer?: WebGLLedRenderer | null;
  /** Optional LED tip position/color tracker */
  ledTipTracker?: LedTipTracker | null;
  /** Trail overlay canvas for persistent cross-sequence trails */
  trailOverlay?: ITrailOverlayCanvas | null;
  /** Optional zap (lightning) overlay renderer that draws procedural arcs between prop tips */
  zapRenderer?: ZapOverlayRenderer | null;
  /** Optional sparkles overlay renderer that draws particle sparkles around prop tips */
  sparklesRenderer?: SparklesOverlayRenderer | null;
  /** Optional echo overlay renderer that draws beat-onset phantoms of the staff */
  echoRenderer?: EchoOverlayRenderer | null;
  /** Optional bloom overlay renderer that draws per-tip radial halos */
  bloomRenderer?: BloomOverlayRenderer | null;
  /** Optional water overlay renderer that spawns per-tip droplets */
  waterRenderer?: WaterOverlayRenderer | null;
  /** Optional bubbles overlay renderer that spawns per-tip buoyant bubbles */
  bubblesRenderer?: BubblesOverlayRenderer | null;
  /** Optional petals overlay renderer that spawns per-tip falling petals */
  petalsRenderer?: PetalsOverlayRenderer | null;
  /** Optional smoke overlay renderer that spawns per-tip curl-noise puffs */
  smokeRenderer?: SmokeOverlayRenderer | null;
  /** Optional ink overlay renderer that draws per-tip calligraphic strokes */
  inkRenderer?: InkOverlayRenderer | null;
  /** Optional frost overlay renderer that spawns per-tip cold aura particles */
  frostRenderer?: FrostOverlayRenderer | null;
  /** Optional silk overlay renderer that draws per-tip deformable ribbons */
  silkRenderer?: SilkOverlayRenderer | null;
  /** Optional pulse overlay renderer that draws expanding wave rings from tip positions */
  pulseRenderer?: PulseOverlayRenderer | null;
  /** Called when an effect (fire/charcoal/LED) fails repeatedly and is auto-disabled */
  onEffectError?: (effectName: string, error: Error) => void;
}

/**
 * Visibility settings for render
 */
export interface RenderVisibilitySettings {
  gridVisible: boolean;
  propsVisible: boolean;
  trailsVisible: boolean;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

/**
 * Props state for rendering
 */
export interface RenderPropsState {
  blueProp: PropState | null;
  redProp: PropState | null;
  /** Additional tunnel layers (index 0 = layer 1, up to 3) */
  additionalLayers: AdditionalLayerProps[];
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
}

/**
 * Parameters for a single render frame
 */
export interface RenderFrameParams {
  stepData: StartPositionData | StepData | null;
  currentStep: number;
  trailSettings: TrailSettings;
  gridVisible: boolean;
  gridMode: GridMode | null;
  letter: Letter | null;
  props: RenderPropsState;
  visibility: RenderVisibilitySettings;
  /** Whether animation playback is active (controls render loop continuation) */
  isPlaying: boolean;
  /** Prop flip settings (for asymmetric props like Buugeng) */
  bluePropFlipped?: boolean;
  redPropFlipped?: boolean;
  /** Prop types - used for prop-specific rendering rules (e.g., hands never rotate) */
  bluePropType?: string;
  redPropType?: string;
  /** Fire overlay configuration (null or undefined = disabled) */
  fireConfig?: FireOverlayConfig | null;
  /** Whether dark mode is active (used by fire renderer for intensity boost) */
  darkMode?: boolean;
  /** Prop colors for colored flames: [leftPropColor, rightPropColor] */
  propColors?: [PropFlameColor, PropFlameColor];
  /** LED overlay configuration (null or undefined = disabled) */
  ledConfig?: LedOverlayConfig | null;
  /** Zap (lightning) overlay parameters (null or undefined = disabled) */
  zapConfig?: Zap2DParams | null;
  /** Sparkles overlay parameters (null or undefined = disabled) */
  sparklesConfig?: Sparkles2DParams | null;
  /** Echo overlay parameters (null or undefined = disabled) */
  echoConfig?: Echo2DParams | null;
  /** Bloom overlay parameters (null or undefined = disabled) */
  bloomConfig?: Bloom2DParams | null;
  /** Water overlay parameters (null or undefined = disabled) */
  waterConfig?: Water2DParams | null;
  /** Bubbles overlay parameters (null or undefined = disabled) */
  bubblesConfig?: Bubbles2DParams | null;
  /** Petals overlay parameters (null or undefined = disabled) */
  petalsConfig?: Petals2DParams | null;
  /** Smoke overlay parameters (null or undefined = disabled) */
  smokeConfig?: Smoke2DParams | null;
  /** Ink overlay parameters (null or undefined = disabled) */
  inkConfig?: Ink2DParams | null;
  /** Frost overlay parameters (null or undefined = disabled) */
  frostConfig?: Frost2DParams | null;
  /** Silk overlay parameters (null or undefined = disabled) */
  silkConfig?: Silk2DParams | null;
  /** Pulse overlay parameters (null or undefined = disabled) */
  pulseConfig?: Pulse2DParams | null;
  /** Playback speed multiplier (1.0 = 60 BPM). Passed to fire for cache invalidation. */
  playbackSpeed?: number;
  /** Whether sequence loops seamlessly (end position = start position).
   *  When true, trail rendering wraps around the loop boundary instead of resetting. */
  isSeamlesslyLoopable?: boolean;
  /** Changes when the sequence content changes. Invalidates fire cache. */
  sequenceContentHash?: string;
  /** Per-tip effect assignments (global level). Used to filter tips by effect type. */
  tipEffectMap?: TipEffectMap;
  /** When true, skip fire/charcoal/LED/trail overlay rendering (3D mode handles effects) */
  suppress2DOverlays?: boolean;
  /** Virtual time for this frame (in ms). Used during video export to ensure
   * deterministic trail capture and effect timing regardless of real-time
   * rendering performance. When provided, replaces performance.now(). */
  virtualTime?: number;
}

/**
 * Service for managing the animation render loop
 */

// --- From AnimationShortcutRegistrar ---
/**
 * Animation Shortcut Registrar Interface
 *
 * Registers and unregisters keyboard shortcuts for the animation viewer panel.
 */

export interface AnimationShortcutHandlers {
  onPlaybackToggle: () => void;
  onStepHalfBeatForward: () => void;
  onStepHalfBeatBackward: () => void;
  onStepFullBeatForward: () => void;
  onStepFullBeatBackward: () => void;
  onClose: () => void;
  onToggleBlue?: () => void;
  onToggleRed?: () => void;
  onShowHelp: () => void;
}

export interface AnimationShortcutDefinition {
  key: string;
  label: string;
  description: string;
}

// --- From AnimationVisibilitySynchronizer ---
/**
 * Animation Visibility Sync Service Interface
 *
 * Provides a clean interface for components to subscribe to all
 * animation visibility settings at once, eliminating repetitive
 * individual state variable syncing.
 */

/**
 * All visibility settings as a single object
 */
export interface AnimationVisibilityState {
  grid: boolean;
  stepNumbers: boolean;
  props: boolean;
  trails: boolean;
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  /** Dark Mode: dark background, inverted grid, white text/outlines */
  darkMode: boolean;
  /** Word header overlay showing sequence name */
  wordHeader: boolean;
  activeEffect: EffectType;
  tipEffectMap: TipEffectMap;
}

/**
 * Callback for visibility state changes
 */
export type VisibilityStateCallback = (state: AnimationVisibilityState) => void;

/**
 * Service for syncing animation visibility state
 */

// --- From AnimatorCanvasInitializer ---
/**
 * Animator Canvas Initializer Service Interface
 *
 * Orchestrates the complex async initialization sequence for AnimatorCanvas.
 * Handles service loading, renderer setup, texture loading, and sub-service wiring.
 */

/**
 * Initialization result
 */
export interface InitializationResult {
  success: boolean;
  error?: string;
  canvas?: HTMLCanvasElement | null;
}

/**
 * Callbacks for initialization state updates
 */
export interface InitializerCallbacks {
  onPixiLoading: (loading: boolean) => void;
  onPixiError: (error: string | null) => void;
  onPixiRendererReady: (renderer: AnimationRenderer) => void;
  onInitialized: (initialized: boolean) => void;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
}

/**
 * Dependencies required for initialization
 */
export interface InitializerDependencies {
  containerElement: HTMLDivElement;
  backgroundAlpha: number;
  /** Live animator canvases opt out so effects can composite behind props.
   *  Export/offscreen paths leave this true to burn the background into pixels. */
  paintBackground?: boolean;
  gridMode: GridMode | null;
  loadAnimatorServices: () => Promise<boolean>;
  initializePrecomputationService: () => void;
  initializePropTextureLoader: () => void;
  initializeResizeService: () => void;
  initializeGlyphTextureLoader: () => void;
  initializeRenderLoopService: () => void;
  loadPropTextures: () => Promise<void>;
  startRenderLoop: () => void;
}

/**
 * Service for orchestrating AnimatorCanvas initialization
 */

// --- From AnimatorLoader ---
/**
 * Animator Loader Interface
 *
 * Handles lazy loading of animator-related services.
 * Provides access to core animation dependencies.
 */

/**
 * Core animator services bundle
 */
export interface AnimatorServices {
  svgGenerator: ISVGGenerator;
  settingsService: SettingsState;
  orchestrator: SequenceAnimationOrchestrator;
  TrailCapturer: TrailCapturer;
  turnsTupleGenerator: TurnsTupleGenerator;
}

/**
 * Result of loading animator services
 */
export type AnimatorServiceLoadResult =
  | { success: true; services: AnimatorServices }
  | { success: false; error: string };

/**
 * Result of loading animation renderer
 */
export type AnimationRendererLoadResult =
  | { success: true; renderer: AnimationRenderer }
  | { success: false; error: string };

/** @deprecated Use AnimationRendererLoadResult instead */
export type PixiLoadResult = AnimationRendererLoadResult;

/**
 * Service for loading animator-related dependencies
 */

// --- From CanvasResizer ---
/**
 * Canvas Resize Service Interface
 *
 * Handles canvas resize logic for AnimatorCanvas.
 * Uses ResizeObserver when available, falls back to window resize.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

/**
 * Default canvas size
 */
export const DEFAULT_CANVAS_SIZE = 500;

/**
 * Renderer interface for resize operations
 */
export interface ResizableRenderer {
  resize: (size: number) => Promise<void>;
}

/**
 * Reactive state owned by the service
 */
export interface CanvasResizeState {
  /** Current canvas size */
  currentSize: number;
  /** Increments on each completed resize (for triggering reactivity) */
  resizeCount: number;
  /** Whether a resize is in progress */
  isResizing: boolean;
}

/**
 * Service for managing canvas resizing
 */

// --- From FireTipTracker ---
/**
 * FireTipTracker
 *
 * Tracks prop endpoint positions across frames and computes
 * velocity vectors via finite differencing for fire direction/intensity.
 */

export interface FireTipTrackerConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  bluePropType?: string;
  redPropType?: string;
  /** Transforms from the Canvas2D renderer. When provided, used instead of recomputing positions. */
  renderedTransforms?: {
    blue: RenderedPropTransform | null;
    red: RenderedPropTransform | null;
  };
}

export interface FireTipUpdateResult {
  tips: PropTipData[];
  /** True when a time gap was detected (HMR, tab switch, frame drop). Caller should clear the fire simulation. */
  gapDetected: boolean;
}

// --- From GlyphTextureLoader ---
/**
 * Glyph Texture Loader Interface
 *
 * Manages glyph texture loading for AnimatorCanvas.
 * Handles queuing glyphs when renderer isn't ready yet.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

/**
 * Pending glyph data
 */
export interface PendingGlyph {
  svgString: string;
  width: number;
  height: number;
}

/**
 * Reactive state owned by the service
 */
export interface GlyphTextureState {
  isLoaded: boolean;
  isLoading: boolean;
  pendingGlyph: PendingGlyph | null;
  loadCount: number; // Increments on each successful load for reactivity
  error: string | null;
}

/**
 * Service for managing glyph texture loading
 */

// --- From GlyphTransitionController ---
/**
 * Glyph Transition Service Interface
 *
 * Manages cross-fade transitions between glyph states (letter, turns, beat number).
 * Handles the timing and state management for smooth visual transitions.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

/**
 * Current transition state - owned by service
 */
export interface GlyphTransitionState {
  // Currently displayed values
  displayedLetter: Letter | null;
  displayedTurnsTuple: string;
  displayedStepNumber: number | null;
  /** Musical position display (e.g., "2, 3" for a beat spanning positions 2-3) */
  displayedMusicalPosition: string | null;

  // Fading out values (during transition)
  fadingOutLetter: Letter | null;
  fadingOutTurnsTuple: string | null;
  fadingOutStepNumber: number | null;

  // Transition flags
  isNewLetter: boolean;
}

/**
 * Service for managing glyph cross-fade transitions
 */

// --- From LedTipTracker ---
/**
 * LedTipTracker
 *
 * Tracks LED point positions across frames and computes
 * velocity vectors via finite differencing for trail direction.
 * Also applies the pattern engine to determine per-LED colors.
 */

export interface LedTipTrackerConfig {
	canvasSize: number;
	bluePropDimensions: PropDimensions;
	redPropDimensions: PropDimensions;
	bluePropType?: string;
	redPropType?: string;
}

// --- From PropPositionCalculator ---
/**
 * PropPositionCalculator
 *
 * Single source of truth for calculating prop endpoint positions.
 * Used by TrailCapturer, AnimationPathCache, and TrailPathGenerator.
 *
 * This is different from EndpointCalculator (which calculates motion angles
 * for pictographs). This calculates pixel positions of prop tips for trail rendering.
 */

/**
 * Configuration for endpoint calculations
 */
export interface PropEndpointConfig {
  /** Canvas size in pixels */
  canvasSize: number;
  /** Prop dimensions in viewbox coordinates */
  propDimensions: { width: number; height: number };
  /** Grid halfway point offset (default: 150) */
  gridHalfwayOffset?: number;
  /** Inward factor for radius (default: 1.0) */
  inwardFactor?: number;
}

/**
 * Result of a single endpoint calculation
 */
export interface PropEndpointResult {
  x: number;
  y: number;
}

/**
 * Result of calculating both endpoints
 */
export interface PropEndpointPair {
  /** Left end (tipIndex 0) */
  left: PropEndpointResult;
  /** Right end (tipIndex 1, tip) */
  right: PropEndpointResult;
}

/**
 * Service for calculating prop endpoint positions for trail rendering
 */

// --- From PropTextureLoader ---

/**
 * Prop dimensions lookup by prop type
 * These are the exact viewBox dimensions from each prop SVG in /images/props/animated/
 * Used to display correct dimensions before async texture loading completes.
 */
export const PROP_DIMENSIONS: Record<string, PropDimensions> = {
  // Staff family
  staff: { width: 270, height: 83.1 },
  simple_staff: { width: 270, height: 83.1 },
  bigstaff: { width: 600, height: 54.5 },
  staff_v2: { width: 300, height: 48.6 },

  // Club family
  club: { width: 300, height: 39.63 },
  bigclub: { width: 300.5, height: 77.2 },

  // Fan family
  fan: { width: 300, height: 239.4 },
  bigfan: { width: 600, height: 567.4 },

  // Triad family
  triad: { width: 300, height: 264.22 },
  bigtriad: { width: 600, height: 523.5 },

  // Hoop family
  minihoop: { width: 300.9, height: 161.1 },
  bighoop: { width: 600, height: 300 },

  // Buugeng family
  buugeng: { width: 300, height: 155.26 },
  bigbuugeng: { width: 600, height: 293.1 },
  fractalgeng: { width: 300, height: 228.36 },

  // Hand - matches animated/hand.svg viewBox (same as static version)
  hand: { width: 75, height: 100 },

  // Triquetra family
  triquetra: { width: 300, height: 175.27 },
  triquetra2: { width: 300, height: 175.32 },

  // Sword
  sword: { width: 578.8, height: 64 },

  // Chicken family
  chicken: { width: 300, height: 28 },
  bigchicken: { width: 300, height: 52.7 },

  // Guitar family
  guitar: { width: 593.4, height: 168 },
  ukulele: { width: 350, height: 71.5 },

  // Doublestar family
  doublestar: { width: 300, height: 150 },
  bigdoublestar: { width: 600, height: 300 },

  // Eightrings family
  eightrings: { width: 300, height: 159.85 },
  bigeightrings: { width: 600, height: 309.5 },

  // Quiad
  quiad: { width: 300, height: 300 },

  // Contact ball family
  contactball: { width: 300, height: 150 },
  bigcontactball: { width: 600, height: 300 },
  doublecontactball: { width: 300, height: 150 },
  bigdoublecontactball: { width: 600, height: 300 },

  // Glass ball family
  glassball: { width: 300, height: 150 },
  doubleglassball: { width: 300, height: 150 },
  bigglassball: { width: 600, height: 300 },
  bigdoubleglassball: { width: 600, height: 300 },

  // PMMA ball family
  pmmaball: { width: 300, height: 150 },
  doublepmmaball: { width: 300, height: 150 },
  bigpmmaball: { width: 600, height: 300 },
  bigdoublepmmaball: { width: 600, height: 300 },

  // Frosted ball family
  frostedball: { width: 300, height: 150 },
  doublefrostedball: { width: 300, height: 150 },
  bigfrostedball: { width: 600, height: 300 },
  bigdoublefrostedball: { width: 600, height: 300 },

  // Torch family
  torch: { width: 300, height: 15.5 },
  bigtorch: { width: 325, height: 32.6 },
};

/**
 * Default prop dimensions (staff dimensions)
 * Fallback when prop type is unknown.
 */
export const DEFAULT_PROP_DIMENSIONS: PropDimensions = {
  width: 300,
  height: 92.33,
};

/**
 * Get prop dimensions for a given prop type
 * Uses the lookup table, falls back to default (staff) if unknown
 */
export function getPropDimensions(propType: string): PropDimensions {
  const normalized = propType.toLowerCase();
  return PROP_DIMENSIONS[normalized] ?? { ...DEFAULT_PROP_DIMENSIONS };
}

/**
 * Reactive state for prop textures
 */
export interface PropTextureState {
  blueDimensions: PropDimensions;
  redDimensions: PropDimensions;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Service for managing prop texture loading
 */

// --- From PropTypeChanger ---
/**
 * Prop Type Change Service Interface
 *
 * Watches for prop type changes from settings and triggers texture reloading.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

/**
 * Reactive state owned by the service
 */
export interface PropTypeChangerState {
  bluePropType: string;
  redPropType: string;
  legacyPropType: string;
  /** Increments when textures should be reloaded */
  textureReloadSignal: number;
}

/**
 * Service for handling prop type changes
 */

// --- From SequenceCache ---
/**
 * Sequence Cache Service Interface
 *
 * Manages cache lifecycle when sequences change or playback stops.
 * Ensures memory is properly released to prevent leaks.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 * Clear operations are signaled via incrementing counters that trigger $effect.
 */

/**
 * Reactive state owned by the service
 */
export interface SequenceCacheState {
  /** Current sequence ID */
  sequenceId: string | null;
  /** Increments when caches should be cleared (triggers component $effect) */
  clearSignal: number;
  /** Increments when pre-rendered frames should be cleared */
  preRenderClearSignal: number;
}

/**
 * Service for managing sequence-related cache lifecycle
 */

// --- From SequenceChainingOrchestrator ---
/**
 * Sequence Chaining Orchestrator Interface
 *
 * Manages continuous sequence playback by chaining sequences together.
 * Supports three source modes: manual pick, library browsing, and
 * infinite generation. Handles preloading, hot-swapping, and step
 * watching for seamless transitions.
 */

export type SourceMode = "pick" | "library" | "infinite";

// --- From TrailSettingsSynchronizer ---
/**
 * Trail Settings Sync Service Interface
 *
 * Manages synchronization of trail settings between external sources,
 * local state, and the trail capture service.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

/**
 * Callback for triggering re-renders
 */
export type RenderTriggerCallback = () => void;

/**
 * Reactive state owned by the service
 */
export interface TrailSettingsSyncState {
  /** Current settings (synced from external source) */
  syncedSettings: TrailSettings | null;
  /** Increments when a render is needed */
  renderSignal: number;
}

/**
 * Service for syncing trail settings
 */


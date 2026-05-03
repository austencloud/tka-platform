import type { TrailPoint, TrailSettings } from "$lib/shared/animation-engine/domain/types/TrailTypes";
import type { PropState, PropStates } from "../../shared/domain/types/PropState";
import type { AnimationPlaybackController } from "../implementations/AnimationPlaybackController";
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { QualityHints } from "$lib/shared/animation-engine/domain/types/QualityTypes";
import type { RenderedPropTransform } from "$lib/shared/animation-engine/domain/types/FireTypes";
import type { Composition } from "../../compose/domain/types";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../create/shared/domain/models/StartPositionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { CapturedFrame } from "$lib/shared/video-export/domain/CapturedFrame";

// --- From ITrailCapturer ---
/**
 * Trail Capture Service Interface
 *
 * Handles real-time trail point capture with:
 * - Distance-based adaptive sampling
 * - Cache backfill during device stutters
 * - Loop detection and clearing
 * - Fade mode with automatic pruning
 * - Multi-prop and multi-endpoint support
 */


/**
 * Prop states for one additional tunnel layer
 */
export interface AdditionalLayerProps {
  blueProp: PropState | null;
  redProp: PropState | null;
}

/**
 * Prop states for trail capture (distinct from the simpler PropStates in domain)
 */
export interface TrailCapturePropStates {
  blueProp: PropState | null;
  redProp: PropState | null;
  /** Additional tunnel layers (index 0 = layer 1, up to 3 additional layers) */
  additionalLayers?: AdditionalLayerProps[];
}

/**
 * Prop dimensions for endpoint calculation
 */
export interface PropDimensions {
  width: number;
  height: number;
}

/**
 * Trail capture configuration
 */
export interface TrailCaptureConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  trailSettings: TrailSettings;
  /** Prop type for blue prop (e.g., "staff", "minihoop") - used for bilateral detection */
  bluePropType?: string | null;
  /** Prop type for red prop (e.g., "staff", "minihoop") - used for bilateral detection */
  redPropType?: string | null;
  /** Whether the sequence returns to its starting position (LOOP pattern) */
  isSeamlesslyLoopable?: boolean;
}

/**
 * Service for capturing trail points during animation
 */

/**
 * Animation cache service interface
 * Implemented by AnimationPathCache for backfilling trail gaps during device stutters
 */
export interface IAnimationCacheService {
  getCachedPoints(
    propIndex: 0 | 1,
    tipIndex: number,
    startStep: number,
    endStep: number,
    canvasSize: number
  ): TrailPoint[];
  isValid(): boolean;
}

/**
 * Performance monitor interface
 * Provides adaptive point spacing based on device performance
 */
export interface IPerformanceMonitorService {
  getAdaptivePointSpacing(): number;
}

// --- From IVideoExportOrchestrator ---
/**
 * Video Export Orchestrator Service Interface
 *
 * Orchestrates the frame-by-frame video export process by coordinating
 * the animation playback controller and video export service.
 */


export type VideoExportFormat = "webm" | "mp4";

export interface VideoExportProgress {
  progress: number;
  stage: "capturing" | "encoding" | "complete" | "error";
  currentFrame?: number;
  totalFrames?: number;
  error?: string;
}

export type VideoResolution = 720 | 1080 | 2160 | 4320;

export interface VideoEffectOverrides {
  fire?: boolean;
  led?: boolean;
  trails?: boolean;
  charcoal?: boolean;
}

export interface VideoExportOrchestratorOptions {
  /** Custom filename for the export (defaults to sequence word) */
  filename?: string;
  /** Frame rate in FPS (default: 60) */
  fps?: number;
  /** Output resolution height in pixels (default: 1080) */
  resolution?: VideoResolution;
  /** Number of times to loop the sequence (default: 1, only used for loopable sequences) */
  loopCount?: number;
  /** Desired output format (mp4 or webm) */
  format?: VideoExportFormat;
  /** Override effect visibility for export (null = use current viewer state) */
  effectOverrides?: VideoEffectOverrides;
  /** Composite mode: renders animation + grid side-by-side with beat highlighting */
  compositeMode?: "none" | "horizontal" | "vertical";
  /** Size of each beat cell in composite grid (default: 120) */
  gridStepSize?: number;
  /** Show beat numbers in composite grid (default: true) */
  showStepNumbers?: boolean;
  /** Include start position in composite grid (default: false) */
  includeStartPosition?: boolean;
  /** Include 1-step start position pause before motion begins (default: true) */
  includeAnimationStartPosition?: boolean;
  /** Include 1-step end hold after last motion step for non-looping sequences (default: true) */
  includeEndHold?: boolean;
  /** Called after export completes (success or failure) to reset transient state like fire caches */
  onCleanup?: () => void;
}

// --- From IVideoPreRenderer ---
/**
 * IVideoPreRenderer
 *
 * Pre-renders animation sequences to video for reliable, smooth playback.
 * Eliminates coordinate transformation issues by capturing exactly what's rendered.
 */


export interface VideoRenderProgress {
  /** Current frame being rendered */
  currentFrame: number;
  /** Total frames to render */
  totalFrames: number;
  /** Progress percentage (0-100) */
  percent: number;
  /** Estimated time remaining in ms */
  estimatedTimeRemaining: number;
  /** Current phase: 'rendering' | 'encoding' | 'complete' */
  phase: "rendering" | "encoding" | "complete";
}

export interface VideoRenderResult {
  /** Whether rendering succeeded */
  success: boolean;
  /** Video blob (if successful) */
  videoBlob?: Blob;
  /** Blob URL for playback (if successful) */
  blobUrl?: string;
  /** Video duration in seconds */
  duration?: number;
  /** Error message (if failed) */
  error?: string;
  /** Sequence ID this video was generated for */
  sequenceId: string;
}

export interface VideoRenderOptions {
  /** Target FPS for the video (default: 60) */
  fps?: number;
  /** Video width in pixels (default: canvas size) */
  width?: number;
  /** Video height in pixels (default: canvas size) */
  height?: number;
  /** Playback speed multiplier (default: 1) */
  speed?: number;
  /** Whether to include trails in the render */
  includeTrails?: boolean;
  /** Video format: 'webm' or 'mp4' (default: 'webm') */
  format?: "webm" | "mp4";
  /** Video quality (0-1, default: 0.9) */
  quality?: number;
}

// --- From IVideoExporter ---
/**
 * Video Exporter Contract
 *
 * Defines interface for hardware-accelerated video export using WebCodecs API.
 * Uses explicit frame timestamps for correct BPM timing.
 * Falls back to WASM encoder for browsers without WebCodecs support.
 */

export type VideoFormat = "webm" | "mp4";

export interface VideoExportOptions {
  /** Video format - mp4 (H.264) is recommended. Default: mp4 */
  format?: VideoFormat;
  /** Target bitrate in bits per second. Default: 5_000_000 (5 Mbps) */
  bitrate?: number;
  /** Frames per second. Default: 50 */
  fps?: number;
  /** Output filename. Default: animation.{format} */
  filename?: string;
  /** Auto-download when complete. Default: true */
  autoDownload?: boolean;
}

export interface VideoExportProgress {
  /** Progress from 0 to 1 */
  progress: number;
  /** Current stage */
  stage: "capturing" | "encoding" | "complete" | "error";
  /** Current frame being captured */
  currentFrame?: number;
  /** Total frames to capture */
  totalFrames?: number;
  /** Error message if stage is 'error' */
  error?: string;
}

// --- From ICompositeVideoRenderer ---
/**
 * Composite Video Renderer Interface
 *
 * Renders composite video frames (animation + grid side-by-side) with synchronized
 * beat highlighting. This is the core service for the "fantastic and essential"
 * composite export feature.
 *
 * Architecture:
 * 1. Pre-cache static grid once for performance (reused across all frames)
 * 2. For each frame: draw animation + cached grid + gold beat highlight
 * 3. Calculate beat grid position from beat index
 * 4. Render synchronized highlighting (matches workspace preview style)
 */


export interface CompositeDimensions {
  width: number;
  height: number;
}

export interface CompositeLayoutOptions {
  orientation: "horizontal" | "vertical";
  gridStepSize: number; // Size of each beat cell in pixels
  includeStartPosition: boolean;
  showStepNumbers: boolean;
}

export interface StepGridPosition {
  col: number; // Column index (0-based)
  row: number; // Row index (0-based)
  x: number; // Pixel X coordinate
  y: number; // Pixel Y coordinate
  width: number; // Beat cell width
  height: number; // Beat cell height
}

// --- From IAnimationRenderer ---
/**
 * Animation Renderer Service Contract
 *
 * Canvas2D-based rendering for the animation module.
 * Replaces PixiJS WebGL rendering with simpler, leak-free Canvas2D.
 */


/**
 * Complete render data for one additional tunnel layer (props + trails + colors)
 */
export interface AdditionalLayerRenderData {
  blueProp: PropState | null;
  redProp: PropState | null;
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  hasBlue: boolean;
  hasRed: boolean;
  blueColor: string;
  redColor: string;
}

/**
 * Visibility settings for animation rendering
 */
export interface AnimationVisibilitySettings {
  gridVisible: boolean;
  propsVisible: boolean;
  trailsVisible: boolean;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

/**
 * Parameters for renderScene()
 */
export interface RenderSceneParams {
  blueProp: PropState | null;
  redProp: PropState | null;
  gridVisible: boolean;
  gridMode: string | null;
  letter: string | null;
  turnsTuple: string | null;
  bluePropDimensions: { width: number; height: number };
  redPropDimensions: { width: number; height: number };
  blueTrailPoints: TrailPoint[];
  redTrailPoints: TrailPoint[];
  /** Additional tunnel layers with props, trails, and colors */
  additionalLayers?: AdditionalLayerRenderData[];
  trailSettings: TrailSettings;
  currentTime: number;
  visibility: AnimationVisibilitySettings;
  // Prop flip settings (for asymmetric props like Buugeng)
  bluePropFlipped?: boolean;
  redPropFlipped?: boolean;
  // Prop types - used to apply prop-specific rendering rules (e.g., hands never rotate)
  bluePropType?: string;
  redPropType?: string;
  // Quality hints for adaptive rendering (optional - full quality when absent)
  qualityHints?: QualityHints;
  /** When true, trails are rendered by the overlay canvas, not the main renderer */
  skipTrailRendering?: boolean;
}


// --- From ITunnelModeSequenceManager ---
/**
 * Tunnel Mode Sequence Manager Interface
 *
 * Coordinates sequence loading and transformations for Tunnel Mode.
 * Handles both primary and secondary sequences with consistent logic.
 */


export type SequenceType = "primary" | "secondary";
export type TransformOperation = "mirror" | "rotate" | "colorSwap" | "rewind";

// --- From ICompositionRepository ---
/**
 * ICompositionRepository - Composition Persistence Operations
 *
 * Repository interface for managing compositions in local storage (Dexie).
 * Compositions are flexible canvas arrangements containing sequences,
 * videos, images, and text in configurable grid layouts.
 */


/**
 * Options for querying compositions
 */
export interface CompositionQueryOptions {
  /** Filter by favorite status */
  isFavorite?: boolean;
  /** Search query (name) */
  searchQuery?: string;
  /** Sort field */
  sortBy?: "name" | "createdAt" | "updatedAt";
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Maximum results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Statistics about saved compositions
 */
export interface CompositionStats {
  /** Total compositions saved */
  totalCompositions: number;
  /** Favorite compositions */
  favoriteCompositions: number;
  /** Total cells across all compositions */
  totalCells: number;
}

/**
 * ICompositionRepository - Core composition persistence operations
 */

// --- From IVideoGenerationCoordinator ---

/**
 * Video generation options
 */
export interface VideoGenerationOptions {
  fps?: number;
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * IVideoGenerationCoordinator
 *
 * Orchestrates video generation workflow including:
 * - Cache checking
 * - Progress tracking
 * - Error handling
 * - Generation lifecycle management
 */

// --- From IStepCalculator ---
/**
 * Beat Calculation Service Interface
 *
 * Interface for beat calculation and timing services.
 * Handles beat state calculations and validation.
 */



export interface StepCalculationResult {
  currentStepIndex: number;
  stepProgress: number;
  currentStepData: StepData;
  isValid: boolean;
}

// --- From ISequenceNormalizer ---
/**
 * Sequence Normalizer Interface
 *
 * Handles normalization of sequence data for consistent consumption by UI components.
 * Specifically handles the separation of beat 0 (start position) from the steps array.
 */


export interface NormalizedSequenceData {
  /**
   * Steps array with stepNumber >= 1 (excludes start position)
   */
  steps: readonly StepData[];

  /**
   * Start position (always StartPositionData, never StepData)
   */
  startPosition: StartPositionData | null;
}

// --- From ISVGGenerator ---
/**
 * SVG Generator Service Contract
 *
 * Handles generation of SVG strings for grid and prop staffs.
 */


export interface PropSvgData {
  svg: string;
  width: number;
  height: number;
}

// --- From IExportGlyphPrerenderer ---
/**
 * Export Glyph Prerenderer Contract
 *
 * Pre-renders complete TKA glyphs (letter + dash + turns column) as images
 * before the export frame loop starts. This ensures the exported video
 * matches the live canvas exactly, including turn numbers and dash indicators.
 */


export interface GlyphAsset {
  image: HTMLImageElement;
  dimensions: { width: number; height: number };
  /** Pixels the image extends above the standard glyph origin (50, 800).
   *  When turns are present, the top turn number sits above the letter. */
  yOffset: number;
}

// --- From IBackgroundVideoEncoder ---
/**
 * Background Video Encoder Contract
 *
 * Coordinates with a Web Worker to perform WebCodecs encoding off the main
 * thread. The main thread captures frames and posts them to the worker,
 * which handles encoding and MP4 muxing without blocking the UI.
 */


export interface BackgroundExportConfig {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  totalFrames: number;
}

// --- From IAnimationStateManager ---
/**
 * Animation State Service Interface
 *
 * Interface for managing animation state.
 * Handles prop state updates and management.
 */



export interface InterpolationResult {
  blueAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number; // Optional Cartesian x coordinate (for dash motions)
    y?: number; // Optional Cartesian y coordinate (for dash motions)
  } | null; // null = hand not present in sequence
  redAngles: {
    centerPathAngle: number;
    staffRotationAngle: number;
    x?: number; // Optional Cartesian x coordinate (for dash motions)
    y?: number; // Optional Cartesian y coordinate (for dash motions)
  } | null; // null = hand not present in sequence
  isValid: boolean;
}

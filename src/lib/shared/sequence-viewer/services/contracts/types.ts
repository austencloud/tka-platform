import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { VideoExportProgress } from '$lib/features/compose/services/contracts/types';
import type { AnimationPlaybackController } from '$lib/features/compose/services/implementations/AnimationPlaybackController';
import type { AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { EffortTimeline } from "$lib/features/phrase-effort-lab/domain/effort-timeline-types";
import type { PublicSequenceIndex } from "$lib/features/library/domain/models/PublicSequenceIndex";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { BrowseViewMode } from "$lib/features/browse/shared/domain/BrowseViewMode";

// --- From ISequenceModalExporter ---

export interface VideoExportEffectOverrides {
  fire?: boolean;
  led?: boolean;
  trails?: boolean;
  charcoal?: boolean;
}

export interface VideoExportOptions {
  fps: number;
  loopCount: number;
  resolution: 720 | 1080 | 2160 | 4320;
  effectOverrides?: VideoExportEffectOverrides;
  includeStartPosition?: boolean;
  includeEndHold?: boolean;
  /**
   * "standard" (default): one render per output frame, native resolution.
   * "cinema": 2× supersampling + 4× temporal motion blur. Roughly 4-8×
   * slower but produces a visibly smoother, sharper result. 3D exports only.
   */
  quality?: "standard" | "cinema";
}

export interface ImageExportOptions {
  includeStartPosition: boolean;
  showStepNumbers: boolean;
  showWord: boolean;
  showDifficulty: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showQRCode: boolean;
  darkMode: boolean;
  columnCount: number | null;
}

/**
 * Export state for UI binding
 */
export interface ExportState {
  isExporting: boolean;
  progress: VideoExportProgress | null;
  error: string | null;
  /** Object URL of the exported video blob, available after successful video export */
  previewBlobUrl: string | null;
}

/**
 * Callbacks for export lifecycle events
 */
export interface ExportCallbacks {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onHaptic: (type: "success" | "error" | "selection") => void;
}

/**
 * Dependencies required for video exports
 */
export interface VideoExportDependencies {
  canvas: HTMLCanvasElement;
  playbackController: AnimationPlaybackController;
  panelState: AnimationPanelState;
}

/**
 * Dependencies required for image exports
 */
export interface ImageExportDependencies {
  sequence: SequenceData;
  userName: string;
}

/**
 * Dependencies required for 3D video exports (offline two-pass pipeline).
 * The caller gathers these from the live 3D scene; SequenceModalExporter
 * forwards them into Offline3DExportDependencies.
 */
export interface Video3DExportDependencies {
  webglCanvas: HTMLCanvasElement;
  /** Three.js PerspectiveCamera (from useThrelte().camera) */
  camera: {
    position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
    quaternion: { x: number; y: number; z: number; w: number; set(x: number, y: number, z: number, w: number): void };
    fov: number;
    updateProjectionMatrix(): void;
  };
  /** Beats per second for converting animation time to currentStep */
  beatsPerSecond: number;
  /** Total animation duration in seconds (single loop, no start/end hold) */
  totalDurationSeconds: number;
  /** Camera keyframe buffer from pass 1 (or static capture) */
  cameraKeyframes: import("$lib/shared/video-export/domain/CameraKeyframe").CameraKeyframeBuffer;
  /** Three.js WebGLRenderer - needed for cinema-mode supersampling resize */
  renderer: {
    getSize(target: { x: number; y: number; set(w: number, h: number): unknown }): unknown;
    setSize(w: number, h: number, updateStyle?: boolean): void;
    getPixelRatio(): number;
    setPixelRatio(ratio: number): void;
  };
  /** Run the full Threlte pipeline synchronously for one frame */
  runFrame(timeMs: number): void;
  /** Pause Threlte's native rAF loop for the duration of the export */
  pauseAutoLoop(): void;
  /** Resume Threlte's native rAF loop after export completes */
  resumeAutoLoop(): void;
  /** Signal export mode to the puppet loop */
  setExporting(value: boolean): void;
  /** Set the animation step for the puppet loop to distribute each frame */
  setExportCurrentStep(step: number | null): void;
}

/**
 * Orchestrates sequence exports (image, video).
 * Combined exports (animation + choreo card) are handled by Compose module.
 */

// --- From IPendingActionQueue ---
export type PendingActionType = 'save' | 'favorite' | 'publish' | 'remix' | 'sendTo';

export interface PendingAction {
  type: PendingActionType;
  sequenceId: string;
  ts: number;
}


export const PENDING_URL_PARAM = 'pending';
export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

// --- From ITempoPracticeOrchestrator ---
/**
 * Tempo Practice Orchestrator Interface
 *
 * Manages progressive tempo training: tracks loop completions,
 * bumps BPM when enough rounds at the current level are completed.
 *
 * Pure state machine - does NOT control playback directly.
 * Fires callbacks to let the consumer handle BPM changes and playback.
 */

export interface TempoPracticeConfig {
  /** Starting BPM (default: 15) */
  startBpm: number;
  /** BPM increase per level (default: 5) */
  increment: number;
  /** Number of full sequence loops per level before bumping BPM (default: 5) */
  roundsPerLevel: number;
  /** Optional maximum BPM cap (default: 300) */
  maxBpm: number;
}

export interface TempoPracticeProgress {
  /** Whether practice is currently running */
  active: boolean;
  /** Current BPM */
  currentBpm: number;
  /** Which round within the current level (1-based) */
  currentRound: number;
  /** How many rounds per level */
  roundsPerLevel: number;
  /** How many levels completed */
  currentLevel: number;
  /** Total rounds completed across all levels */
  totalRoundsCompleted: number;
}

// --- From ISequenceAnimationLoader ---

export interface AnimationLoadResult {
  success: boolean;
  sequenceData?: SequenceData;
  error?: string;
}

export interface AnimationLoadOptions {
  /** Initial BPM to restore */
  initialBpm?: number;
  /** Initial playback time in ms to restore */
  initialPlaybackTimeMs?: number;
  /** Whether to auto-start playback */
  autoStart?: boolean;
  /** Delay before auto-start in ms */
  autoStartDelay?: number;
}

/**
 * Handles loading and initializing sequence animation data.
 */

// --- From IPresentationResolver ---

export type ViewingContext = "notation" | "creator-expression";

export interface ResolvedPresentation {
  readonly bluePropType: PropType;
  readonly redPropType: PropType;
  readonly catDogMode: boolean;
  readonly effortTimeline: EffortTimeline | null;
  readonly source: "creator-intent" | "viewer-settings";
}

// --- From IModalSwipeDismiss ---
/**
 * Modal swipe-to-dismiss gesture handler.
 *
 * Supports:
 * - Swipe from anywhere on the modal
 * - Distinguishes vertical swipe from horizontal scroll
 * - Applies visual feedback (transform + opacity)
 * - Blocks clicks after swipe to prevent accidental interactions
 */

export interface ModalSwipeDismissConfig {
  /** Pixel threshold to trigger dismiss (default: 100) */
  threshold?: number;
  /** Minimum vertical movement to commit to swipe gesture (default: 10) */
  commitThreshold?: number;
  /** Vertical must be > horizontal * this to swipe (default: 2) */
  horizontalTolerance?: number;
  /** Duration to block clicks after swipe gesture (default: 100ms) */
  clickBlockDuration?: number;
}

export interface ModalSwipeDismissState {
  /** Current vertical offset in pixels */
  readonly swipeY: number;
  /** Whether actively swiping */
  readonly isSwiping: boolean;
  /** Whether gesture has committed to swipe (past commit threshold) */
  readonly isCommitted: boolean;
  /** Whether clicks should be blocked (after a swipe gesture) */
  readonly blockClicks: boolean;
}

// --- From ISequenceModalPersistence ---
/**
 * Persists sequence modal user preferences to localStorage.
 *
 * Note: Image visibility settings are now managed by ImageCompositionManager
 * for Firebase sync. This service only handles modal-specific settings.
 */

export type ViewMode = "animation" | "image" | "split";

// --- From IPublicSequenceHashMatcher ---
/**
 * IPublicSequenceHashMatcher - Matches decoded URL sequences against the public library
 *
 * Computes a SHA-256 fingerprint from the SequenceEncoder's pipe-delimited output
 * and queries publicSequences by encoderHash. Used for progressive enrichment:
 * if a shared URL matches a published sequence, the viewer gains attribution
 * and the "Creator's choice" prop toggle.
 */


export interface SequenceMatchResult {
	readonly matched: boolean;
	readonly publicRecord: PublicSequenceIndex | null;
}

// --- From IPreviewCellRenderer ---
/**
 * IPreviewCellRenderer
 *
 * Renders individual pictograph cells with caching for sequence previews.
 * Handles cache key derivation, layer composition, and IndexedDB persistence.
 */


/**
 * Options for rendering a preview cell.
 * All visibility and prop settings that affect the rendered output.
 */
export interface PreviewCellRenderOptions {
  /** Render size in pixels (e.g., 480 for high-res) - this is the height; width = size * widthMultiplier */
  size: number;

  /** Width multiplier for duration-expanded cells (1 = square, 2 = double-wide). Default: 1 */
  widthMultiplier?: number;

  /** Blue hand prop type override */
  bluePropType?: PropType;

  /** Red hand prop type override (used when catDogModeEnabled) */
  redPropType?: PropType;

  /** When true, red hand uses redPropType; otherwise uses bluePropType */
  catDogModeEnabled?: boolean;

  /** Whether to render step numbers on the pictograph */
  showStepNumbers?: boolean;

  // Visibility settings (from user preferences)

  /** Show non-radial (corner) grid points */
  showNonRadialPoints?: boolean;

  /** Hand point visibility mode */
  handPointVisibility?: "all" | "active";

  /** Show TKA letter glyph */
  showTKA?: boolean;

  /** Show reversal indicators */
  showReversals?: boolean;

  /** Show VTG glyph (bottom-right category badge) */
  showVTG?: boolean;

  /** Show elemental glyph (paired with VTG, same corner) */
  showElemental?: boolean;

  /** Show start/end position letters (alpha/beta/gamma labels) */
  showPositions?: boolean;

  /** When true, renders hand path visualization: HAND props, float arrows for shifts,
   *  no TKA overlay, no reversals. Shows pure spatial trajectory. */
  handPathMode?: boolean;

  /** Browse view mode (props/hands x combined/solo x blue/red).
   *  Affects cache keys so the same sequence renders differently per mode. */
  browseViewMode?: BrowseViewMode;

  /** Show blue motion (prop + arrow). When false, renderer skips blue entirely. Default: true. */
  showBlueMotion?: boolean;

  /** Show red motion (prop + arrow). When false, renderer skips red entirely. Default: true. */
  showRedMotion?: boolean;
}

// --- From ICellPreWarmer ---
/**
 * ICellPreWarmer
 *
 * Pre-warms the PictographBlobCache (IndexedDB) with rendered pictograph cells
 * for sequences the user is about to open. When the preview mounts,
 * PreviewCellRenderer.renderCell() finds everything already cached - instant display.
 *
 * Three priority tiers mapped to the Prioritized Task Scheduling API:
 * - "background" → scheduler.postTask({ priority: "background" })
 *   Used for sequences visible in the gallery. Non-blocking, yields between cells.
 * - "user-visible" → scheduler.postTask({ priority: "user-visible" })
 *   Used on hover. Renders all uncached cells with normal priority.
 * - "user-blocking" → scheduler.postTask({ priority: "user-blocking" })
 *   Used on click. Renders immediately before any other queued work.
 *
 * Falls back to requestIdleCallback / setTimeout for browsers without scheduler support.
 */


export type PreWarmPriority = "background" | "user-visible" | "user-blocking";

// --- From IAutoHideController ---
/**
 * Controls auto-hiding behavior for UI elements (fullscreen controls, footer).
 */

export interface AutoHideControllerOptions {
  /** Delay in ms before auto-hiding (default: 3000) */
  hideDelay?: number;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Condition that must be true for auto-hide to activate */
  shouldAutoHide?: () => boolean;
}

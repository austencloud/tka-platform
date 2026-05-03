/**
 * Co-exported types from retired interface contracts.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { StepData } from "../../../../../create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../../create/shared/domain/models/StartPositionData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

// === From IClaudeCodeCopier ===

export interface CopyResult {
  success: boolean;
  error?: Error;
}

// === From ICloudThumbnailCache ===

export type ThumbnailVariant = "gallery" | "wordcard";
export interface DeleteProgress {
  deleted: number;
  total: number;
  currentFile?: string;
}
export interface CloudThumbnailKey {
  sequenceName: string;
  /** Unique sequence ID - distinguishes variations with the same word */
  sequenceId?: string;
  propType: PropType;
  lightMode: boolean;
  /** Cache variant - defaults to 'gallery' for backwards compatibility */
  variant?: ThumbnailVariant;
}
export interface CloudThumbnailResult {
  url: string;
  blob: Blob;
  fromCache: boolean;
}

// === From IBrowseMetadataExtractor ===

export interface SequenceMetadata {
  steps: StepData[];
  author: string;
  difficultyLevel: string;
  dateAdded: Date;
  gridMode: GridMode;
  isCircular: boolean;
  propType: PropType;
  sequenceLength: number;
  startingPosition: string; // Just the letter/position name (e.g., "gamma")
  startPosition?: StartPositionData; // Full start position data with motions
}

// === From IPinchZoomGridController ===

export interface PinchZoomState {
	/** Current column count. Mobile: 2-3, Desktop: 2-5 */
	columns: number;
	/** Whether gesture is active */
	isGesturing: boolean;
	/** True for ~200ms after column change (for CSS transition timing) */
	isTransitioning: boolean;
}

// === From ISequenceDifficultyCalculator ===

export type DifficultyTrigger = "none" | "turns" | "nonRadial";
export interface DifficultyAnalysis {
  readonly level: 1 | 2 | 3;
  readonly trigger: DifficultyTrigger;
}

// === From ISequenceDetailLoader ===

export interface SequenceLoadResult {
  sequence: SequenceData | null;
  isLoading: boolean;
  error: Error | null;
}

// === From IThumbnailKeyDeriver ===

export interface ThumbnailVisibilitySettings {
  showTKA?: boolean;
  showReversals?: boolean;
  showGrid?: boolean;
  showNonRadialPoints?: boolean;
  handPointVisibility?: "all" | "active";
  /** Render QR code in an empty cell (if available) */
  showQRCode?: boolean;
  /** Render as hand path visualization (HAND props, float arrows, no TKA) */
  handPathMode?: boolean;
}
export interface ThumbnailRenderInput {
  // Identity
  sequenceName: string;
  /** Unique sequence ID - distinguishes variations with the same word */
  sequenceId?: string;

  // Prop configuration
  bluePropType: PropType | undefined;
  redPropType: PropType | undefined;
  catDogModeEnabled: boolean;

  // Visual mode
  lightMode: boolean;
  variant: ThumbnailVariant;

  // LOOP badge
  loopType?: string | null;

  // Composition overrides (undefined = use variant defaults)
  addWord?: boolean;
  addStepNumbers?: boolean;
  includeStartPosition?: boolean;
  startPositionLayout?: "row" | "column";
  addDifficultyLevel?: boolean;
  addUserInfo?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  customNotesText?: string;
  userName?: string;

  // Visibility overrides (undefined = use defaults: showTKA=true, showReversals=true, etc.)
  visibility?: ThumbnailVisibilitySettings;

  /** Use 5:7 playing card layout for physical card export (different from lightMode/printMode) */
  cardMode?: boolean;
}
export interface ThumbnailCacheKey {
  /** Hash of all inputs that affect visual output */
  readonly hash: string;

  /** Cloud storage path (for ICloudThumbnailCache) */
  readonly cloudPath: string;

  /** Original inputs (for debugging/logging) */
  readonly inputs: Readonly<ThumbnailRenderInput>;

  /** Whether this uses default composition settings (cacheable to cloud) */
  readonly usesDefaults: boolean;

  /** Effective prop type string (for cloud cache key construction) */
  readonly propKey: string;
}
export interface CompositionDefaults {
  addWord: boolean;
  addStepNumbers: boolean;
  includeStartPosition: boolean;
  addDifficultyLevel: boolean;
  addUserInfo: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
}

// === From IThumbnailLocalCache ===

export interface ThumbnailLocalCacheStats {
  count: number;
  sizeBytes: number;
}

// === From IThumbnailMetricsCollector ===

export type CacheLayer = "memory" | "static" | "local" | "cloud" | "render";
export interface ThumbnailRequestMetrics {
  /** Unique request ID for correlation */
  requestId: string;

  /** Which cache layer served this request */
  layer: CacheLayer | "failed";

  /** Time from request start to URL available (ms) */
  timeToUrl: number;

  /** Was the thumbnail visible when request started? */
  wasVisibleAtStart: boolean;

  /** Did the user scroll away before completion? */
  wasCancelled: boolean;

  /** For renders: time spent in queue before render started */
  queueWaitTime?: number;

  /** For renders: actual render duration */
  renderTime?: number;

  /** For cloud: upload succeeded? */
  uploadSucceeded?: boolean;
}
export interface TimingDistribution {
  /** Number of samples */
  count: number;
  /** Mean (average) in ms */
  mean: number;
  /** Standard deviation in ms */
  stdDev: number;
  /** Minimum value in ms */
  min: number;
  /** Maximum value in ms */
  max: number;
  /** 50th percentile (median) in ms */
  p50: number;
  /** 95th percentile in ms - 95% of requests faster than this */
  p95: number;
  /** 99th percentile in ms - 99% of requests faster than this */
  p99: number;
}
export interface ThumbnailMetricsSummary {
  /** Total requests tracked */
  totalRequests: number;

  /** Requests by layer */
  byLayer: Record<CacheLayer | "failed", number>;

  /** Average time to URL by layer (ms) */
  avgTimeByLayer: Record<CacheLayer | "failed", number>;

  /** Hit rate per layer (as percentage of total) */
  hitRateByLayer: Record<CacheLayer | "failed", number>;

  /** Percentage of requests cancelled before completion */
  cancelRate: number;

  /** Percentage of render attempts that failed */
  renderFailureRate: number;

  /** Percentage of cloud uploads that succeeded */
  uploadSuccessRate: number;

  /** Highest queue depth observed */
  queueHighWaterMark: number;

  /** Average queue wait time for rendered items (ms) */
  avgQueueWaitTime: number;

  /** Average render time (ms) */
  avgRenderTime: number;

  /** Session duration (ms) */
  sessionDuration: number;

  /** Full timing distribution across all requests */
  timeDistribution: TimingDistribution;

  /** Timing distribution by layer (only layers with data) */
  timeDistributionByLayer: Partial<Record<CacheLayer | "failed", TimingDistribution>>;
}

// === From IThumbnailRenderer ===

export interface RenderOptions {
  /** Beat size in pixels (default: 240) */
  stepSize?: number;

  /** Output format (default: WebP) */
  format?: "WebP" | "PNG" | "JPEG";

  /** Quality for lossy formats 0-1 (default: 0.9) */
  quality?: number;
}
export type RenderProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;

// === From IThumbnailRenderOrchestrator ===

export interface RenderProgress {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}
export type ThumbnailLoadStatus =
  | { state: "idle" }
  | { state: "checking-cache" }
  | { state: "queued"; position: number }
  | { state: "rendering"; progress?: RenderProgress }
  | { state: "uploading" }
  | { state: "complete"; url: string }
  | { state: "error"; error: Error };
export interface ThumbnailRequest {
  /** The sequence to render */
  sequence: SequenceData;

  /** Render configuration */
  input: ThumbnailRenderInput;

  /** Optional callback for status updates */
  onStatusChange?: (status: ThumbnailLoadStatus) => void;

  /** Skip cloud cache check and render directly (use after 404 errors) */
  skipCache?: boolean;

  /** Priority for queue ordering (lower = higher priority). Use element's Y position. */
  priority?: number;
}
export interface ThumbnailResult {
  /** URL to display (either cloud URL or blob URL), null if render failed */
  url: string | null;

  /** Whether this came from cache (true) or was freshly rendered (false) */
  fromCache: boolean;

  /** The cache key used (for cancellation) */
  key: ThumbnailCacheKey;

  /** Error if rendering failed (only present when url is null) */
  error?: Error;
}

// === From IThumbnailRenderQueue ===

export interface QueueStats {
  /** Number of tasks waiting in queue */
  queued: number;

  /** Number of tasks currently executing */
  active: number;

  /** IDs of currently executing tasks */
  activeIds: string[];
}

// === From IVariationGrouper ===

export interface VariationGroup {
  word: string;
  sequences: SequenceData[];
  count: number;
}

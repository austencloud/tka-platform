

/**
 * Shared training data store interface.
 *
 * A unified IndexedDB-backed store where Video Trails corrections,
 * ML Training labels, and Skel2TKA hand landmarks all live in a common
 * format. This lets training data, frame analysis, and corrections flow
 * between modules without each maintaining its own persistence layer.
 */

export type TrainingDataSource = "video-trails" | "ml-training" | "skel2tka";

export interface DetectedEndpoint {
	x: number;
	y: number;
	confidence: number;
	propIndex: number;
	tipIndex: number;
	detectorId: string;
}

export interface EndpointCorrection {
	propIndex: number;
	tipIndex: number;
	correctedX: number;
	correctedY: number;
	status: string;
}

export interface BoundingBoxAnnotation {
	x: number;
	y: number;
	width: number;
	height: number;
	label: string;
	headDirection?: string;
}

export interface HandLandmarkSet {
	hand: "left" | "right";
	landmarks: Array<{ x: number; y: number; z: number }>;
}

export interface TrainingDataEntry {
	id: string;
	source: TrainingDataSource;
	createdAt: string;
	frameIndex: number;
	videoUrl?: string;
	videoFileName?: string;

	/** Base64 data URL of the frame image (optional - expensive to store). */
	frameDataUrl?: string;
	frameWidth: number;
	frameHeight: number;

	/** Detection results from any detector (LED threshold, color endpoint, etc.). */
	detectedEndpoints?: DetectedEndpoint[];

	/** Manual corrections from the Video Trails Detection Studio. */
	corrections?: EndpointCorrection[];

	/** Bounding box annotations from ML Training. */
	boundingBoxes?: BoundingBoxAnnotation[];

	/** Hand landmarks from Skel2TKA MediaPipe pipeline. */
	handLandmarks?: HandLandmarkSet[];

	tags?: string[];
	notes?: string;
}

/**
 * IVideoCache
 *
 * Service for caching video blobs in IndexedDB for instant playback.
 * Used by video browsers, curators, and any component displaying videos.
 */

export interface GetVideoOptions {
  /** If true, cache in background if not already cached */
  cacheIfMissing?: boolean;
  /** Priority for caching (higher = sooner) */
  priority?: number;
}

export interface CacheStats {
  /** Number of cached videos */
  count: number;
  /** Total size in bytes */
  totalSize: number;
  /** Oldest entry date */
  oldestEntry: Date | null;
}

export interface CachedVideo {
  url: string;
  blob: Blob;
  size: number;
  cachedAt: Date;
  lastAccessed: Date;
}

/**
 * Shared frame extractor interface.
 *
 * Extracts frames from a video element at specified intervals using an
 * async generator pattern. This keeps memory usage low because only one
 * frame's ImageData is alive at a time - the consumer processes and
 * discards each frame before the next one is extracted.
 *
 * Used by Skel2TKA's VideoFrameExtractor and ML Training's DataCapturer.
 */

export interface ExtractedFrame {
	index: number;
	timestamp: number;
	imageData: ImageData;
	width: number;
	height: number;
}

export interface FrameExtractionConfig {
	startFrame: number;
	endFrame: number;
	/** Extract every Nth frame. 1 = every frame, 2 = every other frame, etc. */
	stepSize: number;
	fps: number;
}

/**
 * Shared video source provider interface.
 *
 * Manages a single <video> element and offscreen canvas so that multiple
 * modules (Video Trails, Skel2TKA, ML Training) can load videos, seek to
 * specific frames, and extract pixel data without each creating their own
 * video infrastructure.
 */

export interface VideoSourceInfo {
	url: string;
	duration: number;
	width: number;
	height: number;
	fps: number;
	frameCount: number;
	originalFileName?: string;
}

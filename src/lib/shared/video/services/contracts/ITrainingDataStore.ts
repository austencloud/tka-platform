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

export interface ITrainingDataStore {
	save(entry: TrainingDataEntry): Promise<void>;
	saveBatch(entries: TrainingDataEntry[]): Promise<void>;
	getBySource(source: TrainingDataSource): Promise<TrainingDataEntry[]>;
	getByFrame(frameIndex: number, videoUrl?: string): Promise<TrainingDataEntry[]>;
	getAll(): Promise<TrainingDataEntry[]>;
	count(source?: TrainingDataSource): Promise<number>;
	delete(id: string): Promise<void>;
	clear(source?: TrainingDataSource): Promise<void>;
	exportAsJson(): Promise<string>;
}

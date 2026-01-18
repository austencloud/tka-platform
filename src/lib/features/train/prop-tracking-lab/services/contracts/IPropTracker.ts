/**
 * IPropTracker - Interface for prop tracking across video frames
 *
 * The tracker takes an initial bounding box (user-drawn) and tracks
 * the prop across subsequent frames, detecting the tip/endpoint
 * and computing rotation.
 */

import type {
	BoundingBox,
	TrackedFrame,
	TrackingConfig,
	NormalizedPoint
} from '../../domain/models';

export interface IPropTracker {
	/**
	 * Initialize tracking with the first frame and user-drawn bounding box.
	 * @param imageData - First frame as ImageData
	 * @param initialBox - User-drawn bounding box (normalized 0-1)
	 * @param config - Tracking configuration
	 */
	initialize(
		imageData: ImageData,
		initialBox: BoundingBox,
		config?: Partial<TrackingConfig>
	): Promise<TrackedFrame>;

	/**
	 * Track the prop in the next frame.
	 * @param imageData - Current frame as ImageData
	 * @param frameIndex - Frame index
	 * @param timestamp - Frame timestamp in ms
	 * @returns Tracked frame data
	 */
	trackFrame(imageData: ImageData, frameIndex: number, timestamp: number): Promise<TrackedFrame>;

	/**
	 * Reset the tracker state.
	 */
	reset(): void;

	/**
	 * Get the current tracking configuration.
	 */
	getConfig(): TrackingConfig;

	/**
	 * Update tracking configuration.
	 */
	updateConfig(config: Partial<TrackingConfig>): void;
}

/**
 * Dependency injection symbol for IPropTracker.
 */
export const IPropTrackerSymbol = Symbol.for('IPropTracker');

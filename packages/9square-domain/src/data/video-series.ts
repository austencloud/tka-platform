/**
 * Charlie Cushing's 9-Square Theory Video Series
 *
 * 10-part series covering 9-Square Theory and QFT Notation.
 * ~1.5 hours total runtime.
 */

import type { ExternalReference } from "@flow-arts/core";

/** A single episode in the video series */
export interface VideoEpisode extends ExternalReference {
	/** Episode number (1-10) */
	episodeNumber: number;
	/** Topics covered in this episode */
	topics: string[];
	/** Approximate runtime in minutes */
	runtimeMinutes?: number;
}

// TODO: Populate with episode metadata from Charlie Cushing's "charlicopter" YouTube channel
export const NINE_SQUARE_VIDEO_SERIES: VideoEpisode[] = [];

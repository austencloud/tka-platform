/**
 * Feed Domain Models
 *
 * Unified content wrapper for the Watch feed.
 * Normalizes videos, animations, and pictographs into a single FeedItem type.
 */

export type FeedContentType = "video" | "animation" | "pictograph";
export type FeedItemIntent = "tutorial" | "demo" | "sequence" | "composition";
export type FeedSourceType = "video" | "sequence";

/**
 * Unified feed item representing any content type in the feed.
 * Created by transforming CollaborativeVideo or SequenceData.
 */
export interface FeedItem {
	// Identity
	readonly id: string;
	readonly contentType: FeedContentType;
	readonly intent: FeedItemIntent;

	// Media URLs (at least thumbnailUrl required)
	readonly videoUrl?: string;
	readonly animationUrl?: string;
	readonly thumbnailUrl: string;
	readonly duration?: number; // seconds, for video content

	// Display info
	readonly title: string;
	readonly description?: string;

	// Creator info
	readonly creatorId: string;
	readonly creatorName: string;
	readonly creatorAvatarUrl?: string;

	// Timestamp
	readonly createdAt: Date;

	// Source reference (for navigation)
	readonly sourceType: FeedSourceType;
	readonly sourceId: string;

	// Sequence-specific (when applicable)
	readonly sequenceId?: string;
	readonly word?: string;
	readonly stepCount?: number;
	readonly tags?: readonly string[];
}

/**
 * Result of loading a page of feed items.
 */
export interface FeedPage {
	readonly items: readonly FeedItem[];
	readonly nextCursor: string | null;
	readonly hasMore: boolean;
}

/**
 * Query parameters for loading feed pages.
 */
export interface FeedQuery {
	readonly cursor?: string;
	readonly limit?: number;
	readonly contentTypeFilter?: FeedContentType;
}

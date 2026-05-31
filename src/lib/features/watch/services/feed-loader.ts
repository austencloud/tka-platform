/**
 * Feed Loader Implementation
 *
 * Merges videos and sequences into a unified feed.
 * Sorts by date, ensures content variety, and handles pagination.
 */

import type {
	FeedItem,
	FeedPage,
	FeedQuery,
	FeedContentType,
	FeedItemIntent,
} from "../domain/models/feed-models";
import { loadPublicVideos } from "./public-video-loader";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import type { CollaborativeVideo } from "$lib/shared/video-collaboration/domain/collaborative-video";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

const DEFAULT_LIMIT = 15;
const LOAD_BATCH_SIZE = 30;

export class FeedLoader {
	constructor(
		private sequenceLoader: PublicSequencesLoader
	) {}

	async loadFeedPage(query: FeedQuery): Promise<FeedPage> {
		const limit = query.limit ?? DEFAULT_LIMIT;
		const filter = query.contentTypeFilter;

		// Load both sources in parallel
		const [videosResult, sequences] = await Promise.all([
			this.loadVideos(filter),
			this.loadSequences(filter),
		]);

		// Transform to FeedItems
		const videoItems = videosResult.map((v) => this.videoToFeedItem(v));
		const sequenceItems = sequences.map((s) => this.sequenceToFeedItem(s));

		// Merge and sort by date (newest first)
		let allItems = [...videoItems, ...sequenceItems].sort(
			(a, b) => b.createdAt.getTime() - a.createdAt.getTime()
		);

		// Apply content type filter
		if (filter !== undefined && filter !== "all") {
			allItems = allItems.filter((item) => item.contentType === filter);
		}

		// Ensure content variety in first batch (interleave if needed)
		if (!query.cursor) {
			allItems = this.ensureVariety(allItems);
		}

		// Paginate using cursor as index offset
		const startIndex = query.cursor ? parseInt(query.cursor, 10) : 0;
		const pageItems = allItems.slice(startIndex, startIndex + limit);
		const nextCursor =
			startIndex + limit < allItems.length ? String(startIndex + limit) : null;

		return {
			items: pageItems,
			nextCursor,
			hasMore: nextCursor !== null,
		};
	}

	private async loadVideos(
		filter?: FeedContentType
	): Promise<CollaborativeVideo[]> {
		// Skip if filter excludes videos
		if (filter !== undefined && filter !== "all" && filter !== "video") {
			return [];
		}

		try {
			const result = await loadPublicVideos({
				limit: LOAD_BATCH_SIZE,
			});
			return result.videos;
		} catch (error) {
			console.warn("[FeedLoader] Failed to load videos:", error);
			return [];
		}
	}

	private async loadSequences(
		filter?: FeedContentType
	): Promise<SequenceData[]> {
		// Skip if only videos requested
		if (filter === "video") {
			return [];
		}

		try {
			const all = await this.sequenceLoader.loadSequenceMetadata();

			// Filter to only public sequences (those with ownerId indicates they were published)
			let publicSequences = all.filter((s) => s.ownerId);

			// Further filter by content type if needed
			if (filter === "animation") {
				publicSequences = publicSequences.filter((s) => s.animatedSequenceUrl);
			} else if (filter === "pictograph") {
				publicSequences = publicSequences.filter((s) => !s.animatedSequenceUrl);
			}

			return publicSequences;
		} catch (error) {
			console.warn("[FeedLoader] Failed to load sequences:", error);
			return [];
		}
	}

	private videoToFeedItem(video: CollaborativeVideo): FeedItem {
		const isTutorial = this.detectTutorialIntent(video.description);
		const creator = video.collaborators.find((c) => c.role === "creator");

		return {
			id: `video-${video.id}`,
			contentType: "video",
			intent: isTutorial ? "tutorial" : "demo",
			videoUrl: video.videoUrl,
			thumbnailUrl: video.thumbnailUrl || "",
			duration: video.duration,
			title: video.sequenceName || "Untitled",
			description: video.description,
			creatorId: video.creatorId,
			creatorName: creator?.displayName || "Unknown",
			creatorAvatarUrl: creator?.avatarUrl,
			createdAt: video.createdAt,
			sourceType: "video",
			sourceId: video.id,
			sequenceId: video.sequenceId,
		};
	}

	private sequenceToFeedItem(sequence: SequenceData): FeedItem {
		const hasAnimation = !!sequence.animatedSequenceUrl;
		const intent = this.detectSequenceIntent(sequence);

		return {
			id: `seq-${sequence.id}`,
			contentType: hasAnimation ? "animation" : "pictograph",
			intent,
			animationUrl: sequence.animatedSequenceUrl,
			thumbnailUrl: sequence.thumbnails[0] || "",
			title: sequence.displayName || sequence.word,
			creatorId: sequence.ownerId || "",
			creatorName: sequence.ownerDisplayName || sequence.author || "Unknown",
			creatorAvatarUrl: sequence.ownerAvatarUrl,
			createdAt: sequence.dateAdded || new Date(),
			sourceType: "sequence",
			sourceId: sequence.id,
			sequenceId: sequence.id,
			word: sequence.word,
			stepCount: sequence.steps?.length,
			tags: sequence.tags,
		};
	}

	private detectTutorialIntent(description?: string): boolean {
		if (!description) return false;
		const lower = description.toLowerCase();
		return (
			lower.includes("tutorial") ||
			lower.includes("lesson") ||
			lower.includes("learn") ||
			lower.includes("how to")
		);
	}

	private detectSequenceIntent(sequence: SequenceData): FeedItemIntent {
		// Check tags for tutorial indicator
		if (sequence.tags?.some((t) => t.toLowerCase() === "tutorial")) {
			return "tutorial";
		}
		// Default to sequence intent
		return "sequence";
	}

	/**
	 * Ensures content variety by interleaving different content types
	 * if the first few items are all the same type.
	 */
	private ensureVariety(items: FeedItem[]): FeedItem[] {
		if (items.length < 5) return items;

		const firstFive = items.slice(0, 5);
		const firstItem = firstFive[0];
		if (!firstItem) return items;

		const allSameType = firstFive.every(
			(i) => i.contentType === firstItem.contentType
		);

		if (!allSameType) return items;

		// Interleave videos with other content types
		const videos = items.filter((i) => i.contentType === "video");
		const others = items.filter((i) => i.contentType !== "video");

		if (videos.length === 0 || others.length === 0) return items;

		const interleaved: FeedItem[] = [];
		const maxLen = Math.max(videos.length, others.length);

		for (let i = 0; i < maxLen; i++) {
			const video = videos[i];
			const other = others[i];
			if (video) interleaved.push(video);
			if (other) interleaved.push(other);
		}

		return interleaved;
	}
}

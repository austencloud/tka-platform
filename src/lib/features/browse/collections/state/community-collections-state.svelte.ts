import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import { getUsers } from "$lib/shared/community/services/user-repository";
import { getUserPublicCollections } from "$lib/features/library/services/public-collection-loader";

/**
 * community-collections-state - everyone's public collections, flattened.
 *
 * The Community sub-view of Browse > Collections shows public collections
 * from every creator as one grid. There's no cross-user Firestore index for
 * this yet, so we aggregate the same way the old creator-browser did: list
 * creators, then pull each one's public collections (a cheap per-creator
 * query the rules already allow — no sign-in required). Results are cached
 * for the session so tab-hopping doesn't refetch.
 *
 * A public collection with its owner attached — the card needs a name to
 * credit, and opening one read-only needs the owner's uid to find it.
 */
export interface CommunityCollection {
	collection: LibraryCollection;
	ownerId: string;
	ownerName: string;
}

class CommunityCollectionsState {
	items = $state<CommunityCollection[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);

	private loadedFor: string | null = null;

	/**
	 * Load once per session (keyed by whose view it is, so signing in/out
	 * refreshes the "not yours" filtering). Your own public collections are
	 * excluded — they already live in the Mine view.
	 */
	async ensureLoaded(excludeUserId: string | null): Promise<void> {
		const key = excludeUserId ?? "anon";
		if (this.loadedFor === key || this.loading) return;

		this.loading = true;
		this.error = null;
		try {
			// Second arg only decorates follow-status — not needed for a feed.
			const creators = await getUsers();

			const perCreator = await Promise.all(
				creators
					.filter((c) => c.id !== excludeUserId)
					.map(async (creator) => {
						try {
							const collections = await getUserPublicCollections(creator.id);
							return collections.map(
								(collection): CommunityCollection => ({
									collection,
									ownerId: creator.id,
									ownerName: creator.displayName || "Someone",
								}),
							);
						} catch (err) {
							// One creator failing shouldn't blank the whole feed.
							console.warn(
								`[community-collections] Failed for ${creator.id}:`,
								err,
							);
							return [];
						}
					}),
			);

			this.items = perCreator
				.flat()
				.filter((item) => item.collection.sequenceCount > 0)
				.sort(
					(a, b) =>
						b.collection.updatedAt.getTime() - a.collection.updatedAt.getTime(),
				);
			this.loadedFor = key;
		} catch (err) {
			console.error("[community-collections] Failed to load:", err);
			this.error = "Couldn't load community collections.";
		} finally {
			this.loading = false;
		}
	}

	/** Drop the cache so the next ensureLoaded refetches. */
	invalidate(): void {
		this.loadedFor = null;
	}

	/** Find a loaded community collection by its owner + id (for detail restore). */
	find(ownerId: string, collectionId: string): CommunityCollection | null {
		return (
			this.items.find(
				(i) => i.ownerId === ownerId && i.collection.id === collectionId,
			) ?? null
		);
	}
}

export const communityCollectionsState = new CommunityCollectionsState();

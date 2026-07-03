import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import { getVisibleOwnerNames } from "$lib/shared/community/services/user-repository";
import { getAllPublicCollections } from "$lib/features/library/services/public-collection-loader";

/**
 * community-collections-state - everyone's public collections, flattened.
 *
 * The Community sub-view of Browse > Collections shows public collections from
 * every creator as one grid. One collection-group query pulls them all (newest
 * first, capped) via `getAllPublicCollections`, then a single batched pass
 * resolves owner display names. This scales with the number of public
 * collections, not the user count — the earlier per-creator crawl (list every
 * user, query each one) grew with the whole user base. Results are cached for
 * the session so tab-hopping doesn't refetch.
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

	private loaded = false;
	private refetchPending = false;

	/**
	 * Load once per session. EVERY public collection is here — including your
	 * own and including empty ones. Publishing something and not seeing it in
	 * Community reads as a bug, so the feed shows exactly what the flag says.
	 */
	async ensureLoaded(): Promise<void> {
		if (this.loaded || this.loading) return;

		this.loading = true;
		this.error = null;
		try {
			// One collection-group query, already sorted newest-first server-side.
			const withOwners = await getAllPublicCollections();

			// One batched pass for the names of the (few) distinct owners. Owners
			// that are hidden/guest/deleted are absent from the map, and their
			// collections are filtered out — discovery never credits or surfaces a
			// moderated or orphaned owner.
			const names = await getVisibleOwnerNames(withOwners.map((w) => w.ownerId));

			this.items = withOwners
				.filter((w) => names.has(w.ownerId))
				.map(
					({ collection, ownerId }): CommunityCollection => ({
						collection,
						ownerId,
						ownerName: names.get(ownerId) ?? "Someone",
					}),
				);
			this.loaded = true;
		} catch (err) {
			console.error("[community-collections] Failed to load:", err);
			this.error = "Couldn't load community collections.";
		} finally {
			this.loading = false;
			// An invalidate() that landed mid-load (e.g. publish/unpublish while
			// the grid was open) is honored now so the view self-heals instead of
			// showing stale cards until the next navigation.
			if (this.refetchPending) {
				this.refetchPending = false;
				this.loaded = false;
				void this.ensureLoaded();
			}
		}
	}

	/**
	 * Drop the cache and refetch — call after anything that changes what's
	 * public (Make public / Make private). If a load is in flight, defer the
	 * refetch to its completion; otherwise refetch now so a currently-open grid
	 * updates without waiting for a navigation.
	 */
	invalidate(): void {
		this.loaded = false;
		if (this.loading) {
			this.refetchPending = true;
		} else {
			void this.ensureLoaded();
		}
	}
}

export const communityCollectionsState = new CommunityCollectionsState();

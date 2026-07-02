import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import {
	followCollection,
	subscribeToFollowedCollections,
	unfollowCollection,
	type FollowedCollectionRef,
} from "$lib/shared/library/services/followed-collections";
import { getPublicCollection } from "$lib/features/library/services/public-collection-loader";
import { getUserProfile } from "$lib/shared/community/services/user-repository";

export interface FollowedCollection {
	readonly collection: LibraryCollection;
	readonly ownerId: string;
	readonly ownerName: string;
}

/**
 * followed-collections-state - live view of collections you follow.
 *
 * Mirrors collections-state: a single subscription over the follow refs;
 * each snapshot resolves refs to their live public collection docs + owner
 * names. A follow whose collection was deleted or unpublished resolves to
 * null and silently drops out — the follow doc stays, so re-publishing
 * brings it back.
 */
class FollowedCollectionsState {
	items = $state<FollowedCollection[]>([]);
	loading = $state(false);

	private refs: FollowedCollectionRef[] = [];
	private unsubscribe: (() => void) | null = null;
	private startedFor: string | null = null;
	private resolveEpoch = 0;

	ensureStarted(): void {
		const uid = authState.user?.uid ?? null;
		if (!uid || this.startedFor === uid) return;

		this.teardown();
		this.startedFor = uid;
		this.loading = true;

		void subscribeToFollowedCollections((refs) => {
			this.refs = refs;
			void this.resolve(refs);
		})
			.then((unsub) => {
				// A teardown can race the async subscribe — drop the late sub.
				if (this.startedFor === uid) {
					this.unsubscribe = unsub;
				} else {
					unsub();
				}
			})
			.catch((err) => {
				console.error("[followed-collections] subscribe failed:", err);
				this.loading = false;
			});
	}

	teardown(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.startedFor = null;
		this.refs = [];
		this.items = [];
		this.loading = false;
		this.resolveEpoch++;
	}

	isFollowed(ownerId: string, collectionId: string): boolean {
		return this.refs.some(
			(r) => r.ownerId === ownerId && r.collectionId === collectionId,
		);
	}

	async follow(ownerId: string, collectionId: string): Promise<void> {
		try {
			await followCollection(ownerId, collectionId);
		} catch (err) {
			console.error("[followed-collections] follow failed:", err);
			toast.error("Couldn't follow that collection. Try again.");
		}
	}

	async unfollow(ownerId: string, collectionId: string): Promise<void> {
		try {
			await unfollowCollection(ownerId, collectionId);
		} catch (err) {
			console.error("[followed-collections] unfollow failed:", err);
			toast.error("Couldn't unfollow that collection. Try again.");
		}
	}

	private async resolve(refs: FollowedCollectionRef[]): Promise<void> {
		const epoch = ++this.resolveEpoch;
		const resolved = await Promise.all(
			refs.map(async (ref) => {
				const col = await getPublicCollection(ref.ownerId, ref.collectionId);
				if (!col) return null;
				const owner = await getUserProfile(ref.ownerId);
				return {
					collection: col,
					ownerId: ref.ownerId,
					ownerName: owner?.displayName ?? "Someone",
				} satisfies FollowedCollection;
			}),
		);
		// A newer snapshot's resolution may have started while this one awaited.
		if (epoch !== this.resolveEpoch) return;
		this.items = resolved.filter((r): r is FollowedCollection => r !== null);
		this.loading = false;
	}
}

export const followedCollectionsState = new FollowedCollectionsState();

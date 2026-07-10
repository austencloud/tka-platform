import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import { isSmartCollection } from "$lib/shared/library/domain/models/collection";
import {
	followCollection,
	subscribeToFollowedCollections,
	unfollowCollection,
	type FollowedCollectionRef,
} from "$lib/shared/library/services/followed-collections";
import {
	getPublicCollection,
	countPublicMembers,
} from "$lib/features/library/services/public-collection-loader";
import { getUserDisplayNames } from "$lib/shared/community/services/user-repository";

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

	// $state so isFollowed() recomputes in reactive positions (the foreign
	// detail Follow/Unfollow button) when a snapshot rewrites the refs.
	private refs = $state<FollowedCollectionRef[]>([]);
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

		try {
			// Collection docs live at per-owner paths, so each is its own read (no
			// cross-path batch get exists) — but they fetch in parallel. A single
			// read that rejects (network, or a rule that DENIES a now-private
			// collection instead of returning it) must drop only THAT entry, so
			// each read is caught to null — Promise.all is all-or-nothing and one
			// rejection would otherwise take down the whole followed list.
			const cols = await Promise.all(
				refs.map((ref) =>
					getPublicCollection(ref.ownerId, ref.collectionId).catch(() => null),
				),
			);

			const surviving = refs
				.map((ref, i) => ({ ref, col: cols[i] }))
				.filter((r): r is { ref: FollowedCollectionRef; col: LibraryCollection } => r.col !== null);

			// Owner names resolve in ONE batched pass over the surviving owners,
			// not one profile read per follow.
			const names = await getUserDisplayNames(surviving.map((s) => s.ref.ownerId));

			// Followers only ever see a collection's PUBLIC members, but the doc's
			// sequenceCount includes the owner's private ones — count against the
			// public index instead so the rail agrees with the opened view. Smart
			// collections derive membership from filterSpec; keep their stored count.
			const publicCounts = await Promise.all(
				surviving.map(({ col }) =>
					isSmartCollection(col)
						? Promise.resolve(col.sequenceCount)
						: countPublicMembers(col.sequenceIds).catch(() => col.sequenceCount),
				),
			);

			// A newer snapshot's resolution may have started while this one awaited.
			if (epoch !== this.resolveEpoch) return;
			this.items = surviving.map(
				({ ref, col }, i): FollowedCollection => ({
					collection: { ...col, sequenceCount: publicCounts[i]! },
					ownerId: ref.ownerId,
					ownerName: names.get(ref.ownerId) ?? "Someone",
				}),
			);
		} catch (err) {
			// Batched name lookup failed; keep the last good items rather than
			// wedging. The next snapshot re-resolves.
			if (epoch === this.resolveEpoch) {
				console.error("[followed-collections] resolve failed:", err);
			}
		} finally {
			// Always clear loading for the newest resolve so the "Following"
			// section can render (or fall back to empty) instead of spinning
			// forever.
			if (epoch === this.resolveEpoch) this.loading = false;
		}
	}
}

export const followedCollectionsState = new FollowedCollectionsState();

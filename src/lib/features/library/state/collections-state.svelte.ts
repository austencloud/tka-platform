import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { LIBRARY_LIMITS } from "$lib/shared/library/data/firestore-paths";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import {
	subscribeToCollections,
	addSequenceToCollection,
	removeSequenceFromCollection,
	createUserCollection,
	ensureSystemCollections,
	updateCollection,
	deleteCollection,
} from "$lib/shared/library/services/collection-manager";

/**
 * collections-state - live view of the signed-in user's own collections.
 *
 * A single subscription over collection-manager's `subscribeToCollections`
 * feeds every add-to-collection surface (the browse card picker sheet, the
 * save dialog). Firestore latency compensation means an add/remove reflects in
 * the snapshot immediately and rolls back on rejection, so toggle needs no
 * manual optimistic bookkeeping — the subscription is the single source of
 * truth for membership. Mirrors the shape of mandala-collection-state.
 */
class CollectionsState {
	collections = $state<LibraryCollection[]>([]);
	// True until the first snapshot lands, so pickers show skeletons instead of
	// mistaking "not loaded yet" for "you have no collections".
	loading = $state(false);

	private unsubscribe: (() => void) | null = null;
	private startedFor: string | null = null;

	/**
	 * Idempotently begin (or restart for a new user) the live subscription.
	 * Safe to call on every picker open: no-op when unauthenticated or already
	 * live for the current user.
	 */
	ensureStarted(): void {
		const uid = authState.user?.uid ?? null;
		if (!uid || this.startedFor === uid) return;

		this.teardown();
		this.startedFor = uid;
		this.loading = true;

		// Favorites has to exist so it can anchor the picker's first chip; the
		// subscription reports it the moment it's created. Fire-and-forget.
		ensureSystemCollections().catch((err) =>
			console.error("[collections-state] ensureSystemCollections failed:", err),
		);

		this.unsubscribe = subscribeToCollections((cols) => {
			this.collections = cols;
			this.loading = false;
		});
	}

	teardown(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.startedFor = null;
		this.collections = [];
		this.loading = false;
	}

	isIn(sequenceId: string, collectionId: string): boolean {
		const c = this.collections.find((col) => col.id === collectionId);
		return !!c && c.sequenceIds.includes(sequenceId);
	}

	/**
	 * Toggle membership with a live write. The manager surfaces its own error
	 * toast; on failure latency compensation reverts the snapshot, so we only
	 * swallow the thrown error here. Guards the per-collection cap up front.
	 */
	async toggle(sequenceId: string, collectionId: string): Promise<void> {
		const c = this.collections.find((col) => col.id === collectionId);
		if (!c) return;

		const isMember = c.sequenceIds.includes(sequenceId);
		if (!isMember && c.sequenceCount >= LIBRARY_LIMITS.MAX_SEQUENCES_PER_COLLECTION) {
			toast.error(`"${c.name}" is full (${LIBRARY_LIMITS.MAX_SEQUENCES_PER_COLLECTION} max).`);
			return;
		}

		try {
			if (isMember) {
				await removeSequenceFromCollection(collectionId, sequenceId);
			} else {
				await addSequenceToCollection(collectionId, sequenceId);
			}
		} catch {
			// manager already toasted; the subscription stays authoritative.
		}
	}

	/**
	 * Create a new empty collection, guarding the per-user cap (system
	 * collections don't count against it). Returns null when blocked or on
	 * failure (the manager toasts its own error).
	 */
	async create(name: string): Promise<LibraryCollection | null> {
		const trimmed = name.trim();
		if (!trimmed) return null;

		const userCount = this.collections.filter((c) => !c.systemType).length;
		if (userCount >= LIBRARY_LIMITS.MAX_COLLECTIONS_PER_USER) {
			toast.error(`Collection limit reached (${LIBRARY_LIMITS.MAX_COLLECTIONS_PER_USER} max).`);
			return null;
		}

		try {
			return await createUserCollection(trimmed);
		} catch {
			return null;
		}
	}

	/**
	 * Rename a collection. Returns false when the name is empty or the write
	 * fails — the manager blocks system collections (Favorites can't be
	 * renamed) and toasts its own error, so callers only need the boolean.
	 */
	async rename(collectionId: string, name: string): Promise<boolean> {
		const trimmed = name.trim();
		if (!trimmed) return false;
		try {
			await updateCollection(collectionId, { name: trimmed });
			return true;
		} catch {
			return false; // manager already toasted
		}
	}

	/**
	 * Publish or unpublish a collection. Public collections appear in
	 * Browse > Collections > Community for everyone; private ones are yours
	 * alone. Returns false when the write fails (manager toasts).
	 */
	async setPublic(collectionId: string, isPublic: boolean): Promise<boolean> {
		try {
			await updateCollection(collectionId, { isPublic });
			return true;
		} catch {
			return false; // manager already toasted
		}
	}

	/**
	 * Delete a collection. The manager cascades membership cleanup and refuses
	 * system collections (Favorites is permanent), toasting its own error.
	 * The sequences themselves are untouched — only the folder goes away.
	 */
	async remove(collectionId: string): Promise<boolean> {
		try {
			await deleteCollection(collectionId);
			return true;
		} catch {
			return false; // manager already toasted
		}
	}

	/** Create a collection and immediately file a sequence into it (live). */
	async createAndAdd(name: string, sequenceId: string): Promise<LibraryCollection | null> {
		const created = await this.create(name);
		if (!created) return null;
		try {
			await addSequenceToCollection(created.id, sequenceId);
		} catch {
			// manager already toasted.
		}
		return created;
	}
}

export const collectionsState = new CollectionsState();

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";
import type { FollowedCollectionRef } from "$lib/shared/library/services/followed-collections";

// Captured snapshot callback so a test can emit follow refs like onSnapshot would.
const mocks = vi.hoisted(() => ({
	followCollection: vi.fn(),
	unfollowCollection: vi.fn(),
	getPublicCollection: vi.fn(),
	getUserDisplayNames: vi.fn(),
	toastError: vi.fn(),
	snapshotCb: null as ((refs: FollowedCollectionRef[]) => void) | null,
}));

vi.mock("$lib/shared/library/services/followed-collections", () => ({
	followCollection: mocks.followCollection,
	unfollowCollection: mocks.unfollowCollection,
	subscribeToFollowedCollections: (cb: (refs: FollowedCollectionRef[]) => void) => {
		mocks.snapshotCb = cb;
		return Promise.resolve(() => {});
	},
}));
vi.mock("$lib/features/library/services/public-collection-loader", () => ({
	getPublicCollection: mocks.getPublicCollection,
}));
vi.mock("$lib/shared/community/services/user-repository", () => ({
	getUserDisplayNames: mocks.getUserDisplayNames,
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
	authState: { user: { uid: "me" } },
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
	toast: { error: mocks.toastError, success: vi.fn() },
}));

import { followedCollectionsState } from "../followed-collections-state.svelte";

function col(id: string, opts: Partial<LibraryCollection> = {}): LibraryCollection {
	return {
		id,
		name: id.toUpperCase(),
		ownerId: "o",
		sequenceIds: [],
		sequenceCount: 0,
		isPublic: true,
		sortOrder: 0,
		icon: "fa-folder",
		createdAt: new Date(),
		updatedAt: new Date(),
		...opts,
	};
}

/** Drive one snapshot through resolve() and wait for it to settle. */
async function emit(refs: FollowedCollectionRef[]): Promise<void> {
	followedCollectionsState.ensureStarted();
	// ensureStarted subscribes asynchronously; let the resolved promise register.
	await Promise.resolve();
	mocks.snapshotCb?.(refs);
	await vi.waitFor(() => expect(followedCollectionsState.loading).toBe(false));
}

beforeEach(() => {
	followedCollectionsState.teardown();
	vi.clearAllMocks();
	mocks.snapshotCb = null;
	mocks.getUserDisplayNames.mockResolvedValue(new Map<string, string>());
});

describe("followedCollectionsState", () => {
	it("keeps the surviving collections when one ref's read rejects", async () => {
		mocks.getPublicCollection.mockImplementation((ownerId: string, colId: string) =>
			colId === "c1" ? Promise.resolve(col("c1")) : Promise.reject(new Error("denied")),
		);
		mocks.getUserDisplayNames.mockResolvedValue(new Map([["o1", "Alice"]]));

		await emit([
			{ ownerId: "o1", collectionId: "c1" },
			{ ownerId: "o2", collectionId: "c2" },
		]);

		// The rejecting ref drops out; the whole list is NOT wedged.
		expect(followedCollectionsState.items).toHaveLength(1);
		const [survivor] = followedCollectionsState.items;
		expect(survivor?.collection.id).toBe("c1");
		expect(survivor?.ownerName).toBe("Alice");
		expect(followedCollectionsState.loading).toBe(false);
	});

	it("passes the loader's normalized sequenceCount through untouched", async () => {
		// The loader owns public-count normalization (module invariant); the
		// rail must not re-derive or patch it. Owner stores 4 ids, loader
		// already normalized the count to 1 — the rail shows 1.
		mocks.getPublicCollection.mockResolvedValue(
			col("c1", { sequenceIds: ["a", "b", "c", "d"], sequenceCount: 1 }),
		);
		mocks.getUserDisplayNames.mockResolvedValue(new Map([["o1", "Alice"]]));

		await emit([{ ownerId: "o1", collectionId: "c1" }]);

		expect(followedCollectionsState.items[0]?.collection.sequenceCount).toBe(1);
	});

	it("drops a follow whose collection is null (deleted/unpublished)", async () => {
		mocks.getPublicCollection.mockResolvedValue(null);

		await emit([{ ownerId: "o1", collectionId: "gone" }]);

		expect(followedCollectionsState.items).toHaveLength(0);
		expect(followedCollectionsState.loading).toBe(false);
	});

	it("resolves loading even when the batched name lookup rejects", async () => {
		mocks.getPublicCollection.mockResolvedValue(col("c1"));
		mocks.getUserDisplayNames.mockRejectedValue(new Error("network"));

		await emit([{ ownerId: "o1", collectionId: "c1" }]);

		// Never stuck spinning; last-good items preserved (empty here).
		expect(followedCollectionsState.loading).toBe(false);
	});

	it("falls back to 'Someone' when an owner name is missing", async () => {
		mocks.getPublicCollection.mockResolvedValue(col("c1"));
		mocks.getUserDisplayNames.mockResolvedValue(new Map());

		await emit([{ ownerId: "ghost", collectionId: "c1" }]);

		const [item] = followedCollectionsState.items;
		expect(item?.ownerName).toBe("Someone");
	});

	it("isFollowed reflects the emitted refs", async () => {
		mocks.getPublicCollection.mockResolvedValue(col("c1"));

		await emit([{ ownerId: "o1", collectionId: "c1" }]);

		expect(followedCollectionsState.isFollowed("o1", "c1")).toBe(true);
		expect(followedCollectionsState.isFollowed("o1", "other")).toBe(false);
	});
});

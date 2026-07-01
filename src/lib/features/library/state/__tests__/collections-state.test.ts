import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LibraryCollection } from "$lib/shared/library/domain/models/collection";

const mocks = vi.hoisted(() => ({
	addSequenceToCollection: vi.fn(),
	removeSequenceFromCollection: vi.fn(),
	createUserCollection: vi.fn(),
	ensureSystemCollections: vi.fn(),
	subscribeToCollections: vi.fn(() => () => {}),
	toastError: vi.fn(),
}));

vi.mock("$lib/shared/library/services/collection-manager", () => ({
	addSequenceToCollection: mocks.addSequenceToCollection,
	removeSequenceFromCollection: mocks.removeSequenceFromCollection,
	createUserCollection: mocks.createUserCollection,
	ensureSystemCollections: mocks.ensureSystemCollections,
	subscribeToCollections: mocks.subscribeToCollections,
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
	toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({ authState: { user: null } }));

import { collectionsState } from "../collections-state.svelte";

function col(id: string, name: string, opts: Partial<LibraryCollection> = {}): LibraryCollection {
	return {
		id,
		name,
		ownerId: "u1",
		sequenceIds: [],
		sequenceCount: 0,
		isPublic: false,
		sortOrder: 0,
		icon: "fa-folder",
		createdAt: new Date(),
		updatedAt: new Date(),
		...opts,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.addSequenceToCollection.mockResolvedValue(undefined);
	mocks.removeSequenceFromCollection.mockResolvedValue(undefined);
	mocks.createUserCollection.mockImplementation(async (name: string) => col("new", name));
	collectionsState.collections = [];
	collectionsState.loading = false;
});

describe("collectionsState", () => {
	it("isIn reflects membership", () => {
		collectionsState.collections = [col("c1", "A", { sequenceIds: ["s1"], sequenceCount: 1 })];
		expect(collectionsState.isIn("s1", "c1")).toBe(true);
		expect(collectionsState.isIn("s2", "c1")).toBe(false);
		expect(collectionsState.isIn("s1", "missing")).toBe(false);
	});

	it("toggle adds a sequence when it is not yet a member", async () => {
		collectionsState.collections = [col("c1", "A")];
		await collectionsState.toggle("s1", "c1");
		expect(mocks.addSequenceToCollection).toHaveBeenCalledWith("c1", "s1");
		expect(mocks.removeSequenceFromCollection).not.toHaveBeenCalled();
	});

	it("toggle removes a sequence when it is already a member", async () => {
		collectionsState.collections = [col("c1", "A", { sequenceIds: ["s1"], sequenceCount: 1 })];
		await collectionsState.toggle("s1", "c1");
		expect(mocks.removeSequenceFromCollection).toHaveBeenCalledWith("c1", "s1");
		expect(mocks.addSequenceToCollection).not.toHaveBeenCalled();
	});

	it("toggle blocks an add when the collection is full and toasts", async () => {
		collectionsState.collections = [col("c1", "A", { sequenceCount: 500 })];
		await collectionsState.toggle("s1", "c1");
		expect(mocks.addSequenceToCollection).not.toHaveBeenCalled();
		expect(mocks.toastError).toHaveBeenCalled();
	});

	it("create blocks at the per-user cap, excluding system collections", async () => {
		const many = Array.from({ length: 100 }, (_, i) => col(`c${i}`, `C${i}`));
		collectionsState.collections = [col("fav", "Favorites", { systemType: "favorites" }), ...many];
		const result = await collectionsState.create("New");
		expect(result).toBeNull();
		expect(mocks.createUserCollection).not.toHaveBeenCalled();
		expect(mocks.toastError).toHaveBeenCalled();
	});

	it("create trims the name and delegates under the cap", async () => {
		collectionsState.collections = [col("fav", "Favorites", { systemType: "favorites" })];
		const result = await collectionsState.create("  Poi  ");
		expect(mocks.createUserCollection).toHaveBeenCalledWith("Poi");
		expect(result?.name).toBe("Poi");
	});

	it("create ignores an empty name", async () => {
		const result = await collectionsState.create("   ");
		expect(result).toBeNull();
		expect(mocks.createUserCollection).not.toHaveBeenCalled();
	});
});

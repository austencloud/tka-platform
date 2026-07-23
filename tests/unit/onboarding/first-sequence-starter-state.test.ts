// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	authState: {
		isFullAccount: false,
		effectiveUserId: "guest-1" as string | null,
	},
	flagOn: true,
	getDoc: vi.fn(),
	setDoc: vi.fn(),
	getDocs: vi.fn(),
	dexieCount: vi.fn(),
}));

vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
	authState: mocks.authState,
}));

vi.mock("$lib/shared/auth/firebase", () => ({
	getFirestoreInstance: vi.fn(async () => ({})),
}));

vi.mock("firebase/firestore", () => ({
	doc: vi.fn((...args: unknown[]) => ({ path: args.join("/") })),
	getDoc: mocks.getDoc,
	setDoc: mocks.setDoc,
	serverTimestamp: vi.fn(() => "server-ts"),
	collection: vi.fn((...args: unknown[]) => ({ path: args.join("/") })),
	query: vi.fn((...args: unknown[]) => args),
	limit: vi.fn((n: number) => ({ limit: n })),
	getDocs: mocks.getDocs,
}));

vi.mock("$lib/shared/persistence/database/tka-database", () => ({
	db: {
		sequences: {
			count: mocks.dexieCount,
		},
	},
}));

vi.mock("$lib/shared/library/data/firestore-paths", () => ({
	getUserSequencesPath: (uid: string) => `users/${uid}/sequences`,
}));

// The extended state module statically imports the flag service for its
// synchronous isEligible getter - mock it so the eligible path is testable
// (the real default flag is off).
vi.mock("$lib/shared/auth/services/post-hog-feature-flag-service.svelte", () => ({
	postHogFeatureFlagService: {
		canAccess: () => mocks.flagOn,
	},
}));

import {
	firstSequenceStarterState,
	resolveHasSavedAnything,
} from "$lib/shared/onboarding/state/first-sequence-starter-state.svelte";

const DISMISSED_KEY = "tka-first-sequence-starter-dismissed";

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe("firstSequenceStarterState", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		mocks.authState.isFullAccount = false;
		mocks.authState.effectiveUserId = "guest-1";
		mocks.flagOn = true;
		mocks.getDoc.mockResolvedValue({ exists: () => false });
		mocks.setDoc.mockResolvedValue(undefined);
		firstSequenceStarterState.reset();
	});

	it("markDismissed persists locally and consumes an active session rearm", async () => {
		firstSequenceStarterState.rearmForSession();
		expect(firstSequenceStarterState.sessionRearm).toBe(true);

		firstSequenceStarterState.markDismissed();

		expect(firstSequenceStarterState.dismissed).toBe(true);
		expect(firstSequenceStarterState.sessionRearm).toBe(false);
		expect(localStorage.getItem(DISMISSED_KEY)).toBe("true");

		// Flush the fire-and-forget syncToCloud() triggered above so its
		// dynamic import settles deterministically before the next test runs.
		await firstSequenceStarterState.syncToCloud();
	});

	it("syncFromCloud resets local dismissal on a missing doc (shared-browser guard)", async () => {
		localStorage.setItem(DISMISSED_KEY, "true");
		firstSequenceStarterState.reset();
		firstSequenceStarterState.markDismissed();
		expect(firstSequenceStarterState.dismissed).toBe(true);

		// Flush markDismissed's fire-and-forget syncToCloud() before starting
		// the syncFromCloud() below - otherwise the two overlapping dynamic
		// imports of the same mocked module race each other.
		await firstSequenceStarterState.syncToCloud();

		// Reset cloudSynced so a fresh sync can run, but keep dismissed=true
		// to prove the missing-doc branch actively resets it.
		firstSequenceStarterState.resetCloudSync();
		mocks.getDoc.mockResolvedValue({ exists: () => false });

		await firstSequenceStarterState.syncFromCloud();

		expect(firstSequenceStarterState.dismissed).toBe(false);
		expect(firstSequenceStarterState.cloudSynced).toBe(true);
		expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
	});

	it("syncFromCloud adopts a cloud dismissed=true doc", async () => {
		mocks.getDoc.mockResolvedValue({
			exists: () => true,
			data: () => ({ dismissed: true }),
		});

		await firstSequenceStarterState.syncFromCloud();

		expect(firstSequenceStarterState.dismissed).toBe(true);
		expect(firstSequenceStarterState.cloudSynced).toBe(true);
	});

	it("syncFromCloud resolves locally and immediately for a no-uid visitor", async () => {
		mocks.authState.effectiveUserId = null;

		await firstSequenceStarterState.syncFromCloud();

		expect(firstSequenceStarterState.cloudSynced).toBe(true);
		expect(mocks.getDoc).not.toHaveBeenCalled();
	});

	it("abandons a queued cloud write when the account session resets", async () => {
		const staleWrite = firstSequenceStarterState.syncToCloud();
		firstSequenceStarterState.resetCloudSync();

		await staleWrite;

		expect(mocks.setDoc).not.toHaveBeenCalled();
	});

	it("joins concurrent cloud sync callers into one Firestore read", async () => {
		const cloudRead = createDeferred<{
			exists: () => boolean;
		}>();
		mocks.getDoc.mockReturnValueOnce(cloudRead.promise);

		const bootSync = firstSequenceStarterState.syncFromCloud();
		const resolveSync = firstSequenceStarterState.syncFromCloud();

		await vi.waitFor(() => {
			expect(mocks.getDoc).toHaveBeenCalledTimes(1);
		});

		cloudRead.resolve({ exists: () => false });
		await Promise.all([bootSync, resolveSync]);

		expect(mocks.getDoc).toHaveBeenCalledTimes(1);
		expect(firstSequenceStarterState.cloudSynced).toBe(true);
	});

	it("ignores an old account's cloud read after an account reset", async () => {
		const accountARead = createDeferred<{
			exists: () => boolean;
			data: () => { dismissed: boolean };
		}>();
		mocks.getDoc
			.mockReturnValueOnce(accountARead.promise)
			.mockResolvedValueOnce({ exists: () => false });

		mocks.authState.effectiveUserId = "account-a";
		const staleSync = firstSequenceStarterState.syncFromCloud();
		await vi.waitFor(() => {
			expect(mocks.getDoc).toHaveBeenCalledTimes(1);
		});

		firstSequenceStarterState.resetCloudSync();
		mocks.authState.effectiveUserId = "account-b";
		await firstSequenceStarterState.syncFromCloud();

		accountARead.resolve({
			exists: () => true,
			data: () => ({ dismissed: true }),
		});
		await staleSync;

		expect(firstSequenceStarterState.dismissed).toBe(false);
		expect(firstSequenceStarterState.cloudSynced).toBe(true);
		expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
		expect(mocks.getDoc).toHaveBeenCalledTimes(2);
	});

	describe("resolveHasSavedAnything", () => {
		it("checks Dexie for a guest account", async () => {
			mocks.authState.isFullAccount = false;
			mocks.dexieCount.mockResolvedValue(3);

			await expect(resolveHasSavedAnything()).resolves.toBe(true);
			expect(mocks.dexieCount).toHaveBeenCalled();
			expect(mocks.getDocs).not.toHaveBeenCalled();
		});

		it("returns false for a guest with an empty Dexie library", async () => {
			mocks.authState.isFullAccount = false;
			mocks.dexieCount.mockResolvedValue(0);

			await expect(resolveHasSavedAnything()).resolves.toBe(false);
		});

		it("checks Firestore (limit 1) for a full account, never Dexie", async () => {
			mocks.authState.isFullAccount = true;
			mocks.authState.effectiveUserId = "full-user-1";
			mocks.getDocs.mockResolvedValue({ empty: false });

			await expect(resolveHasSavedAnything()).resolves.toBe(true);
			expect(mocks.getDocs).toHaveBeenCalled();
			expect(mocks.dexieCount).not.toHaveBeenCalled();
		});

		it("returns false for a full account with no saved sequences", async () => {
			mocks.authState.isFullAccount = true;
			mocks.authState.effectiveUserId = "full-user-1";
			mocks.getDocs.mockResolvedValue({ empty: true });

			await expect(resolveHasSavedAnything()).resolves.toBe(false);
		});
	});

	describe("resolve / isEligible (three-state, flag-gated)", () => {
		it("stays unknown before resolve (no flash) and becomes eligible for an empty-library first-run guest", async () => {
			mocks.authState.effectiveUserId = null; // no-uid visitor resolves locally
			mocks.dexieCount.mockResolvedValue(0);
			firstSequenceStarterState.resetCloudSync();

			expect(firstSequenceStarterState.eligibility).toBe("unknown");
			expect(firstSequenceStarterState.isEligible).toBe(false);

			await firstSequenceStarterState.resolve();

			expect(firstSequenceStarterState.eligibility).toBe("eligible");
			expect(firstSequenceStarterState.isEligible).toBe(true);
		});

		it("resolves to ineligible when the account already has a saved sequence", async () => {
			mocks.authState.isFullAccount = false;
			mocks.dexieCount.mockResolvedValue(5);
			firstSequenceStarterState.resetCloudSync();

			await firstSequenceStarterState.resolve();

			expect(firstSequenceStarterState.eligibility).toBe("ineligible");
			expect(firstSequenceStarterState.isEligible).toBe(false);
		});

		it("with the flag off, resolve() spends no read and isEligible stays false", async () => {
			mocks.flagOn = false;
			mocks.dexieCount.mockResolvedValue(0);
			firstSequenceStarterState.resetCloudSync();

			await firstSequenceStarterState.resolve();

			expect(firstSequenceStarterState.eligibility).toBe("unknown");
			expect(mocks.dexieCount).not.toHaveBeenCalled();
			expect(firstSequenceStarterState.isEligible).toBe(false);
		});

		it("two concurrent resolve() calls join one run and both settle to the same eligibility", async () => {
			mocks.authState.effectiveUserId = null;
			mocks.dexieCount.mockResolvedValue(0);
			firstSequenceStarterState.resetCloudSync();

			// Kick off two resolves before either settles - the arbitration
			// (CreateModule) and the mount effect (StandardWorkspaceLayout) race
			// this way. Both must await the SAME settled eligibility.
			await Promise.all([
				firstSequenceStarterState.resolve(),
				firstSequenceStarterState.resolve(),
			]);

			expect(firstSequenceStarterState.eligibility).toBe("eligible");
			// The library probe ran once, not once per caller.
			expect(mocks.dexieCount).toHaveBeenCalledTimes(1);
		});

		it("ignores stale eligibility work without detaching a newer account's resolve", async () => {
			mocks.authState.effectiveUserId = null;
			const accountAProbe = createDeferred<number>();
			const accountBProbe = createDeferred<number>();
			mocks.dexieCount
				.mockReturnValueOnce(accountAProbe.promise)
				.mockReturnValueOnce(accountBProbe.promise);

			const staleResolve = firstSequenceStarterState.resolve();
			await vi.waitFor(() => {
				expect(mocks.dexieCount).toHaveBeenCalledTimes(1);
			});

			firstSequenceStarterState.resetCloudSync();
			const currentResolve = firstSequenceStarterState.resolve();
			await vi.waitFor(() => {
				expect(mocks.dexieCount).toHaveBeenCalledTimes(2);
			});

			accountAProbe.resolve(0);
			await staleResolve;

			// The old task's cleanup cannot erase the newer task. A third
			// caller still joins account B's pending probe.
			const joinedCurrentResolve = firstSequenceStarterState.resolve();
			expect(joinedCurrentResolve).toBe(currentResolve);
			expect(mocks.dexieCount).toHaveBeenCalledTimes(2);

			accountBProbe.resolve(3);
			await Promise.all([currentResolve, joinedCurrentResolve]);

			expect(firstSequenceStarterState.eligibility).toBe("ineligible");
			expect(firstSequenceStarterState.isEligible).toBe(false);
		});

		it("a dismissal hides an eligible starter, and a session rearm forces it back", async () => {
			mocks.authState.effectiveUserId = null;
			mocks.dexieCount.mockResolvedValue(0);
			firstSequenceStarterState.resetCloudSync();
			await firstSequenceStarterState.resolve();
			expect(firstSequenceStarterState.isEligible).toBe(true);

			firstSequenceStarterState.markDismissed();
			expect(firstSequenceStarterState.isEligible).toBe(false);
			await firstSequenceStarterState.syncToCloud();

			firstSequenceStarterState.rearmForSession();
			expect(firstSequenceStarterState.isEligible).toBe(true);
		});

		it("clears a session rearm when the account session resets", () => {
			firstSequenceStarterState.rearmForSession();
			expect(firstSequenceStarterState.sessionRearm).toBe(true);

			firstSequenceStarterState.resetCloudSync();

			expect(firstSequenceStarterState.sessionRearm).toBe(false);
			expect(firstSequenceStarterState.eligibility).toBe("unknown");
		});

		it("rearms after the user deletes their last sequence from the confirmed-empty Library view", async () => {
			mocks.authState.effectiveUserId = null;
			mocks.dexieCount.mockResolvedValueOnce(1);

			await firstSequenceStarterState.resolve();
			expect(firstSequenceStarterState.eligibility).toBe("ineligible");

			firstSequenceStarterState.rearmForSession();

			expect(firstSequenceStarterState.eligibility).toBe("eligible");
			expect(firstSequenceStarterState.sessionRearm).toBe(true);
			expect(firstSequenceStarterState.isEligible).toBe(true);
			expect(mocks.dexieCount).toHaveBeenCalledTimes(1);
		});
	});
});

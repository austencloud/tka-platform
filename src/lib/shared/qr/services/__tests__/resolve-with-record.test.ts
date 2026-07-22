import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mock surface as resolve-for-import: Firestore and app-firebase are the
// only network the record fetch touches, so tests control every record shape.
const getDocMock = vi.fn();
vi.mock("firebase/firestore", () => ({
	addDoc: vi.fn(),
	collection: vi.fn(),
	doc: vi.fn((_db: unknown, path: string) => ({ path })),
	getDoc: (ref: unknown) => getDocMock(ref),
	query: vi.fn(),
	where: vi.fn(),
	getDocs: vi.fn(),
	updateDoc: vi.fn(),
	increment: vi.fn(),
	runTransaction: vi.fn(),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
	getFirestoreInstance: vi.fn(async () => ({})),
}));
vi.mock("$lib/shared/navigation/services/sequence-encoder", () => ({
	encodeSequenceForQR: vi.fn(),
	isInlineEncoded: (s: string) => s.startsWith("s~"),
	decodeSequenceFromQR: vi.fn(async (payload: string) => ({
		id: "",
		word: `decoded:${payload}`,
		steps: [{ id: "step1" }],
	})),
}));

import { ShortCodeManager } from "../short-code-manager";

function makeManager(record: Record<string, unknown> | null) {
	const browseLoader = { loadFullSequenceData: vi.fn(async () => null) };
	const manager = new ShortCodeManager(browseLoader as never, undefined, {
		get: vi.fn(async () => null),
		getMany: vi.fn(async () => new Map()),
		set: vi.fn(),
	} as never);
	getDocMock.mockImplementation(async () =>
		record ? { exists: () => true, data: () => record } : { exists: () => false },
	);
	return manager;
}

beforeEach(() => {
	getDocMock.mockReset();
	// The static-snapshot fallback fetches real URLs — force it to miss.
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: false, status: 404 })),
	);
});

describe("resolveShortCodeWithRecord", () => {
	it("hands back the deck attribution the scan page needs", async () => {
		// The whole point: deck_id was structurally null on every scan ever
		// recorded because the client discarded this record and leaned on SSR
		// meta, which never populated on workerd.
		const manager = makeManager({
			sequence: "KAKA",
			encoded: "s~blob",
			deckId: "deck-loop-01",
			deckName: "LOOP Deck One",
		});
		const { sequence, record } = await manager.resolveShortCodeWithRecord("AB3D");
		expect(sequence?.id).toBe("AB3D");
		expect(sequence?.word).toBe("KAKA");
		expect(record?.deckId).toBe("deck-loop-01");
		expect(record?.deckName).toBe("LOOP Deck One");
	});

	it("returns a null record for an inline-encoded code (no doc exists)", async () => {
		const manager = makeManager(null);
		const { sequence, record } = await manager.resolveShortCodeWithRecord("s~blob");
		expect(sequence?.word).toBe("decoded:s~blob");
		expect(record).toBeNull();
	});

	it("still returns the record when hydration fails, so the scan is attributable", async () => {
		// No `encoded`, no `sequenceData`, no public hit — every hydrate
		// strategy misses, but the card still came from a known deck.
		const manager = makeManager({ sequence: "KAKA", deckId: "deck-loop-01" });
		const { sequence, record } = await manager.resolveShortCodeWithRecord("AB3D");
		expect(sequence).toBeNull();
		expect(record?.deckId).toBe("deck-loop-01");
	});

	it("keeps resolveShortCode returning the bare sequence for existing callers", async () => {
		const manager = makeManager({ sequence: "KAKA", encoded: "s~blob" });
		const sequence = await manager.resolveShortCode("AB3D");
		expect(sequence?.id).toBe("AB3D");
	});
});

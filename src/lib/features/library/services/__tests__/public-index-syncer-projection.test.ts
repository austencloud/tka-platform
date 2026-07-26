/**
 * PublicIndexSyncer × projection builder — the Phase 1.5 rewiring.
 *
 * `syncToPublicIndex` no longer assembles the public document by hand; it
 * normalizes, reads the prior public document, and writes what
 * `buildPublicSequenceProjection` returns. These tests pin the wiring at the
 * seam Firestore sees:
 *
 *   - a first publication stamps `publishedAt` once and seeds counters
 *   - a resync PRESERVES `publishedAt` and the engagement counters — the
 *     corpus-wide defect (`publishedAt: serverTimestamp()` on every setDoc)
 *     must be unreproducible through this path
 *   - a failed read of the prior document ABORTS the publish; it is never
 *     treated as a first publication
 *   - normalizer refusals (incomplete word) throw BEFORE any Firestore access
 *   - a failed tag read fails the publish (spec section 5)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const SERVER_TS = { __serverTimestamp: true } as const;

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  setDoc: mocks.setDoc,
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => SERVER_TS),
  query: vi.fn((target: { path?: string }) => ({ __query: true, target })),
  where: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));
vi.mock("$lib/shared/application/get-error-handler", () => ({
  getErrorHandler: vi.fn(() => ({ showUserError: vi.fn() })),
}));
vi.mock("$lib/shared/sequence-viewer/get-public-sequence-hash-matcher", () => ({
  getPublicSequenceHashMatcher: vi.fn(() => ({
    computeEncoderHash: vi.fn(async () => "encoder-hash-test"),
  })),
}));

import { PublicIndexSyncer } from "../public-index-syncer";
import { IncompleteWordError } from "$lib/shared/foundation/services/word-deriver";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CYCLE: readonly GridLocation[] = [
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
];

function motionAt(from: GridLocation, to: GridLocation, color: MotionColor) {
  return createMotionData({
    motionType: MotionType.PRO,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: from,
    endLocation: to,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    turns: 0,
    propType: PropType.STAFF,
    color,
  });
}

function makeStep(index: number, letter: string | null): StepData {
  return {
    id: `step-${index + 1}`,
    stepNumber: index + 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    letter: letter as StepData["letter"],
    startPosition: null,
    endPosition: null,
    motions: {
      blue: motionAt(
        CYCLE[index % 4] as GridLocation,
        CYCLE[(index + 1) % 4] as GridLocation,
        MotionColor.BLUE
      ),
      red: motionAt(
        CYCLE[(index + 2) % 4] as GridLocation,
        CYCLE[(index + 3) % 4] as GridLocation,
        MotionColor.RED
      ),
    },
  };
}

function makeSequence(word = "ABCD", overrides: Partial<LibrarySequence> = {}) {
  return {
    ...createSequenceData({
      id: "seq-1",
      name: "Assemble Sequence",
      word: "Assemble Sequence",
      steps: word.split("").map((letter, i) => makeStep(i, letter)),
      // Short-circuits detectLoopInfo at layer 1 so no loop-labels read runs.
      loopType: "rotated" as never,
      isCircular: true,
    }),
    forkCount: 7,
    viewCount: 11,
    starCount: 3,
    ...overrides,
  } as unknown as LibrarySequence;
}

/** Route getDoc by document path. */
function primeGetDoc(options: {
  publicDoc?: { exists: boolean; data?: Record<string, unknown> } | "fail";
}) {
  mocks.getDoc.mockImplementation(async (ref: { path: string }) => {
    if (ref.path.startsWith("publicSequences/")) {
      if (options.publicDoc === "fail") {
        throw new Error("prior-read unavailable");
      }
      const publicDoc = options.publicDoc ?? { exists: false };
      return {
        exists: () => publicDoc.exists,
        data: () => publicDoc.data ?? {},
      };
    }
    if (ref.path.startsWith("users/")) {
      return {
        exists: () => true,
        data: () => ({ displayName: "Austen", photoURL: "https://a.test/p.png" }),
      };
    }
    // loop-labels and anything else: absent.
    return { exists: () => false, data: () => ({}) };
  });
}

/** Route getDocs: tag collections resolve empty; the dedup query finds nothing. */
function primeGetDocs() {
  mocks.getDocs.mockImplementation(async (target: { path?: string }) => {
    if (target?.path?.includes("/tags")) {
      return { forEach: () => {} };
    }
    return { empty: true, docs: [] };
  });
}

/** The one write to publicSequences/… (artifact writes go elsewhere). */
function publicWrite(): Record<string, unknown> {
  const call = mocks.setDoc.mock.calls.find(([ref]) =>
    (ref as { path: string }).path.startsWith("publicSequences/")
  );
  expect(call).toBeDefined();
  return call![1] as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  primeGetDocs();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syncToPublicIndex — first publication", () => {
  it("writes the projection: derived word, canonical length, stamps, seeds", async () => {
    primeGetDoc({ publicDoc: { exists: false } });

    await new PublicIndexSyncer().syncToPublicIndex(makeSequence(), "owner-1");

    const written = publicWrite();
    // The derived word — never the "Assemble Sequence" auto-title the input
    // carries in BOTH its name and word fields.
    expect(written["word"]).toBe("ABCD");
    expect(written["name"]).toBe("Assemble Sequence");
    // Canonical count, not steps?.length ?? 0.
    expect(written["sequenceLength"]).toBe(4);
    // First publication: stamped now, counters seeded from the owner doc.
    expect(written["publishedAt"]).toBe(SERVER_TS);
    expect(written["forkCount"]).toBe(7);
    expect(written["viewCount"]).toBe(11);
    expect(written["starCount"]).toBe(3);
    expect(written["publicProjectionRevision"]).toBe(1);
    expect(written["publicProjectionSchemaVersion"]).toBe(2);
    expect(typeof written["publicProjectionDigest"]).toBe("string");
    expect(written["encoderHash"]).toBe("encoder-hash-test");
    expect(written["ownerDisplayName"]).toBe("Austen");
    // Self-containment payload present.
    expect(written["blueSoloProp"]).toBeTruthy();
    expect(written["redSoloProp"]).toBeTruthy();
    expect(written["stepPairings"]).toHaveLength(4);
    expect(written["startPosition"]).toBeTruthy();
  });
});

describe("syncToPublicIndex — resync over an existing document", () => {
  it("preserves publishedAt and the engagement counters", async () => {
    const originalPublishedAt = { seconds: 1_700_000_000, nanoseconds: 0 };
    primeGetDoc({
      publicDoc: {
        exists: true,
        data: {
          publishedAt: originalPublishedAt,
          forkCount: 42,
          viewCount: 9000,
          starCount: 17,
          publicProjectionRevision: 3,
          publicProjectionDigest: "stale-digest-from-a-previous-write",
        },
      },
    });

    await new PublicIndexSyncer().syncToPublicIndex(makeSequence(), "owner-1");

    const written = publicWrite();
    // The defect this wiring ends: publishedAt survives the republish.
    expect(written["publishedAt"]).toBe(originalPublishedAt);
    expect(written["publishedAt"]).not.toBe(SERVER_TS);
    // Public-owned counters win over the owner document's stale counts.
    expect(written["forkCount"]).toBe(42);
    expect(written["viewCount"]).toBe(9000);
    expect(written["starCount"]).toBe(17);
    // Content differs from the stale digest, so the revision advances.
    expect(written["publicProjectionRevision"]).toBe(4);
  });

  it("aborts the publish when the prior-document read fails", async () => {
    primeGetDoc({ publicDoc: "fail" });

    await expect(
      new PublicIndexSyncer().syncToPublicIndex(makeSequence(), "owner-1")
    ).rejects.toThrow("prior-read unavailable");

    // Nothing written: a failed read is never treated as a first publication.
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});

describe("syncToPublicIndex — refusals fire before Firestore", () => {
  it("rejects an incomplete word without any read or write", async () => {
    const sequence = makeSequence("ABCD", {
      steps: "ABCD"
        .split("")
        .map((l, i) => makeStep(i, i === 2 ? null : l)),
    } as Partial<LibrarySequence>);

    await expect(
      new PublicIndexSyncer().syncToPublicIndex(sequence, "owner-1")
    ).rejects.toBeInstanceOf(IncompleteWordError);

    expect(mocks.getDoc).not.toHaveBeenCalled();
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("fails the publish when the tag read fails, before the document write", async () => {
    primeGetDoc({ publicDoc: { exists: false } });
    mocks.getDocs.mockImplementation(async (target: { path?: string }) => {
      if (target?.path?.includes("/tags")) throw new Error("offline");
      return { empty: true, docs: [] };
    });
    const sequence = makeSequence("ABCD", {
      tagIds: ["t-fire"],
    } as Partial<LibrarySequence>);

    await expect(
      new PublicIndexSyncer().syncToPublicIndex(sequence, "owner-1")
    ).rejects.toThrow(/tag read failed/);

    expect(mocks.setDoc).not.toHaveBeenCalled();
  });
});

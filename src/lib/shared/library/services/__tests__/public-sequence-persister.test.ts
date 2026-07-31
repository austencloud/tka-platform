/**
 * public-sequence-persister — the transaction shapes the syncer tests don't
 * reach: unpublish (doc + claim + owner stamps together), the narrow thumbnail
 * patch (digest/revision restamp without renormalizing), and stale-claim
 * release when a republish changes the content hash.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const SERVER_TS = { __serverTimestamp: true } as const;
const DELETE_FIELD = { __deleteField: true } as const;

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  serverTimestamp: vi.fn(() => SERVER_TS),
  deleteField: vi.fn(() => DELETE_FIELD),
  runTransaction: vi.fn(
    async (
      _db: unknown,
      fn: (tx: unknown) => Promise<unknown>
    ): Promise<unknown> =>
      fn({
        get: (ref: unknown) => mocks.getDoc(ref),
        set: (ref: unknown, data: unknown) => void mocks.setDoc(ref, data),
        update: (ref: unknown, data: unknown) =>
          void mocks.updateDoc(ref, data),
        delete: (ref: unknown) => void mocks.deleteDoc(ref),
      })
  ),
}));

import {
  unpublishPublicSequence,
  updatePublicThumbnails,
  publicSequenceClaimId,
  deleteSequenceCompletely,
  softDeleteSequenceEverywhere,
} from "../public-sequence-persister";
import { computeStoredProjectionDigest } from "../public-sequence-projection";

type Doc = { exists: boolean; data?: Record<string, unknown> };

function primeDocs(byPath: Record<string, Doc>) {
  mocks.getDoc.mockImplementation(async (ref: { path: string }) => {
    const entry = byPath[ref.path] ?? { exists: false };
    return { exists: () => entry.exists, data: () => entry.data ?? {} };
  });
}

const FIRESTORE = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("unpublishPublicSequence", () => {
  it("removes doc, owned claim, and owner stamps in one transaction", async () => {
    primeDocs({
      "publicSequences/seq-1": {
        exists: true,
        data: {
          ownerId: "owner-1",
          contentHash: "h".repeat(64),
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, "h".repeat(64))}`]: {
        exists: true,
        data: { sequenceId: "seq-1", ownerId: "owner-1" },
      },
      "users/owner-1/sequences/seq-1": { exists: true, data: {} },
    });

    const result = await unpublishPublicSequence(FIRESTORE, "seq-1");

    expect(result.status).toBe("unpublished");
    const deleted = mocks.deleteDoc.mock.calls.map(
      ([ref]) => (ref as { path: string }).path
    );
    expect(deleted).toContain("publicSequences/seq-1");
    expect(deleted).toContain(
      `publicSequenceHashes/${publicSequenceClaimId(2, "h".repeat(64))}`
    );
    const [ownerRef, stamps] = mocks.updateDoc.mock.calls[0]!;
    expect((ownerRef as { path: string }).path).toBe(
      "users/owner-1/sequences/seq-1"
    );
    expect(stamps).toEqual({
      publicProjectionRevision: DELETE_FIELD,
      publicProjectionSchemaVersion: DELETE_FIELD,
      publicProjectionDigest: DELETE_FIELD,
    });
  });

  it("never deletes a claim owned by a DIFFERENT sequence", async () => {
    // Two docs can reference the same hash pair only during a legacy-era
    // duplicate. Unpublishing the loser must not release the winner's claim.
    primeDocs({
      "publicSequences/seq-loser": {
        exists: true,
        data: {
          ownerId: "owner-1",
          contentHash: "h".repeat(64),
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, "h".repeat(64))}`]: {
        exists: true,
        data: { sequenceId: "seq-winner", ownerId: "owner-2" },
      },
    });

    await unpublishPublicSequence(FIRESTORE, "seq-loser");

    const deleted = mocks.deleteDoc.mock.calls.map(
      ([ref]) => (ref as { path: string }).path
    );
    expect(deleted).toEqual(["publicSequences/seq-loser"]);
  });

  it("treats an absent mirror as success with no writes", async () => {
    primeDocs({});
    const result = await unpublishPublicSequence(FIRESTORE, "seq-gone");
    expect(result.status).toBe("absent");
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
});

describe("updatePublicThumbnails", () => {
  const storedSchemaTwo = (): Record<string, unknown> => ({
    id: "seq-1",
    ownerId: "owner-1",
    word: "ABCD",
    thumbnails: ["old.png"],
    contentHash: "h".repeat(64),
    contentHashVersion: 2,
    publicProjectionSchemaVersion: 2,
    publicProjectionRevision: 3,
    publicProjectionDigest: "stale-digest",
    forkCount: 1,
  });

  it("restamps digest and revision on a schema-2 document and mirrors the owner", async () => {
    const stored = storedSchemaTwo();
    primeDocs({
      "publicSequences/seq-1": { exists: true, data: stored },
      [`publicSequenceHashes/${publicSequenceClaimId(2, "h".repeat(64))}`]: {
        exists: true,
        data: { sequenceId: "seq-1" },
      },
      "users/owner-1/sequences/seq-1": { exists: true, data: {} },
    });

    const result = await updatePublicThumbnails(FIRESTORE, "seq-1", [
      "new-1.png",
      "new-2.png",
      "new-3.png",
      "overflow.png",
    ]);

    expect(result.status).toBe("updated");
    const publicPatch = mocks.updateDoc.mock.calls.find(
      ([ref]) => (ref as { path: string }).path === "publicSequences/seq-1"
    )![1] as Record<string, unknown>;

    // Capped at the public preview limit.
    expect(publicPatch["thumbnails"]).toEqual([
      "new-1.png",
      "new-2.png",
      "new-3.png",
    ]);
    // The digest describes the PATCHED stored document, not the stale one.
    const expectedDigest = await computeStoredProjectionDigest({
      ...stored,
      thumbnails: ["new-1.png", "new-2.png", "new-3.png"],
    });
    expect(publicPatch["publicProjectionDigest"]).toBe(expectedDigest);
    expect(publicPatch["publicProjectionRevision"]).toBe(4);

    // Owner stamps move in the same transaction.
    const ownerPatch = mocks.updateDoc.mock.calls.find(
      ([ref]) =>
        (ref as { path: string }).path === "users/owner-1/sequences/seq-1"
    )![1] as Record<string, unknown>;
    expect(ownerPatch["publicProjectionDigest"]).toBe(expectedDigest);
    expect(ownerPatch["publicProjectionRevision"]).toBe(4);
  });

  it("self-heals a schema-2 document that predates the claim collection", async () => {
    primeDocs({
      "publicSequences/seq-1": { exists: true, data: storedSchemaTwo() },
      // No claim doc primed → absent.
      "users/owner-1/sequences/seq-1": { exists: true, data: {} },
    });

    await updatePublicThumbnails(FIRESTORE, "seq-1", ["t.png"]);

    const claim = mocks.setDoc.mock.calls.find(([ref]) =>
      (ref as { path: string }).path.startsWith("publicSequenceHashes/")
    );
    expect(claim).toBeDefined();
    expect((claim![1] as Record<string, unknown>)["sequenceId"]).toBe("seq-1");
  });

  it("applies a plain patch to a legacy document — no stamps to maintain", async () => {
    primeDocs({
      "publicSequences/seq-legacy": {
        exists: true,
        data: { ownerId: "owner-1", thumbnails: [] },
      },
    });

    await updatePublicThumbnails(FIRESTORE, "seq-legacy", ["t.png"]);

    const patch = mocks.updateDoc.mock.calls[0]![1] as Record<string, unknown>;
    expect(patch).toEqual({ thumbnails: ["t.png"], updatedAt: SERVER_TS });
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it("reports an absent document instead of throwing NOT_FOUND", async () => {
    primeDocs({});
    const result = await updatePublicThumbnails(FIRESTORE, "seq-gone", [
      "t.png",
    ]);
    expect(result.status).toBe("absent");
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
});

describe("deleteSequenceCompletely", () => {
  const HASH_A = "a".repeat(64);
  const HASH_B = "b".repeat(64);

  it("deletes owner, mirror, and claim in one transaction", async () => {
    primeDocs({
      "users/owner-1/sequences/seq-1": {
        exists: true,
        data: { contentHash: HASH_A, contentHashVersion: 2 },
      },
      "publicSequences/seq-1": {
        exists: true,
        data: {
          ownerId: "owner-1",
          contentHash: HASH_A,
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`]: {
        exists: true,
        data: { sequenceId: "seq-1", ownerId: "owner-1" },
      },
    });

    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "seq-1"
    );

    expect(result).toEqual({
      ownerDeleted: true,
      publicDeleted: true,
      claimsDeleted: 1,
      collectionsUpdated: 0,
    });
    const deleted = mocks.deleteDoc.mock.calls.map(
      ([ref]) => (ref as { path: string }).path
    );
    expect(deleted).toContain("users/owner-1/sequences/seq-1");
    expect(deleted).toContain("publicSequences/seq-1");
    expect(deleted).toContain(
      `publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`
    );
  });

  it("releases BOTH owned claims when a stale mirror and the owner disagree on hash", async () => {
    primeDocs({
      "users/owner-1/sequences/seq-1": {
        exists: true,
        data: { contentHash: HASH_B, contentHashVersion: 2 },
      },
      "publicSequences/seq-1": {
        exists: true,
        data: {
          ownerId: "owner-1",
          contentHash: HASH_A,
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`]: {
        exists: true,
        data: { sequenceId: "seq-1", ownerId: "owner-1" },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_B)}`]: {
        exists: true,
        data: { sequenceId: "seq-1", ownerId: "owner-1" },
      },
    });

    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "seq-1"
    );

    expect(result.claimsDeleted).toBe(2);
  });

  it("never releases a claim held by a different sequence", async () => {
    primeDocs({
      "users/owner-1/sequences/seq-loser": {
        exists: true,
        data: { contentHash: HASH_A, contentHashVersion: 2 },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`]: {
        exists: true,
        data: { sequenceId: "seq-winner", ownerId: "owner-2" },
      },
    });

    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "seq-loser"
    );

    expect(result.claimsDeleted).toBe(0);
    const deleted = mocks.deleteDoc.mock.calls.map(
      ([ref]) => (ref as { path: string }).path
    );
    expect(deleted).toEqual(["users/owner-1/sequences/seq-loser"]);
  });

  it("reports an already-gone sequence without writing anything", async () => {
    primeDocs({});
    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "seq-gone"
    );
    expect(result).toEqual({
      ownerDeleted: false,
      publicDeleted: false,
      claimsDeleted: 0,
      collectionsUpdated: 0,
    });
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it("removes an owned public orphan when the owner document is already gone", async () => {
    primeDocs({
      "publicSequences/seq-orphan": {
        exists: true,
        data: {
          ownerId: "owner-1",
          contentHash: HASH_A,
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`]: {
        exists: true,
        data: { sequenceId: "seq-orphan", ownerId: "owner-1" },
      },
    });

    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "seq-orphan"
    );

    expect(result).toEqual({
      ownerDeleted: false,
      publicDeleted: true,
      claimsDeleted: 1,
      collectionsUpdated: 0,
    });
    expect(
      mocks.deleteDoc.mock.calls.map(([ref]) => (ref as { path: string }).path)
    ).toEqual([
      "publicSequences/seq-orphan",
      `publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`,
    ]);
  });

  it("never touches a public document or claim owned by another user", async () => {
    primeDocs({
      "publicSequences/shared-id": {
        exists: true,
        data: {
          ownerId: "owner-2",
          contentHash: HASH_A,
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`]: {
        exists: true,
        data: { sequenceId: "shared-id", ownerId: "owner-2" },
      },
    });

    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "shared-id"
    );

    expect(result).toEqual({
      ownerDeleted: false,
      publicDeleted: false,
      claimsDeleted: 0,
      collectionsUpdated: 0,
    });
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });

  it("removes the deleted id from each owning collection in the same transaction", async () => {
    primeDocs({
      "users/owner-1/sequences/seq-1": {
        exists: true,
        data: { collectionIds: ["collection-1"] },
      },
      "users/owner-1/collections/collection-1": {
        exists: true,
        data: { sequenceIds: ["seq-1", "seq-2"], sequenceCount: 2 },
      },
    });

    const result = await deleteSequenceCompletely(
      FIRESTORE,
      "owner-1",
      "seq-1"
    );

    expect(result.collectionsUpdated).toBe(1);
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      { path: "users/owner-1/collections/collection-1" },
      {
        sequenceIds: ["seq-2"],
        sequenceCount: 1,
        updatedAt: SERVER_TS,
      }
    );
  });
});

describe("softDeleteSequenceEverywhere", () => {
  const HASH_A = "a".repeat(64);

  it("marks the owner, clears its stamps, and removes mirror + claim atomically", async () => {
    primeDocs({
      "users/owner-1/sequences/seq-1": {
        exists: true,
        data: { contentHash: HASH_A, contentHashVersion: 2 },
      },
      "publicSequences/seq-1": {
        exists: true,
        data: {
          ownerId: "owner-1",
          contentHash: HASH_A,
          contentHashVersion: 2,
        },
      },
      [`publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`]: {
        exists: true,
        data: { sequenceId: "seq-1" },
      },
    });

    const result = await softDeleteSequenceEverywhere(
      FIRESTORE,
      "owner-1",
      "seq-1"
    );

    expect(result).toEqual({ status: "soft-deleted", publicRemoved: true });
    const [ownerRef, mark] = mocks.updateDoc.mock.calls[0]!;
    expect((ownerRef as { path: string }).path).toBe(
      "users/owner-1/sequences/seq-1"
    );
    expect(mark).toEqual({
      isDeleted: true,
      deletedAt: SERVER_TS,
      updatedAt: SERVER_TS,
      publicProjectionRevision: DELETE_FIELD,
      publicProjectionSchemaVersion: DELETE_FIELD,
      publicProjectionDigest: DELETE_FIELD,
    });
    const deleted = mocks.deleteDoc.mock.calls.map(
      ([ref]) => (ref as { path: string }).path
    );
    expect(deleted).toContain("publicSequences/seq-1");
    expect(deleted).toContain(
      `publicSequenceHashes/${publicSequenceClaimId(2, HASH_A)}`
    );
  });

  it("soft-deletes a private sequence with no public presence", async () => {
    primeDocs({
      "users/owner-1/sequences/seq-private": { exists: true, data: {} },
    });

    const result = await softDeleteSequenceEverywhere(
      FIRESTORE,
      "owner-1",
      "seq-private"
    );

    expect(result).toEqual({ status: "soft-deleted", publicRemoved: false });
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
    expect(mocks.updateDoc).toHaveBeenCalledTimes(1);
  });

  it("reports a missing owner without writing", async () => {
    primeDocs({});
    const result = await softDeleteSequenceEverywhere(
      FIRESTORE,
      "owner-1",
      "seq-gone"
    );
    expect(result).toEqual({ status: "owner-missing" });
    expect(mocks.updateDoc).not.toHaveBeenCalled();
    expect(mocks.deleteDoc).not.toHaveBeenCalled();
  });
});

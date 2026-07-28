import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting a batch used to be one writeBatch carrying every document plus the
 * profile counter. It is now one transaction PER sequence — owner doc, public
 * mirror and hash claims move together, so a mid-batch failure can never
 * strand a public document whose owner is gone — followed by a single
 * aggregate decrement.
 *
 * The counter is deliberately outside those transactions: it is a denormalized
 * display value, and folding it in would put N concurrent transactions in
 * contention on the same users/{uid} document. What this file guards is that
 * split: every stored sequence gets its own transaction, the counter moves once
 * by the number of owner docs actually deleted, and a counter failure does not
 * mask deletes that committed.
 */
const firestoreMocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  updateDoc: vi.fn(async () => undefined),
  deleteSequenceCompletely: vi.fn(),
  notifyLibraryMutated: vi.fn(),
  toastWarning: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  doc: vi.fn((_db: unknown, path: string) => ({ path })),
  getDocs: firestoreMocks.getDocs,
  query: vi.fn((value: unknown) => value),
  where: vi.fn(),
  writeBatch: vi.fn(),
  updateDoc: firestoreMocks.updateDoc,
  serverTimestamp: vi.fn(() => "server-timestamp"),
  increment: vi.fn((value: number) => ({ incrementBy: value })),
  arrayUnion: vi.fn(),
  documentId: vi.fn(() => "document-id"),
}));

vi.mock("$lib/shared/library/services/public-sequence-persister", () => ({
  deleteSequenceCompletely: firestoreMocks.deleteSequenceCompletely,
}));
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { error: vi.fn(), warning: firestoreMocks.toastWarning },
}));
vi.mock("$lib/shared/offline/state/sync-status-state.svelte", () => ({
  trackWrite: (operation: () => Promise<unknown>) => operation(),
}));
vi.mock("$lib/shared/foundation/services/sequence-hydrator", () => ({
  ensureComposition: (sequence: unknown) => sequence,
}));
vi.mock("$lib/shared/library/library-events", () => ({
  notifyLibraryMutated: firestoreMocks.notifyLibraryMutated,
}));

import { LibraryBatchOperations } from "$lib/shared/library/services/library-batch-operations";

function makeOperations() {
  const reportError = vi.fn();
  const operations = new LibraryBatchOperations(
    async () => ({}) as never,
    () => "user-1",
    (data, id) => ({ ...data, id }) as never,
    {
      syncToPublicIndex: vi.fn(),
      updateThumbnails: vi.fn(),
      removeFromPublicIndex: vi.fn(),
    },
    reportError
  );
  return { operations, reportError };
}

describe("LibraryBatchOperations delete counter integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.updateDoc.mockResolvedValue(undefined);
    firestoreMocks.deleteSequenceCompletely.mockResolvedValue({
      ownerDeleted: true,
    });
    // "already-missing" is absent from this snapshot, so it never reaches a
    // transaction and never counts against the profile total.
    firestoreMocks.getDocs.mockResolvedValue({
      docs: [
        { id: "private-1", data: () => ({ visibility: "private" }) },
        { id: "public-1", data: () => ({ visibility: "public" }) },
      ],
    });
  });

  it("gives each stored sequence its own transaction and skips ones already gone", async () => {
    const results = await makeOperations().operations.deleteSequences([
      "private-1",
      "public-1",
      "already-missing",
    ]);

    expect(
      firestoreMocks.deleteSequenceCompletely.mock.calls.map((call) => call[2])
    ).toEqual(["private-1", "public-1"]);
    expect(results).toEqual([
      { sequenceId: "private-1", status: "ok" },
      { sequenceId: "public-1", status: "ok" },
    ]);
  });

  it("decrements the profile count once, by the owner docs actually deleted", async () => {
    await makeOperations().operations.deleteSequences([
      "private-1",
      "public-1",
      "already-missing",
    ]);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledOnce();
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        sequenceCount: { incrementBy: -2 },
        lastActivityDate: "server-timestamp",
      }
    );
  });

  it("counts only the transactions that reported an owner document", async () => {
    firestoreMocks.deleteSequenceCompletely
      .mockResolvedValueOnce({ ownerDeleted: true })
      .mockResolvedValueOnce({ ownerDeleted: false });

    await makeOperations().operations.deleteSequences(["private-1", "public-1"]);

    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1" },
      expect.objectContaining({ sequenceCount: { incrementBy: -1 } })
    );
  });

  it("keeps the deletes when the counter write fails", async () => {
    firestoreMocks.updateDoc.mockRejectedValue(new Error("counter offline"));
    const { operations, reportError } = makeOperations();

    const results = await operations.deleteSequences(["private-1", "public-1"]);

    expect(results.every((result) => result.status === "ok")).toBe(true);
    // Surfaced as a warning, not an error — the deletes did commit.
    expect(reportError).toHaveBeenCalledWith(
      expect.stringContaining("profile count"),
      expect.anything(),
      "delete-sequences-profile-count",
      expect.anything(),
      "warning"
    );
  });

  it("reports a failed sequence instead of silently dropping it", async () => {
    firestoreMocks.deleteSequenceCompletely
      .mockResolvedValueOnce({ ownerDeleted: true })
      .mockRejectedValueOnce(new Error("transaction aborted"));

    await expect(
      makeOperations().operations.deleteSequences(["private-1", "public-1"])
    ).rejects.toThrow("Failed to delete sequences");

    // The one that committed still decremented the counter.
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1" },
      expect.objectContaining({ sequenceCount: { incrementBy: -1 } })
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const dbPutMock = vi.fn();
const dbGetMock = vi.fn().mockResolvedValue(undefined);
const dbCountMock = vi.fn().mockResolvedValue(0);

vi.mock("$lib/shared/persistence/database/tka-database", () => ({
  db: { sequences: { put: (...a: unknown[]) => dbPutMock(...a), get: (...a: unknown[]) => dbGetMock(...a), count: (...a: unknown[]) => dbCountMock(...a) } },
}));
vi.mock("$lib/shared/auth/state/auth-state.svelte", () => ({
  authState: { isAuthenticated: true, isAnonymous: false, user: { displayName: "Test", uid: "u1" }, effectiveUserId: "u1" },
}));
vi.mock("$lib/shared/auth/services/guest-identity", () => ({ ensureGuestIdentity: vi.fn().mockResolvedValue(undefined) }));
vi.mock("$lib/shared/auth/state/auth-ui-state.svelte", () => ({ openAuthDialog: vi.fn() }));
vi.mock("$lib/shared/toast/state/toast-state.svelte.ts", () => ({ toast: { info: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("$lib/shared/application/get-error-handler", () => ({ getErrorHandler: () => ({ showUserError: vi.fn() }) }));
vi.mock("$lib/shared/render/services/warm-sequence-cells", () => ({ warmSequenceCells: vi.fn().mockResolvedValue(undefined) }));
vi.mock("$lib/shared/share/state/image-composition-state.svelte.ts", () => ({ getImageCompositionManager: () => ({ darkMode: true }) }));
vi.mock("$lib/features/library/services/tag-manager", () => ({ findTagByName: vi.fn().mockResolvedValue(undefined), createUserTag: vi.fn().mockResolvedValue(undefined) }));
vi.mock("$lib/shared/library/services/sequence-content-hasher", () => ({ computeHash: vi.fn().mockResolvedValue("hash-1") }));
vi.mock("$lib/features/library/services/library-sync-retry", () => ({ markSequenceSyncStatus: vi.fn().mockResolvedValue(undefined) }));
// Keep the real, Firestore-touching library-state module out of the test: the
// service's refreshLibraryState() dynamic-imports it after a successful save.
vi.mock("$lib/features/library/state/library-state.svelte", () => ({ libraryState: { loadSequences: vi.fn().mockResolvedValue(undefined) } }));

const { LibrarySaveService } = await import("$lib/features/library/services/library-save-service");
const { LibraryError } = await import("$lib/shared/library/domain/library-error");
const { authState } = await import("$lib/shared/auth/state/auth-state.svelte");

function makeSequence(o: Record<string, unknown> = {}) { return { id: "seq-1", steps: [{ letter: "A" }], thumbnails: [], ...o } as any; }
function makeOptions() { return { name: "A", visibility: "private" as const, tags: [], notes: "" }; }
function makeRepository(o: Record<string, unknown> = {}) { return { hasMatchingContent: vi.fn().mockResolvedValue(false), saveSequenceWithMetadata: vi.fn().mockResolvedValue({}) , ...o } as any; }

describe("LibrarySaveService.saveSequence - durable-save contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbGetMock.mockResolvedValue(undefined);
    dbCountMock.mockResolvedValue(0);
    // clearAllMocks preserves implementations set here; restore full-account auth.
    (authState as any).isAuthenticated = true;
    (authState as any).isAnonymous = false;
  });

  it("rejects with LibraryError(PERSIST_FAILED) when the Dexie put fails", async () => {
    dbPutMock.mockRejectedValueOnce(new Error("quota"));
    const service = new LibrarySaveService(null, null, makeRepository(), null);
    await expect(service.saveSequence(makeSequence(), makeOptions())).rejects.toMatchObject({ code: "PERSIST_FAILED" });
    dbPutMock.mockRejectedValueOnce(new Error("quota"));
    await expect(service.saveSequence(makeSequence(), makeOptions())).rejects.toBeInstanceOf(LibraryError);
  });

  it("resolves with persisted:true and isGuest reflecting auth state on success", async () => {
    dbPutMock.mockResolvedValue(undefined);
    const service = new LibrarySaveService(null, null, makeRepository(), null);
    const result = await service.saveSequence(makeSequence(), makeOptions());
    expect(result.persisted).toBe(true);
    expect(result.isGuest).toBe(false);
    expect(result.sequenceId).toBe("seq-1");
  });

  it("writes the sequence to Dexie (db.sequences.put) so a guest library can read it back", async () => {
    dbPutMock.mockResolvedValue(undefined);
    // Anonymous guest: the durable Dexie write is exactly what makes the save
    // visible in the guest's Dexie-only library read (the SP1 fix). All four
    // migrated keep paths funnel through this saveSequence().
    (authState as any).isAuthenticated = false;
    (authState as any).isAnonymous = true;
    const service = new LibrarySaveService(null, null, makeRepository(), null);
    const result = await service.saveSequence(makeSequence(), makeOptions());
    expect(dbPutMock).toHaveBeenCalledTimes(1);
    const written = dbPutMock.mock.calls[0][0];
    expect(written).toMatchObject({ id: "seq-1", name: "A" });
    expect(result.isGuest).toBe(true);
    expect(result.persisted).toBe(true);
  });

  it("rejects with LibraryError(ALREADY_EXISTS) synchronously for a new duplicate, no Dexie write", async () => {
    dbPutMock.mockResolvedValue(undefined);
    dbGetMock.mockResolvedValue(undefined);
    const repository = makeRepository({ hasMatchingContent: vi.fn().mockResolvedValue(true) });
    const service = new LibrarySaveService(null, null, repository, null);
    await expect(service.saveSequence(makeSequence(), makeOptions())).rejects.toMatchObject({ code: "ALREADY_EXISTS" });
    expect(repository.hasMatchingContent).toHaveBeenCalled();
    expect(dbPutMock).not.toHaveBeenCalled();
  });
});

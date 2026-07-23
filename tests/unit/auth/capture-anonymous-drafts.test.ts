// Unit coverage for captureAnonymousDrafts (SP2 enabler).
//
// The load-bearing SP2 fix: draft capture reads LOCAL Dexie
// (dexiePersistence.getAllSequences), not Firestore. SP1 made Dexie
// authoritative for guest saves, so a just-saved guest sequence may never have
// reached Firestore — a Firestore-only capture would miss it and strand the
// sequence on account conversion. These assert the source is Dexie and that a
// read failure degrades to an empty array (never throws into the auth flow).

import { beforeEach, describe, expect, it, vi } from "vitest";

// Control the Dexie read that captureAnonymousDrafts depends on.
const dexieRef = vi.hoisted(() => ({ getAllSequences: vi.fn() }));
vi.mock("$lib/shared/persistence/services/dexie-persistence-service", () => ({
  getAllSequences: dexieRef.getAllSequences,
  getSequence: vi.fn(),
  saveSequence: vi.fn(),
}));

// Keep the real firebase SDK + HMR-heavy firebase module out of the graph.
vi.mock("firebase/auth", () => ({
  EmailAuthProvider: class {
    static credential = vi.fn();
  },
  FacebookAuthProvider: class {
    static credentialFromError = vi.fn();
  },
  GoogleAuthProvider: class {
    static credential = vi.fn();
    static credentialFromError = vi.fn();
  },
  linkWithCredential: vi.fn(),
  linkWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithEmailLink: vi.fn(),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getAuthInstance: async () => ({ currentUser: null }),
}));

import { captureAnonymousDrafts } from "$lib/shared/auth/services/anonymous-upgrade";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("captureAnonymousDrafts", () => {
  it("reads the guest's sequences from local Dexie, not Firestore", async () => {
    const localRows = [
      { id: "s1", word: "ABC" },
      { id: "s2", word: "DEF" },
    ];
    dexieRef.getAllSequences.mockResolvedValueOnce(localRows);

    const drafts = await captureAnonymousDrafts("anon-uid");

    expect(dexieRef.getAllSequences).toHaveBeenCalledTimes(1);
    expect(drafts).toEqual(localRows);
  });

  it("returns a Dexie-only (un-synced) sequence for a guest", async () => {
    // The row exists locally only — Firestore was never consulted, so this
    // proves the just-saved-but-unsynced case survives capture.
    dexieRef.getAllSequences.mockResolvedValueOnce([{ id: "fresh", word: "X" }]);

    const drafts = await captureAnonymousDrafts("anon-uid");

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ id: "fresh" });
  });

  it("degrades to an empty array when the Dexie read throws (never breaks the auth flow)", async () => {
    dexieRef.getAllSequences.mockRejectedValueOnce(new Error("db closed"));

    const drafts = await captureAnonymousDrafts("anon-uid");

    expect(drafts).toEqual([]);
  });
});

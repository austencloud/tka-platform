import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

const h = vi.hoisted(() => {
  const order: string[] = [];
  return {
    order,
    captureWhenReady: vi.fn((event: string) => {
      order.push(`event:${event}`);
    }),
    createOrUpdateUserDocument: vi.fn(async () => {
      order.push("profile");
    }),
    getAuthInstance: vi.fn(async () => {
      throw new Error("linked User should be authoritative");
    }),
    getIdToken: vi.fn(async () => {
      order.push("token");
      return "fresh-token";
    }),
    mergeGuestCollection: vi.fn(async () => undefined),
    toastSuccess: vi.fn(),
  };
});

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: class {},
  FacebookAuthProvider: class {},
  GoogleAuthProvider: class {},
  linkWithCredential: vi.fn(),
  linkWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithEmailLink: vi.fn(),
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getAuthInstance: h.getAuthInstance,
}));

vi.mock("$lib/shared/auth/services/pending-credential-link", () => ({
  stashPendingLink: vi.fn(),
}));

vi.mock("$lib/shared/auth/services/last-auth-method.svelte", () => ({
  recordLastAuthMethod: vi.fn(),
}));

vi.mock("$lib/shared/gamification/get-prop-unlock-manager", () => ({
  getPropUnlockManager: () => ({
    mergeGuestCollection: h.mergeGuestCollection,
  }),
}));

vi.mock("$lib/shared/library/get-library-repository", () => ({
  getLibraryRepository: vi.fn(),
}));

vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { success: h.toastSuccess },
}));

vi.mock("$lib/shared/analytics/services/posthog", () => ({
  captureWhenReady: h.captureWhenReady,
}));

vi.mock("$lib/shared/persistence/services/dexie-persistence-service", () => ({
  getAllSequences: vi.fn(async () => []),
}));

vi.mock("$lib/shared/library/services/saved-sequence-ledger", () => ({
  getSavedSequenceIds: vi.fn(() => []),
}));

vi.mock("$lib/shared/auth/get-user-document-manager", () => ({
  getUserDocumentManager: () => ({
    createOrUpdateUserDocument: h.createOrUpdateUserDocument,
  }),
}));

import { notifyUpgradeSignup } from "$lib/shared/auth/services/anonymous-upgrade";

beforeEach(() => {
  vi.clearAllMocks();
  h.order.length = 0;
});

describe("notifyUpgradeSignup", () => {
  it("finalizes the exact linked user before profile persistence and conversion capture", async () => {
    const linkedUser = {
      uid: "guest-upgraded-in-place",
      isAnonymous: false,
      getIdToken: h.getIdToken,
    } as unknown as User;

    await notifyUpgradeSignup(linkedUser);

    expect(h.getAuthInstance).not.toHaveBeenCalled();
    expect(h.getIdToken).toHaveBeenCalledWith(true);
    expect(h.createOrUpdateUserDocument).toHaveBeenCalledWith(linkedUser);
    expect(h.captureWhenReady).toHaveBeenCalledWith(
      "guest_upgraded_to_account",
      {
        status: "linked",
      }
    );
    expect(h.order).toEqual([
      "token",
      "profile",
      "event:guest_upgraded_to_account",
    ]);
  });
});

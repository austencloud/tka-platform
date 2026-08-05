import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

const h = vi.hoisted(() => ({
  claimUsername: vi.fn(async () => undefined),
  captureWhenReady: vi.fn(),
  collection: vi.fn((_firestore: unknown, ...segments: string[]) =>
    segments.join("/")
  ),
  doc: vi.fn((_firestore: unknown, path: string) => path),
  generateAvatarUrl: vi.fn(() => "generated-avatar"),
  generateUniqueUsername: vi.fn(async () => "matty"),
  getCountFromServer: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestoreInstance: vi.fn(async () => ({ name: "firestore" })),
  getProviderIds: vi.fn(() => ({
    googleId: null,
    facebookId: null,
  })),
  serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  setDoc: vi.fn(async () => undefined),
  reportErrorTelemetry: vi.fn(async () => undefined),
}));

vi.mock("firebase/firestore", () => ({
  collection: h.collection,
  doc: h.doc,
  getCountFromServer: h.getCountFromServer,
  getDoc: h.getDoc,
  getDocs: h.getDocs,
  serverTimestamp: h.serverTimestamp,
  setDoc: h.setDoc,
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: h.getFirestoreInstance,
}));

vi.mock("$lib/shared/auth/services/profile-picture-manager", () => ({
  getProviderIds: h.getProviderIds,
}));

vi.mock("$lib/shared/auth/services/username-validator", () => ({
  claimUsername: h.claimUsername,
  generateUniqueUsername: h.generateUniqueUsername,
}));

vi.mock("$lib/shared/foundation/utils/avatar-generator", () => ({
  generateAvatarUrl: h.generateAvatarUrl,
}));

vi.mock("$lib/shared/analytics/services/posthog", () => ({
  captureWhenReady: h.captureWhenReady,
}));

vi.mock("$lib/shared/error/services/error-telemetry-reporter", () => ({
  reportErrorTelemetry: h.reportErrorTelemetry,
}));

import { UserDocumentManager } from "$lib/shared/auth/services/user-document-manager";

function fullUser(): User {
  return {
    uid: "user-1",
    isAnonymous: false,
    displayName: "matty mover",
    email: "matty@example.com",
    photoURL: null,
    providerData: [],
    getIdToken: vi.fn(async () => "fresh-token"),
  } as unknown as User;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getDoc.mockResolvedValue({
    exists: () => false,
  });
  h.getCountFromServer.mockResolvedValue({
    data: () => ({ count: 7 }),
  });
  h.getDocs.mockResolvedValue({
    docs: [
      { data: () => ({ name: "Favorites", systemType: "favorites" }) },
      { data: () => ({ name: "Practice" }) },
      { data: () => ({ name: "Null system marker", systemType: null }) },
      { data: () => ({ name: "Showcase" }) },
    ],
  });
});

describe("UserDocumentManager parent reconstruction", () => {
  it("creates zeroed server-owned counters for the profile trigger to reconcile", async () => {
    const user = fullUser();

    await new UserDocumentManager().createOrUpdateUserDocument(user);

    expect(h.getCountFromServer).not.toHaveBeenCalled();
    expect(h.getDocs).not.toHaveBeenCalled();
    expect(h.setDoc).toHaveBeenCalledTimes(2);
    expect(h.setDoc.mock.calls[0][1]).toMatchObject({
      publicProfileVersion: 2,
      displayName: "Matty Mover",
      sequenceCount: 0,
      collectionCount: 0,
    });
    expect(h.claimUsername).toHaveBeenCalledWith("user-1", "matty");
    expect(h.captureWhenReady).toHaveBeenCalledWith(
      "profile_document_read_completed",
      expect.objectContaining({
        telemetry_schema_version: 2,
        telemetry_path_shape: "users/{id}",
      })
    );
  });

  it("reports an exact privacy-safe fingerprint when the profile read is denied", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = Object.assign(
      new Error("Missing or insufficient permissions"),
      {
        code: "permission-denied",
      }
    );
    h.getDoc.mockRejectedValue(error);

    await new UserDocumentManager().createOrUpdateUserDocument(fullUser());

    expect(h.getDoc).toHaveBeenCalledTimes(2);
    expect(h.reportErrorTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        error,
        context: {
          module: "firestore",
          action: "get",
          additionalData: { path: "users/user-1" },
        },
      })
    );
    expect(h.captureWhenReady).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not claim a full-account-only username for an anonymous guest", async () => {
    const user = {
      ...fullUser(),
      isAnonymous: true,
    } as User;

    await new UserDocumentManager().createOrUpdateUserDocument(user);

    // Local tests exercise the development guard, which skips anonymous
    // production-profile writes altogether.
    expect(h.setDoc).not.toHaveBeenCalled();
    expect(h.claimUsername).not.toHaveBeenCalled();
  });
});

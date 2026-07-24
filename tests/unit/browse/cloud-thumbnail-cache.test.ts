// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

const mocks = vi.hoisted(() => {
  const auth = {
    authStateReady: vi.fn(),
    currentUser: null as { uid: string } | null,
  };

  return {
    auth,
    getAuthInstance: vi.fn(),
    getStorageInstance: vi.fn(),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn(),
  };
});

vi.mock("$lib/shared/auth/firebase", () => ({
  getAuthInstance: mocks.getAuthInstance,
  getStorageInstance: mocks.getStorageInstance,
}));

vi.mock("firebase/storage", () => ({
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
  getDownloadURL: mocks.getDownloadURL,
}));

import {
  upload,
  type CloudThumbnailKey,
} from "$lib/shared/browse/services/cloud-thumbnail-cache";

const key: CloudThumbnailKey = {
  sequenceName: "AAAA",
  sequenceId: "sequence-1",
  propType: PropType.CLUB,
  lightMode: false,
  variant: "gallery",
};

beforeEach(() => {
  localStorage.clear();
  mocks.auth.currentUser = null;
  mocks.auth.authStateReady.mockResolvedValue(undefined);
  mocks.getAuthInstance.mockResolvedValue(mocks.auth);
  mocks.getStorageInstance.mockResolvedValue({ bucket: "test" });
  mocks.ref.mockReturnValue({ fullPath: "thumbnail.webp" });
  mocks.uploadBytes.mockResolvedValue({});
  mocks.getDownloadURL.mockResolvedValue("https://storage.test/thumbnail.webp");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("cloud-thumbnail-cache upload authorization", () => {
  it("does not send an upload when the settled auth state is signed out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await upload(
      { ...key, sequenceId: "signed-out" },
      new Blob(["thumbnail"], { type: "image/webp" })
    );

    expect(result).toBeNull();
    expect(mocks.auth.authStateReady).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getStorageInstance).not.toHaveBeenCalled();
    expect(mocks.uploadBytes).not.toHaveBeenCalled();
  });

  it("waits for restored auth before uploading a missing thumbnail", async () => {
    mocks.auth.authStateReady.mockImplementationOnce(async () => {
      mocks.auth.currentUser = { uid: "user-1" };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    const result = await upload(
      { ...key, sequenceId: "restored-user" },
      new Blob(["thumbnail"], { type: "image/webp" })
    );

    expect(result).toBe("https://storage.test/thumbnail.webp");
    expect(mocks.auth.authStateReady).toHaveBeenCalledOnce();
    expect(mocks.uploadBytes).toHaveBeenCalledOnce();
    expect(mocks.auth.authStateReady.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.uploadBytes.mock.invocationCallOrder[0]!
    );
  });
});

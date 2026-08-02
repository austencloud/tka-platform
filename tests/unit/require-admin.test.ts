import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireFirebaseUser: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("$lib/server/auth/requireFirebaseUser", () => ({
  requireFirebaseUser: mocks.requireFirebaseUser,
}));
vi.mock("$lib/server/firebaseAdmin", () => ({
  getAdminAuth: () => ({ getUser: mocks.getUser }),
}));

import { requireAdmin } from "$lib/server/auth/requireAdmin";

const event = {} as never;

describe("requireAdmin live authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFirebaseUser.mockResolvedValue({
      uid: "admin",
      authTime: 1_800_000_000,
      admin: true,
    });
    mocks.getUser.mockResolvedValue({
      uid: "admin",
      disabled: false,
      tokensValidAfterTime: "2026-01-01T00:00:00.000Z",
      customClaims: { admin: true, role: "admin" },
    });
  });

  it("accepts a valid enabled user with current live admin claims", async () => {
    await expect(requireAdmin(event)).resolves.toMatchObject({ uid: "admin" });
    expect(mocks.getUser).toHaveBeenCalledWith("admin");
  });

  it("rejects an Auth-disabled administrator", async () => {
    mocks.getUser.mockResolvedValue({
      uid: "admin",
      disabled: true,
      customClaims: { admin: true },
    });
    await expect(requireAdmin(event)).rejects.toMatchObject({ status: 403 });
  });

  it("rejects a token authenticated before tokensValidAfterTime", async () => {
    mocks.requireFirebaseUser.mockResolvedValue({
      uid: "admin",
      authTime: 1_700_000_000,
      admin: true,
    });
    mocks.getUser.mockResolvedValue({
      uid: "admin",
      disabled: false,
      tokensValidAfterTime: "2025-01-01T00:00:00.000Z",
      customClaims: { admin: true },
    });
    await expect(requireAdmin(event)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a token authenticated exactly at tokensValidAfterTime", async () => {
    mocks.requireFirebaseUser.mockResolvedValue({
      uid: "admin",
      authTime: 1_735_689_600,
    });
    mocks.getUser.mockResolvedValue({
      disabled: false,
      customClaims: { role: "admin" },
      tokensValidAfterTime: "2025-01-01T00:00:00.000Z",
    });

    await expect(requireAdmin(event)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a stale admin JWT after live claims are demoted", async () => {
    mocks.getUser.mockResolvedValue({
      uid: "admin",
      disabled: false,
      tokensValidAfterTime: "2026-01-01T00:00:00.000Z",
      customClaims: { role: "user", admin: false, isAdmin: false },
    });
    await expect(requireAdmin(event)).rejects.toMatchObject({ status: 403 });
  });
});

import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock Firebase BEFORE importing DeviceIdService
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getFirestore: vi.fn(() => ({ type: "firestore" })),
  serverTimestamp: vi.fn(() => ({ _type: "timestamp" })),
}));

import { DeviceIdService } from "$lib/shared/auth/services/implementations/DeviceIdService";

describe("DeviceIdService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("generates a UUID on first call and persists it", () => {
    const svc = new DeviceIdService();
    const id1 = svc.getDeviceId();
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem("tka:deviceId")).toBe(id1);
  });

  it("returns the same id on subsequent calls in the same session", () => {
    const svc = new DeviceIdService();
    const id1 = svc.getDeviceId();
    const id2 = svc.getDeviceId();
    expect(id1).toBe(id2);
  });

  it("returns the persisted id when constructed after a prior session", () => {
    localStorage.setItem("tka:deviceId", "00000000-0000-4000-8000-000000000001");
    const svc = new DeviceIdService();
    expect(svc.getDeviceId()).toBe("00000000-0000-4000-8000-000000000001");
  });
});

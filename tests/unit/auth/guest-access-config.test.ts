import { describe, it, expect } from "vitest";
import {
  isModuleAccessible,
  isTabAccessible,
  getAccessibleTabs,
} from "$lib/shared/auth/domain/guest-access-config";

describe("isModuleAccessible", () => {
  it("allows create for guests", () => {
    expect(isModuleAccessible("create", "guest")).toBe(true);
  });

  it("allows browse for guests", () => {
    expect(isModuleAccessible("browse", "guest")).toBe(true);
  });

  it("blocks learn for guests", () => {
    expect(isModuleAccessible("learn", "guest")).toBe(false);
  });

  it("blocks social for guests", () => {
    expect(isModuleAccessible("social", "guest")).toBe(false);
  });

  it("allows all modules for authenticated users", () => {
    expect(isModuleAccessible("learn", "user")).toBe(true);
    expect(isModuleAccessible("social", "user")).toBe(true);
    expect(isModuleAccessible("settings", "user")).toBe(true);
  });
});

describe("isTabAccessible", () => {
  it("allows construct tab in create for guests", () => {
    expect(isTabAccessible("create", "construct", "guest")).toBe(true);
  });

  it("allows gallery tab in browse for guests", () => {
    expect(isTabAccessible("browse", "gallery", "guest")).toBe(true);
  });

  it("blocks collections tab in browse for guests", () => {
    expect(isTabAccessible("browse", "collections", "guest")).toBe(false);
  });

  it("blocks creators tab in browse for guests", () => {
    expect(isTabAccessible("browse", "creators", "guest")).toBe(false);
  });
});

describe("getAccessibleTabs", () => {
  it("returns allowed tabs for guests in create", () => {
    expect(getAccessibleTabs("create", "guest")).toEqual([
      "assemble",
      "construct",
      "generate",
    ]);
  });

  it("returns null for authenticated users (no filtering)", () => {
    expect(getAccessibleTabs("create", "user")).toBeNull();
  });
});

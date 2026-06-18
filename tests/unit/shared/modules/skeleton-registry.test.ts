import { describe, it, expect } from "vitest";
import { resolveSkeleton, SHARED_SHELL } from "$lib/shared/modules/skeletons";
import BrowseSkeleton from "$lib/shared/modules/skeletons/BrowseSkeleton.svelte";
import SharedShellSkeleton from "$lib/shared/modules/skeletons/SharedShellSkeleton.svelte";

describe("resolveSkeleton", () => {
  it("falls back to the neutral loader for create (no bespoke skeleton — stateful layout)", () => {
    expect(resolveSkeleton("create")).toBe(SharedShellSkeleton);
  });
  it("returns the Browse skeleton for browse", () => {
    expect(resolveSkeleton("browse")).toBe(BrowseSkeleton);
  });
  it("falls back to the shared shell for an unknown module", () => {
    expect(resolveSkeleton("settings")).toBe(SharedShellSkeleton);
  });
  it("falls back to the shared shell for null", () => {
    expect(resolveSkeleton(null)).toBe(SharedShellSkeleton);
  });
  it("SHARED_SHELL is the shared shell component", () => {
    expect(SHARED_SHELL).toBe(SharedShellSkeleton);
  });
});

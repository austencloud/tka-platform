import { describe, it, expect } from "vitest";
import { computePoolSize } from "../composition-dispatcher";

describe("computePoolSize", () => {
  it("reserves one core", () => {
    expect(computePoolSize(8)).toBe(7);
  });
  it("caps at 8 on many-core machines", () => {
    expect(computePoolSize(32)).toBe(8);
  });
  it("accepts the development worker cap", () => {
    expect(computePoolSize(32, 2)).toBe(2);
  });
  it("floors at 2 on tiny machines", () => {
    expect(computePoolSize(1)).toBe(2);
    expect(computePoolSize(2)).toBe(2);
  });
  it("handles undefined hardwareConcurrency", () => {
    expect(computePoolSize(undefined)).toBe(3); // (4 default) - 1
  });
});

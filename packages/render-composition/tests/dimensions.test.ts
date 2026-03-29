import { describe, it, expect } from "vitest";
import { calculateHeaderHeight, calculateFooterHeight } from "../src/dimensions.js";

describe("dimensions", () => {
  it("header is 1/3 of step size", () => {
    expect(calculateHeaderHeight(900)).toBe(300);
    expect(calculateHeaderHeight(300)).toBe(100);
  });

  it("footer is 1/7 of step size", () => {
    expect(calculateFooterHeight(700)).toBe(100);
    expect(calculateFooterHeight(900)).toBe(128);
  });
});

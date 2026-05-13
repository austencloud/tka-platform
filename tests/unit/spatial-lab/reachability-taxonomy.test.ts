import { describe, it, expect } from "vitest";
import { diagnoseReachability } from "../../../src/lib/features/lab/tabs/spatial-lab/services/reachability-taxonomy";

const BODY = { x: 300, y: 330 };
const MAX_REACH = 165;
const SHOULDER_DIST = 34;
const BEHIND_THRESHOLD = 30;

describe("reachability-taxonomy", () => {
  it("diagnoses reachable prop as reachable with no reasons", () => {
    const shoulder = { x: 266, y: 326 };
    const prop = { x: 200, y: 330 };
    const otherShoulder = { x: 334, y: 326 };
    const otherProp = { x: 400, y: 330 };
    const result = diagnoseReachability(
      "left", prop, shoulder, otherShoulder, otherProp,
      BODY, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    );
    expect(result.reachable).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("diagnoses over-extension when prop is too far", () => {
    const shoulder = { x: 266, y: 326 };
    const prop = { x: 50, y: 330 };
    const otherShoulder = { x: 334, y: 326 };
    const otherProp = { x: 400, y: 330 };
    const result = diagnoseReachability(
      "left", prop, shoulder, otherShoulder, otherProp,
      BODY, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    );
    expect(result.reachable).toBe(false);
    expect(result.reasons).toContain("over-extension");
  });

  it("diagnoses cross-body when left prop is far right of center", () => {
    const shoulder = { x: 266, y: 326 };
    const prop = { x: 500, y: 326 };
    const otherShoulder = { x: 334, y: 326 };
    const otherProp = { x: 200, y: 326 };
    const result = diagnoseReachability(
      "left", prop, shoulder, otherShoulder, otherProp,
      BODY, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    );
    expect(result.reachable).toBe(false);
    expect(result.reasons).toContain("cross-body");
  });

  it("diagnoses behind-body when prop is behind performer", () => {
    const shoulder = { x: 266, y: 326 };
    const prop = { x: 266, y: 550 };
    const otherShoulder = { x: 334, y: 326 };
    const otherProp = { x: 334, y: 326 };
    const result = diagnoseReachability(
      "left", prop, shoulder, otherShoulder, otherProp,
      BODY, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    );
    expect(result.reachable).toBe(false);
    expect(result.reasons).toContain("behind-body");
  });

  it("provides a suggestion string when unreachable", () => {
    const shoulder = { x: 266, y: 326 };
    const prop = { x: 50, y: 330 };
    const otherShoulder = { x: 334, y: 326 };
    const otherProp = { x: 400, y: 330 };
    const result = diagnoseReachability(
      "left", prop, shoulder, otherShoulder, otherProp,
      BODY, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    );
    expect(result.suggestion.length).toBeGreaterThan(0);
  });

  it("returns empty suggestion for reachable props", () => {
    const shoulder = { x: 266, y: 326 };
    const prop = { x: 200, y: 330 };
    const otherShoulder = { x: 334, y: 326 };
    const otherProp = { x: 400, y: 330 };
    const result = diagnoseReachability(
      "left", prop, shoulder, otherShoulder, otherProp,
      BODY, MAX_REACH, SHOULDER_DIST, BEHIND_THRESHOLD,
    );
    expect(result.suggestion).toBe("");
  });
});

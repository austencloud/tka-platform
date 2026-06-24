import { describe, it, expect, vi } from "vitest";

// Mock the firebase chain before importing anything that pulls SpecialArrowPlacement.
// computeSpecialOverrideKey → generateSpecialOverrideKey (SpecialArrowPlacement) →
// $lib/shared/firestore → $lib/shared/auth → firebase/auth → protobufjs at load time.
vi.mock("$lib/shared/auth/state/authState.svelte", () => ({
  authState: { effectiveUserId: null },
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
}));

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { computeSpecialOverrideKey } from "$lib/shared/pictograph/arrow/positioning/special-override/services/special-override-key";

// Representative pictograph: letter P, box mode, both Pro motions, both staff.
// motions.{blue,red} drive oriFolder/turns; the passed redMotion (distinct object)
// drives the propType segment so toggling it changes only the last segment.
function makePictograph(): PictographData {
  return {
    letter: "P",
    motions: {
      blue: { motionType: "pro", startOrientation: "in", turns: 0, propType: "staff", color: "blue", gridMode: "box" },
      red: { motionType: "pro", startOrientation: "in", turns: 0, propType: "staff", color: "red", gridMode: "box" },
    },
  } as unknown as PictographData;
}

function makeRedMotion(propType?: string): MotionData {
  return {
    motionType: "pro",
    startOrientation: "in",
    turns: 0,
    propType,
    color: "red",
    gridMode: "box",
  } as unknown as MotionData;
}

describe("computeSpecialOverrideKey", () => {
  it("returns a 7-segment key ending in the prop type", () => {
    const pd = makePictograph();
    const key = computeSpecialOverrideKey(pd, makeRedMotion(undefined), "red");
    expect(key.split("|")).toHaveLength(7);
    // propType undefined → defaults to "staff".
    expect(key.endsWith("|staff")).toBe(true);
    expect(key).toBe("box|from_layer1|P|0,0|pro|red|staff");
  });

  it("changes ONLY the last segment when the motion's prop type changes", () => {
    const pd = makePictograph();
    const staffKey = computeSpecialOverrideKey(pd, makeRedMotion(undefined), "red");
    const fanKey = computeSpecialOverrideKey(pd, makeRedMotion("fan"), "red");

    const staffSegs = staffKey.split("|");
    const fanSegs = fanKey.split("|");

    // First 6 segments identical, only the 7th (propType) differs.
    expect(fanSegs.slice(0, 6)).toEqual(staffSegs.slice(0, 6));
    expect(staffSegs[6]).toBe("staff");
    expect(fanSegs[6]).toBe("fan");
  });
});

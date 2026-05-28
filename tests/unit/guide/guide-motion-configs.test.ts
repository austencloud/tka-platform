import { describe, it, expect } from "vitest";
import {
  GUIDE_MOTION_CONFIGS,
  buildGuideMotionSequence,
  isKnownMotionId,
} from "../../../src/routes/(public)/guide/level-1/_components/guide-motion-configs";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

describe("GUIDE_MOTION_CONFIGS", () => {
  it("has 19 entries", () => {
    expect(GUIDE_MOTION_CONFIGS).toHaveLength(19);
  });
  it("has unique kebab-slug ids", () => {
    const ids = GUIDE_MOTION_CONFIGS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("every entry has a non-empty accessibility label", () => {
    for (const c of GUIDE_MOTION_CONFIGS) expect(c.label.length).toBeGreaterThan(0);
  });
});

describe("buildGuideMotionSequence", () => {
  it("builds a single-step diamond sequence with hand props", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "hm-shift-wn")!;
    const seq = buildGuideMotionSequence(config);
    expect(seq.steps).toHaveLength(1);
    expect(seq.gridMode).toBe(GridMode.DIAMOND);
    const red = seq.steps[0].motions.red;
    expect(red.startLocation).toBe(GridLocation.WEST);
    expect(red.endLocation).toBe(GridLocation.NORTH);
    expect(red.motionType).toBe(MotionType.PRO);
    expect(red.propType).toBe(PropType.HAND);
    expect(red.pathShape).toBe("arc");
  });
  it("uses linear pathShape for dashes", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "hm-dash-we")!;
    const red = buildGuideMotionSequence(config).steps[0].motions.red;
    expect(red.motionType).toBe(MotionType.DASH);
    expect(red.pathShape).toBe("linear");
  });
  it("defaults blue to a static hold at red's start when config.blue is absent", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "hm-start")!;
    const blue = buildGuideMotionSequence(config).steps[0].motions.blue;
    expect(blue.motionType).toBe(MotionType.STATIC);
    expect(blue.startLocation).toBe(config.red.start);
    expect(blue.endLocation).toBe(config.red.start);
  });
  it("builds explicit blue motion when config.blue is present", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "t1-split-same")!;
    const blue = buildGuideMotionSequence(config).steps[0].motions.blue;
    expect(blue.startLocation).toBe(GridLocation.WEST);
    expect(blue.endLocation).toBe(GridLocation.SOUTH);
    expect(blue.motionType).toBe(MotionType.PRO);
  });
  it("start position holds both hands static", () => {
    const config = GUIDE_MOTION_CONFIGS.find((c) => c.id === "t1-split-same")!;
    const sp = buildGuideMotionSequence(config).startPosition!;
    expect(sp.motions.red.motionType).toBe(MotionType.STATIC);
    expect(sp.motions.blue.motionType).toBe(MotionType.STATIC);
  });
});

describe("isKnownMotionId", () => {
  it("accepts every known id", () => {
    for (const c of GUIDE_MOTION_CONFIGS) expect(isKnownMotionId(c.id)).toBe(true);
  });
  it("rejects unknown ids and traversal attempts", () => {
    expect(isKnownMotionId("nope")).toBe(false);
    expect(isKnownMotionId("../secret")).toBe(false);
    expect(isKnownMotionId("hm-start/../../etc")).toBe(false);
    expect(isKnownMotionId("")).toBe(false);
  });
});

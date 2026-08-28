import { describe, expect, it } from "vitest";
import {
  FLOW_FEST_GATE3_CAMERA_IDS,
  FLOW_FEST_GATE3_VISUAL_HIERARCHY,
  getFlowFestVisualProfile,
  parseFlowFestGate3ReviewRequest,
} from "../../src/routes/test/flow-fest-sim/flow-fest-visual-system";

describe("Flow Fest Gate 3 visual system", () => {
  it("keeps the three review moments materially distinct", () => {
    const day = getFlowFestVisualProfile("afternoon");
    const dusk = getFlowFestVisualProfile("golden-hour");
    const night = getFlowFestVisualProfile("night");

    expect(new Set([day.sky.top, dusk.sky.top, night.sky.top]).size).toBe(3);
    expect(day.sun.intensity).toBeGreaterThan(dusk.sun.intensity);
    expect(dusk.sun.intensity).toBeGreaterThan(night.sun.intensity);
    expect(night.fog.density).toBeGreaterThan(day.fog.density);
    expect(night.sun.enabled).toBe(false);
    expect(day.grade.exposure).not.toBe(night.grade.exposure);
  });

  it("parses a deterministic registered review request", () => {
    const request = parseFlowFestGate3ReviewRequest(
      new URLSearchParams(
        "gate3=1&camera=middle-earth&moment=dusk&branch=upper-tent"
      )
    );

    expect(request).toEqual({
      enabled: true,
      cameraId: "middle-earth",
      momentId: "dusk",
      moment: "golden-hour",
      branch: "upper-tent",
    });
  });

  it("fails closed to no visual override when review mode is absent", () => {
    expect(
      parseFlowFestGate3ReviewRequest(
        new URLSearchParams("camera=middle-earth&moment=night")
      )
    ).toEqual({
      enabled: false,
      cameraId: null,
      momentId: null,
      moment: null,
      branch: "lower-tent",
    });
  });

  it("locks five source cameras and a land-first hierarchy", () => {
    expect(FLOW_FEST_GATE3_CAMERA_IDS).toEqual([
      "lower-gate",
      "lower-level",
      "upper-parking",
      "middle-earth",
      "night-composition",
    ]);
    expect(FLOW_FEST_GATE3_VISUAL_HIERARCHY).toHaveLength(5);
    expect(FLOW_FEST_GATE3_VISUAL_HIERARCHY[0]).toContain("Measured landform");
    expect(FLOW_FEST_GATE3_VISUAL_HIERARCHY.at(-1)).toContain("LED circle");
  });
});

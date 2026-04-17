import { describe, it, expect } from "vitest";
import { evaluatePreset } from "../../../src/lib/shared/sequence-viewer/camera-choreography/types";
import {
  autoOrbitPreset,
  ensembleFocusPreset,
  planeWallPreset,
  quadPlaneTourPreset,
} from "../../../src/lib/shared/sequence-viewer/camera-choreography/presets";

describe("camera-choreography preset evaluation", () => {
  it("auto-orbit accepts 1+ performers", () => {
    expect(evaluatePreset(autoOrbitPreset, 1).eligible).toBe(true);
    expect(evaluatePreset(autoOrbitPreset, 4).eligible).toBe(true);
    const zero = evaluatePreset(autoOrbitPreset, 0);
    expect(zero.eligible).toBe(false);
    expect(zero.reason).toMatch(/at least 1/);
  });

  it("plane-locked accepts any performer count", () => {
    expect(evaluatePreset(planeWallPreset, 0).eligible).toBe(true);
    expect(evaluatePreset(planeWallPreset, 8).eligible).toBe(true);
  });

  it("quad-plane-tour accepts any performer count", () => {
    expect(evaluatePreset(quadPlaneTourPreset, 1).eligible).toBe(true);
    expect(evaluatePreset(quadPlaneTourPreset, 4).eligible).toBe(true);
  });

  it("ensemble-focus requires exactly 4 performers", () => {
    expect(evaluatePreset(ensembleFocusPreset, 4).eligible).toBe(true);
    const three = evaluatePreset(ensembleFocusPreset, 3);
    expect(three.eligible).toBe(false);
    expect(three.reason).toMatch(/exactly 4/);
    const five = evaluatePreset(ensembleFocusPreset, 5);
    expect(five.eligible).toBe(false);
    expect(five.reason).toMatch(/exactly 4/);
  });

  it("declares correct loop counts", () => {
    expect(autoOrbitPreset.totalLoops).toBe(1);
    expect(planeWallPreset.totalLoops).toBe(1);
    expect(quadPlaneTourPreset.totalLoops).toBe(4);
    expect(ensembleFocusPreset.totalLoops).toBe(4);
  });
});

import { describe, it, expect } from "vitest";
import {
  resolveAnimal3D,
  resolveFire3D,
  resolvePulse3D,
  resolveSilk3D,
  resolveSparkles3D,
} from "./webgl3d-translator";
import type { FireIntent, SparklesIntent } from "../domain/effects-config";
import { DEFAULT_EFFECTS_CONFIG } from "../domain/defaults";

const base: FireIntent = {
  intensity: 0.7,
  brightness: 1.0,
  colorBlend: 0.5,
  turbulence: 0.5,
  colorCurve: null,
  propColors: null,
  customColors: null,
};

describe("resolveFire3D", () => {
  it("maps brightness to emissiveHot monotonically", () => {
    expect(resolveFire3D({ ...base, brightness: 0 }).emissiveHot).toBeLessThan(
      resolveFire3D({ ...base, brightness: 1 }).emissiveHot
    );
  });

  it("low brightness tames the core below the bloom-blowout zone (<= 1.6)", () => {
    expect(
      resolveFire3D({ ...base, brightness: 0.4 }).emissiveHot
    ).toBeLessThanOrEqual(1.6);
  });

  it("intensity still drives emission rate", () => {
    expect(
      resolveFire3D({ ...base, intensity: 1 }).emissionRate
    ).toBeGreaterThan(resolveFire3D({ ...base, intensity: 0 }).emissionRate);
  });

  it("turbulence still drives vortex strength", () => {
    expect(
      resolveFire3D({ ...base, turbulence: 1 }).vortexStrength
    ).toBeGreaterThan(resolveFire3D({ ...base, turbulence: 0 }).vortexStrength);
  });

  it("override wins over the derived emissiveHot", () => {
    expect(resolveFire3D(base, { emissiveHot: 0.1 }).emissiveHot).toBe(0.1);
  });
});

/**
 * The sparkle unit-domain guard. The 3D sparkle emitter used to read
 * intent.spread — authored in 2D canvas pixels, 0-30 — as world metres, and
 * drew unit spheres at scale 3-7. On a 0.86m staff that is a sparkle up to
 * eight times the length of the prop; a single one filled the viewport.
 * These bounds are expressed against the staff so they stay meaningful.
 */
const STAFF = 0.8636;

const sparkBase: SparklesIntent = {
  rate: 0.5,
  size: 0.5,
  lifetime: 1.2,
  color: "#fbbf24",
  palette: ["#fbbf24", "#f59e0b", "#fde047"],
  colorMode: "solid",
  spread: 8,
  gravity: 0.3,
  mode: "stream",
};

describe("resolveSparkles3D world units", () => {
  it("keeps a sparkle far smaller than the prop it comes off", () => {
    // A sparkle is a glint, not an object: at max size it stays under a tenth
    // of a staff (8.6cm). The bug shipped 3-7 METRE spheres — 3.5x to 8x the
    // whole staff — so this bound is three orders of magnitude from the defect.
    expect(
      resolveSparkles3D({ ...sparkBase, size: 1 }).baseRadius
    ).toBeLessThan(STAFF / 10);
  });

  it("scales particle radius with the Size control", () => {
    expect(
      resolveSparkles3D({ ...sparkBase, size: 1 }).baseRadius
    ).toBeGreaterThan(resolveSparkles3D({ ...sparkBase, size: 0 }).baseRadius);
  });

  it("converts the pixel spread range into a sub-staff world radius", () => {
    // Max authored spread (30px) must stay a cloud around the tip, not a room.
    expect(
      resolveSparkles3D({ ...sparkBase, spread: 30 }).worldSpread
    ).toBeLessThanOrEqual(STAFF * 0.25);
    expect(resolveSparkles3D({ ...sparkBase, spread: 0 }).worldSpread).toBe(0);
  });

  it("does not pass the pixel spread through as world units", () => {
    // The actual bug: spread 8 arriving in the scene as 8 metres.
    expect(
      resolveSparkles3D({ ...sparkBase, spread: 8 }).worldSpread
    ).toBeLessThan(1);
  });

  it("override still wins", () => {
    expect(resolveSparkles3D(sparkBase, { worldSpread: 9 }).worldSpread).toBe(
      9
    );
  });
});

describe("full-roster 3D world-unit translators", () => {
  it("keeps Silk width and lifetime monotonic with their controls", () => {
    const narrow = resolveSilk3D({
      ...DEFAULT_EFFECTS_CONFIG.silk,
      width: 0,
      duration: 0,
    });
    const wide = resolveSilk3D({
      ...DEFAULT_EFFECTS_CONFIG.silk,
      width: 1,
      duration: 1,
    });
    expect(wide.baseHalfWidthWorld).toBeGreaterThan(narrow.baseHalfWidthWorld);
    expect(wide.lifetimeSeconds).toBeGreaterThan(narrow.lifetimeSeconds);
  });

  it("maps Animal length to a fixed world-space arc length", () => {
    const short = resolveAnimal3D({
      ...DEFAULT_EFFECTS_CONFIG.animal,
      bodyLength: 0,
    });
    const long = resolveAnimal3D({
      ...DEFAULT_EFFECTS_CONFIG.animal,
      bodyLength: 1,
    });
    expect(long.bodyLengthWorld).toBeGreaterThan(short.bodyLengthWorld);
    expect(long.segmentCount).toBe(short.segmentCount);
  });

  it("maps Pulse reach to a bounded shockwave radius", () => {
    const near = resolvePulse3D({
      ...DEFAULT_EFFECTS_CONFIG.pulse,
      reach: 0,
    });
    const far = resolvePulse3D({
      ...DEFAULT_EFFECTS_CONFIG.pulse,
      reach: 1,
    });
    expect(far.maxRadiusWorld).toBeGreaterThan(near.maxRadiusWorld);
    expect(far.maxRadiusWorld).toBeLessThan(STAFF * 4);
  });
});

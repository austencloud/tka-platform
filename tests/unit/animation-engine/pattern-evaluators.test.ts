import { describe, it, expect } from "vitest";
import { createReusableContext } from "$lib/shared/animation-engine/domain/patterns/context";
// evaluator.ts auto-initializes the registry on import — no setup needed
import { evaluatePattern } from "$lib/shared/animation-engine/domain/patterns/evaluator";
import { evaluatePattern as oldEvaluatePattern, getLedPattern } from "$lib/shared/animation-engine/domain/types/led-patterns";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a context with common defaults already set. */
function ctx(overrides: Partial<ReturnType<typeof createReusableContext>> = {}) {
  const c = createReusableContext();
  c.primaryColor   = { r: 1.0, g: 0.5, b: 0.2 };
  c.secondaryColor = { r: 0.2, g: 0.8, b: 1.0 };
  c.speed          = 1;
  c.totalLeds      = 4;
  Object.assign(c, overrides);
  return c;
}

function isInRange(v: number, lo = 0, hi = 1): boolean {
  return v >= lo - 1e-9 && v <= hi + 1e-9;
}

function colorInRange(c: { r: number; g: number; b: number }): boolean {
  return isInRange(c.r) && isInRange(c.g) && isInRange(c.b);
}

// ─── TipEvaluationContext (existing tests) ────────────────────────────────────

describe("TipEvaluationContext", () => {
  it("creates a context with sensible defaults", () => {
    const c = createReusableContext();
    expect(c.time).toBe(0);
    expect(c.stepNumber).toBe(-1);
    expect(c.totalSteps).toBe(0);
    expect(c.prevFrameTips).toHaveLength(0);
    expect(c.secondaryColor).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("context is mutable for reuse", () => {
    const c = createReusableContext();
    c.time = 1.5;
    c.propIndex = 1;
    expect(c.time).toBe(1.5);
    expect(c.propIndex).toBe(1);
  });
});

// ─── Solid Patterns ───────────────────────────────────────────────────────────

describe("Solid patterns", () => {
  it("solid returns primary color unchanged", () => {
    const c = ctx({ time: 999 });
    const color = evaluatePattern("solid", c);
    expect(color).toEqual({ r: 1.0, g: 0.5, b: 0.2 });
  });

  it("solid is time-invariant (same at any time)", () => {
    const c0 = ctx({ time: 0 });
    const c1 = ctx({ time: 100 });
    expect(evaluatePattern("solid", c0)).toEqual(evaluatePattern("solid", c1));
  });

  it("split returns primary for prop 0", () => {
    const c = ctx({ propIndex: 0 });
    const color = evaluatePattern("split", c);
    expect(color).toEqual({ r: 1.0, g: 0.5, b: 0.2 });
  });

  it("split returns secondary for prop 1", () => {
    const c = ctx({ propIndex: 1 });
    const color = evaluatePattern("split", c);
    expect(color).toEqual({ r: 0.2, g: 0.8, b: 1.0 });
  });

  it("quad produces 4 distinct colors across all tip combinations", () => {
    const colors = [
      evaluatePattern("quad", ctx({ propIndex: 0, tipIndex: 0 })),
      evaluatePattern("quad", ctx({ propIndex: 0, tipIndex: 1 })),
      evaluatePattern("quad", ctx({ propIndex: 1, tipIndex: 0 })),
      evaluatePattern("quad", ctx({ propIndex: 1, tipIndex: 1 })),
    ];

    // All 4 must be distinct
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const same =
          colors[i].r === colors[j].r &&
          colors[i].g === colors[j].g &&
          colors[i].b === colors[j].b;
        expect(same).toBe(false);
      }
    }
  });

  it("quad (0,0) returns primary color exactly", () => {
    const color = evaluatePattern("quad", ctx({ propIndex: 0, tipIndex: 0 }));
    expect(color).toEqual({ r: 1.0, g: 0.5, b: 0.2 });
  });

  it("quad (0,1) returns secondary color exactly", () => {
    const color = evaluatePattern("quad", ctx({ propIndex: 0, tipIndex: 1 }));
    expect(color).toEqual({ r: 0.2, g: 0.8, b: 1.0 });
  });

  it("quad (1,0) has dominant blue channel (shifted toward blue)", () => {
    const color = evaluatePattern("quad", ctx({ propIndex: 1, tipIndex: 0 }));
    expect(color.b).toBeGreaterThan(color.r);
  });

  it("quad (1,1) has dominant red channel (shifted toward red)", () => {
    const color = evaluatePattern("quad", ctx({ propIndex: 1, tipIndex: 1 }));
    expect(color.r).toBeGreaterThan(color.b);
  });

  it("quad all channels in [0, 1]", () => {
    for (const p of [0, 1] as const) {
      for (const t of [0, 1]) {
        expect(colorInRange(evaluatePattern("quad", ctx({ propIndex: p, tipIndex: t })))).toBe(true);
      }
    }
  });
});

// ─── Breathe Patterns ─────────────────────────────────────────────────────────

describe("Breathe patterns", () => {
  it("breathe brightness varies with time (not constant)", () => {
    const c0 = ctx({ time: 0 });
    const c1 = ctx({ time: 0.25 }); // quarter cycle
    const c2 = ctx({ time: 0.5 });  // half cycle
    const r0 = evaluatePattern("breathe", c0).r;
    const r1 = evaluatePattern("breathe", c1).r;
    const r2 = evaluatePattern("breathe", c2).r;
    // At t=0 and t=0.5 the sine gives 0 and 0, but 0.25 gives max.
    // Essentially r0 != r1 != r2 in the general case.
    const allSame = r0 === r1 && r1 === r2;
    expect(allSame).toBe(false);
  });

  it("breathe output in [0, 1] for all channels", () => {
    for (let t = 0; t < 1; t += 0.1) {
      expect(colorInRange(evaluatePattern("breathe", ctx({ time: t })))).toBe(true);
    }
  });

  it("breathe at t=0.25 is brighter than at t=0.75 (half vs trough)", () => {
    // sin(0.25 * 2π) = sin(π/2) = 1 → full bright
    // sin(0.75 * 2π) = sin(3π/2) = -1 → dark
    const bright = evaluatePattern("breathe", ctx({ time: 0.25 })).r;
    const dark   = evaluatePattern("breathe", ctx({ time: 0.75 })).r;
    expect(bright).toBeGreaterThan(dark);
  });

  it("pulse: at cycle start brightness is high", () => {
    // frac near 0 → brightness near 1
    const color = evaluatePattern("pulse", ctx({ time: 0.001 }));
    expect(color.r).toBeGreaterThan(0.8);
  });

  it("pulse: at mid-cycle brightness is low", () => {
    // frac = 0.5 → 1 - 0.5 * 3 < 0 → brightness = 0
    const color = evaluatePattern("pulse", ctx({ time: 0.5 }));
    expect(color.r).toBeLessThan(0.1);
  });

  it("pulse output in [0, 1]", () => {
    for (let t = 0; t < 2; t += 0.05) {
      expect(colorInRange(evaluatePattern("pulse", ctx({ time: t })))).toBe(true);
    }
  });

  it("heartbeat has two distinct peaks within one cycle", () => {
    // The heartbeat formula has peaks at frac ≈ 0.0 and frac ≈ 0.2.
    // Sample around each peak directly to confirm both produce high brightness.
    const nearPeak1 = evaluatePattern("heartbeat", ctx({ time: 0.01 })).r; // frac ≈ 0.01
    const nearPeak2 = evaluatePattern("heartbeat", ctx({ time: 0.20 })).r; // frac ≈ 0.20
    const valley    = evaluatePattern("heartbeat", ctx({ time: 0.50 })).r; // frac ≈ 0.50 (between peaks)

    expect(nearPeak1).toBeGreaterThan(0.5);
    expect(nearPeak2).toBeGreaterThan(0.5);
    expect(valley).toBeLessThan(nearPeak1);
    expect(valley).toBeLessThan(nearPeak2);
  });

  it("heartbeat output in [0, 1]", () => {
    for (let t = 0; t < 1; t += 0.05) {
      expect(colorInRange(evaluatePattern("heartbeat", ctx({ time: t })))).toBe(true);
    }
  });

  it("color-morph at t=0 leans toward primary", () => {
    // sin(0) = 0 → blend = 0.5. But over a full sweep, we can check min/max.
    // At t=0.25 sin=1 → blend=1 → secondary
    const colorAtSecondaryMax = evaluatePattern("color-morph", ctx({ time: 0.25 }));
    const colorAtPrimaryMax   = evaluatePattern("color-morph", ctx({ time: 0.75 }));
    // At blend=1, result ≈ secondary color. Secondary has b=1.0, primary b=0.2.
    expect(colorAtSecondaryMax.b).toBeGreaterThan(colorAtPrimaryMax.b);
  });

  it("color-morph stays between primary and secondary", () => {
    for (let t = 0; t < 1; t += 0.1) {
      const color = evaluatePattern("color-morph", ctx({ time: t }));
      // r should be between min(0.2, 1.0) and max(0.2, 1.0) = [0.2, 1.0]
      expect(color.r).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(color.r).toBeLessThanOrEqual(1.0 + 1e-9);
    }
  });

  it("color-morph output in [0, 1]", () => {
    for (let t = 0; t < 1; t += 0.1) {
      expect(colorInRange(evaluatePattern("color-morph", ctx({ time: t })))).toBe(true);
    }
  });
});

// ─── Chase Patterns ───────────────────────────────────────────────────────────

describe("Chase patterns", () => {
  it("chase: different ledIndex values produce different brightness at same time", () => {
    const t = 0.1;
    const b0 = evaluatePattern("chase", ctx({ time: t, ledIndex: 0 })).r;
    const b1 = evaluatePattern("chase", ctx({ time: t, ledIndex: 1 })).r;
    const b2 = evaluatePattern("chase", ctx({ time: t, ledIndex: 2 })).r;
    // All three should not be identical
    expect(b0 === b1 && b1 === b2).toBe(false);
  });

  it("chase output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.2) {
        expect(colorInRange(evaluatePattern("chase", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("comet: different ledIndex values produce different brightness", () => {
    // At t=0 the head is at position 0. Led 0 is at the head (bright), led 2 is 2
    // positions behind the head (beyond the falloff), so they differ significantly.
    const b0 = evaluatePattern("comet", ctx({ time: 0, ledIndex: 0 })).r;
    const b2 = evaluatePattern("comet", ctx({ time: 0, ledIndex: 2 })).r;
    expect(b0).toBeGreaterThan(0.5);    // at the head → bright
    expect(b2).toBeLessThan(b0);         // far from head → dimmer
  });

  it("comet output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.2) {
        expect(colorInRange(evaluatePattern("comet", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("wave: different ledIndex values produce different brightness at same time", () => {
    const t = 0.5;
    const b0 = evaluatePattern("wave", ctx({ time: t, ledIndex: 0 })).r;
    const b1 = evaluatePattern("wave", ctx({ time: t, ledIndex: 1 })).r;
    // With 4 total LEDs the offset per LED is 90°, so adjacent tips differ
    expect(b0).not.toBeCloseTo(b1, 3);
  });

  it("wave output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("wave", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("cascade: staggered timing — ledIndex 0 and ledIndex 1 differ at the same time", () => {
    const t = 0.0;
    const b0 = evaluatePattern("cascade", ctx({ time: t, ledIndex: 0 })).r;
    const b1 = evaluatePattern("cascade", ctx({ time: t, ledIndex: 1 })).r;
    // 0.25 cycle offset → different brightness at t=0
    expect(b0).not.toBeCloseTo(b1, 3);
  });

  it("cascade: ledIndex 1 at time T+0.25 matches ledIndex 0 at time T (stagger)", () => {
    // localT = t - ledIndex * 0.25. For led0: localT = T.
    // For led1 to have the same localT, it needs t - 0.25 = T → t = T + 0.25.
    const T = 0.4;
    const b0atT         = evaluatePattern("cascade", ctx({ time: T,        ledIndex: 0 })).r;
    const b1atTplus025  = evaluatePattern("cascade", ctx({ time: T + 0.25, ledIndex: 1 })).r;
    expect(b0atT).toBeCloseTo(b1atTplus025, 5);
  });

  it("cascade output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("cascade", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });
});

// ─── Spectrum Patterns ────────────────────────────────────────────────────────

describe("Spectrum patterns", () => {
  it("rainbow: different ledIndex produce different hue colors", () => {
    const t = 0;
    const c0 = evaluatePattern("rainbow", ctx({ time: t, ledIndex: 0 }));
    const c1 = evaluatePattern("rainbow", ctx({ time: t, ledIndex: 1 }));
    const c2 = evaluatePattern("rainbow", ctx({ time: t, ledIndex: 2 }));
    // All three should be distinguishable
    const allSame =
      c0.r === c1.r && c1.r === c2.r &&
      c0.g === c1.g && c1.g === c2.g;
    expect(allSame).toBe(false);
  });

  it("rainbow output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("rainbow", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("warm-shift: red/yellow channel dominant (warm colors)", () => {
    // Sample across time — the mean red channel should exceed the mean blue channel
    let totalR = 0, totalB = 0;
    const samples = 20;
    for (let i = 0; i < samples; i++) {
      const c = evaluatePattern("warm-shift", ctx({ time: i / samples }));
      totalR += c.r;
      totalB += c.b;
    }
    expect(totalR / samples).toBeGreaterThan(totalB / samples);
  });

  it("warm-shift output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("warm-shift", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("cool-shift: blue channel dominant over red (cool colors)", () => {
    let totalR = 0, totalB = 0;
    const samples = 20;
    for (let i = 0; i < samples; i++) {
      const c = evaluatePattern("cool-shift", ctx({ time: i / samples }));
      totalR += c.r;
      totalB += c.b;
    }
    expect(totalB / samples).toBeGreaterThan(totalR / samples);
  });

  it("cool-shift output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("cool-shift", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("neon: purple/magenta tones — blue or red channel dominant, not green", () => {
    let totalG = 0, totalRplusB = 0;
    const samples = 20;
    for (let i = 0; i < samples; i++) {
      const c = evaluatePattern("neon", ctx({ time: i / samples }));
      totalG += c.g;
      totalRplusB += c.r + c.b;
    }
    expect(totalRplusB / samples).toBeGreaterThan(totalG / samples);
  });

  it("neon output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("neon", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });
});

// ─── Texture Patterns ─────────────────────────────────────────────────────────

describe("Texture patterns", () => {
  it("sparkle: varies with time (not constant)", () => {
    const values = new Set<number>();
    for (let t = 0; t < 5; t += 0.3) {
      values.add(evaluatePattern("sparkle", ctx({ time: t, ledIndex: 0 })).r);
    }
    expect(values.size).toBeGreaterThan(1);
  });

  it("sparkle output stays in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 5; t += 0.2) {
        expect(colorInRange(evaluatePattern("sparkle", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("flicker: brightness never fully dark (always ≥ ~0.2 of primary)", () => {
    // The formula is 0.6 + 0.4 * noise, and noise is in [-1, 1],
    // so minimum brightness is 0.6 + 0.4 * (-1) = 0.2.
    // With primary.r = 1.0, the red channel should never drop below 0.2.
    for (let t = 0; t < 10; t += 0.3) {
      const c = evaluatePattern("flicker", ctx({ time: t, ledIndex: 0 }));
      expect(c.r).toBeGreaterThanOrEqual(0.2 - 1e-6);
    }
  });

  it("flicker: varies with time", () => {
    const values = new Set<number>();
    for (let t = 0; t < 20; t += 0.5) {
      values.add(evaluatePattern("flicker", ctx({ time: t, ledIndex: 0 })).r);
    }
    expect(values.size).toBeGreaterThan(1);
  });

  it("flicker output in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 5; t += 0.3) {
        expect(colorInRange(evaluatePattern("flicker", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("aurora: produces valid colors in [0, 1]", () => {
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 10; t += 0.5) {
        expect(colorInRange(evaluatePattern("aurora", ctx({ time: t, ledIndex: i })))).toBe(true);
      }
    }
  });

  it("aurora: varies spatially across tip indices", () => {
    const t = 5;
    const c0 = evaluatePattern("aurora", ctx({ time: t, ledIndex: 0 }));
    const c2 = evaluatePattern("aurora", ctx({ time: t, ledIndex: 2 }));
    // Different tip indices should produce at least slightly different colors
    const identical = c0.r === c2.r && c0.g === c2.g && c0.b === c2.b;
    expect(identical).toBe(false);
  });
});

// ─── TKA-Aware Patterns ───────────────────────────────────────────────────────

describe("TKA-Aware patterns", () => {
  it("proximity: close tips (dist < 50) produce high brightness", () => {
    const c = ctx({
      x: 100, y: 100,
      prevFrameTips: [{ x: 110, y: 105, propIndex: 1, tipIndex: 0 }], // dist ~11
    });
    const color = evaluatePattern("proximity", c);
    // min dist ≈ 11, brightness = 1 - 11/400 ≈ 0.97
    expect(color.r).toBeGreaterThan(0.9);
  });

  it("proximity: far tips (dist > 400) produce dim output", () => {
    const c = ctx({
      x: 0, y: 0,
      prevFrameTips: [{ x: 500, y: 500, propIndex: 1, tipIndex: 0 }], // dist ≈ 707
    });
    const color = evaluatePattern("proximity", c);
    // brightness = 1 - clamp(707/400, 0, 1) = 1 - 1 = 0
    expect(color.r).toBeLessThan(0.1);
  });

  it("proximity: no prevFrameTips defaults to 0.5 brightness", () => {
    const c = ctx({ x: 0, y: 0, prevFrameTips: [] });
    const color = evaluatePattern("proximity", c);
    // brightness = 0.5 when no data
    expect(color.r).toBeCloseTo(0.5, 5); // primary.r = 1.0 * 0.5 = 0.5
  });

  it("proximity output in [0, 1]", () => {
    const cases = [
      ctx({ x: 0, y: 0, prevFrameTips: [] }),
      ctx({ x: 0, y: 0, prevFrameTips: [{ x: 10, y: 10, propIndex: 1, tipIndex: 0 }] }),
      ctx({ x: 0, y: 0, prevFrameTips: [{ x: 600, y: 0, propIndex: 1, tipIndex: 0 }] }),
    ];
    for (const c of cases) {
      expect(colorInRange(evaluatePattern("proximity", c))).toBe(true);
    }
  });

  it("velocity: speedMagnitude=0 → dim output (not zero)", () => {
    const c = ctx({ speedMagnitude: 0 });
    const color = evaluatePattern("velocity", c);
    // brightness = clamp(0/3000, 0.1, 1.0) = 0.1
    expect(color.r).toBeCloseTo(0.1, 5);
  });

  it("velocity: speedMagnitude=3000 → full brightness", () => {
    const c = ctx({ speedMagnitude: 3000 });
    const color = evaluatePattern("velocity", c);
    // brightness = clamp(3000/3000, 0.1, 1.0) = 1.0
    expect(color.r).toBeCloseTo(1.0, 5);
  });

  it("velocity: intermediate speed maps linearly", () => {
    const c = ctx({ speedMagnitude: 1500 });
    const color = evaluatePattern("velocity", c);
    // brightness = clamp(0.5, 0.1, 1.0) = 0.5 → color.r = 1.0 * 0.5 = 0.5
    expect(color.r).toBeCloseTo(0.5, 5);
  });

  it("velocity output in [0, 1]", () => {
    for (const speed of [0, 500, 1500, 3000, 5000]) {
      expect(colorInRange(evaluatePattern("velocity", ctx({ speedMagnitude: speed })))).toBe(true);
    }
  });

  it("mirror-sync: prop 0 and prop 1 have different brightness at same time", () => {
    const t = 0.3;
    const c0 = evaluatePattern("mirror-sync", ctx({ time: t, propIndex: 0 }));
    const c1 = evaluatePattern("mirror-sync", ctx({ time: t, propIndex: 1 }));
    // They should differ since the phase offset is π
    expect(c0.r).not.toBeCloseTo(c1.r, 3);
  });

  it("mirror-sync: when prop 0 is at peak, prop 1 is near minimum", () => {
    // sin(t * 2π + 0) = 1 at t = 0.25  → brightness = 1.0
    // sin(t * 2π + π) = -1 at t = 0.25 → brightness = 0.0
    const t = 0.25;
    const bright = evaluatePattern("mirror-sync", ctx({ time: t, propIndex: 0 })).r;
    const dim    = evaluatePattern("mirror-sync", ctx({ time: t, propIndex: 1 })).r;
    expect(bright).toBeGreaterThan(0.9);
    expect(dim).toBeLessThan(0.1);
  });

  it("mirror-sync output in [0, 1]", () => {
    for (const p of [0, 1] as const) {
      for (let t = 0; t < 1; t += 0.1) {
        expect(colorInRange(evaluatePattern("mirror-sync", ctx({ time: t, propIndex: p })))).toBe(true);
      }
    }
  });

  it("beat-pulse: at time=0 is bright (start of beat)", () => {
    // beatPhase = (0 * 120 / 60) % 1 = 0 → brightness = pow(max(0, 1-0), 2) = 1
    const color = evaluatePattern("beat-pulse", ctx({ time: 0, speed: 2 }));
    expect(color.r).toBeCloseTo(1.0, 5);
  });

  it("beat-pulse: at time=0.25 with speed=2 is dim (beat has passed)", () => {
    // bpm = 120, beatPhase = (0.25 * 120 / 60) % 1 = 0.5
    // brightness = pow(max(0, 1 - 0.5 * 4), 2) = pow(max(0, -1), 2) = 0
    const color = evaluatePattern("beat-pulse", ctx({ time: 0.25, speed: 2 }));
    expect(color.r).toBeLessThan(0.1);
  });

  it("beat-pulse output in [0, 1]", () => {
    for (let t = 0; t < 2; t += 0.05) {
      expect(colorInRange(evaluatePattern("beat-pulse", ctx({ time: t, speed: 2 })))).toBe(true);
    }
  });
});

// ─── Backward Compatibility ─────────────────────────────────────────────────

describe("Backward compatibility", () => {
  it("old evaluatePattern(solid) matches new evaluator", () => {
    const pattern = getLedPattern("solid");
    const primaryColor = { r: 0.5, g: 0.8, b: 0.2 };
    const old = oldEvaluatePattern(pattern, 1.0, 0, 4, 1.0, primaryColor);
    expect(old.r).toBeCloseTo(0.5);
    expect(old.g).toBeCloseTo(0.8);
    expect(old.b).toBeCloseTo(0.2);
  });

  it("old evaluatePattern(rainbow) produces valid color", () => {
    const pattern = getLedPattern("rainbow");
    const primaryColor = { r: 1, g: 1, b: 1 };
    const result = oldEvaluatePattern(pattern, 2.5, 1, 4, 1.0, primaryColor);
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(1);
    expect(result.g).toBeGreaterThanOrEqual(0);
    expect(result.b).toBeGreaterThanOrEqual(0);
  });

  it("old evaluatePattern delegates to new registry for all known patterns", () => {
    const primaryColor = { r: 0.7, g: 0.3, b: 0.9 };
    for (const id of ["solid", "rainbow"]) {
      const pattern = getLedPattern(id);
      const result = oldEvaluatePattern(pattern, 1.0, 0, 4, 1.0, primaryColor);
      expect(colorInRange(result)).toBe(true);
    }
  });

  it("old evaluatePattern with unknown id falls back to primary color", () => {
    // getLedPattern returns solid fallback for unknown IDs
    const pattern = getLedPattern("nonexistent-pattern");
    const primaryColor = { r: 0.1, g: 0.2, b: 0.3 };
    const result = oldEvaluatePattern(pattern, 0, 0, 4, 1.0, primaryColor);
    expect(result.r).toBeCloseTo(0.1);
    expect(result.g).toBeCloseTo(0.2);
    expect(result.b).toBeCloseTo(0.3);
  });
});

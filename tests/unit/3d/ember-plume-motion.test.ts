import { describe, expect, it } from "vitest";

import {
  EMBER_ATMOSPHERE_LOOK_IDS,
  createDefaultEmberConfig,
  type EmberPlumeConfig,
} from "$lib/shared/3d/environments/domain/models/scene-configs";
import {
  advancePlumePuff,
  createPlumePuff,
  plumeAlpha,
  plumeBuoyancy,
  plumeLitFraction,
  plumeSizeScale,
  type PlumePuff,
} from "$lib/shared/3d/environments/scenes/ember/ember-plume-motion";

/** Deterministic stand-in for Math.random so a life curve is reproducible. */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const VENT: EmberPlumeConfig = {
  position: [0, 0, 0],
  count: 8,
  area: { width: 10, height: 20, depth: 10 },
  speed: 1.6,
  litColor: "#7a3a18",
  ashColor: "#14100f",
  sizeRange: [1, 2],
  opacity: 0.3,
  motionScale: 1,
  windShear: [0.4, -0.1],
  growth: [0.25, 1],
};

/** Runs one puff to dissolution, returning its track and the samples taken. */
function runToDissolution(
  puff: PlumePuff,
  spec: EmberPlumeConfig,
  dt = 0.1
): { alphas: number[]; sizes: number[]; steps: number; end: PlumePuff } {
  const alphas: number[] = [];
  const sizes: number[] = [];
  let steps = 0;
  // Generous ceiling: the assertion is that dissolution arrives well inside it.
  while (steps < 100000) {
    const sample = advancePlumePuff(puff, dt, spec);
    steps += 1;
    if (!sample) break;
    alphas.push(sample.alpha);
    sizes.push(sample.size);
  }
  return { alphas, sizes, steps, end: puff };
}

describe("Fumarole puff lifecycle", () => {
  it("opens and closes at zero coverage so a puff can neither pop in nor be cut off", () => {
    expect(plumeAlpha(0)).toBe(0);
    expect(plumeAlpha(1)).toBe(0);
    expect(plumeAlpha(-0.2)).toBe(0);
    expect(plumeAlpha(1.4)).toBe(0);

    // Full coverage lives in the hold band between the fade in and the decay.
    expect(plumeAlpha(0.25)).toBeGreaterThan(0.97);
    expect(plumeAlpha(0.02)).toBeLessThan(0.3);
    expect(plumeAlpha(0.95)).toBeLessThan(0.05);
  });

  it("grows a puff from the mouth radius to its terminal radius, never shrinking", () => {
    const growth: [number, number] = [0.25, 1];
    expect(plumeSizeScale(0, growth)).toBeCloseTo(0.25, 6);
    expect(plumeSizeScale(1, growth)).toBeCloseTo(1, 6);

    let previous = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const scale = plumeSizeScale(t, growth);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
  });

  it("spends its buoyancy as it climbs rather than rising at one rate", () => {
    expect(plumeBuoyancy(0)).toBeGreaterThan(plumeBuoyancy(0.5));
    expect(plumeBuoyancy(0.5)).toBeGreaterThan(plumeBuoyancy(1));
    expect(plumeBuoyancy(1)).toBeGreaterThan(0);
  });

  it("carries the vent's underlight at the mouth and none of it at the crown", () => {
    expect(plumeLitFraction(0)).toBeCloseTo(1, 6);
    expect(plumeLitFraction(1)).toBeCloseTo(0, 6);

    let previous = Infinity;
    for (let rise = 0; rise <= 1.0001; rise += 0.1) {
      const lit = plumeLitFraction(rise);
      expect(lit).toBeLessThanOrEqual(previous);
      previous = lit;
    }
  });

  it("dissolves inside its own column instead of drifting off as a stray", () => {
    for (let seed = 1; seed <= 24; seed += 1) {
      const puff = createPlumePuff(VENT, seededRng(seed));
      const { steps, end, alphas } = runToDissolution(puff, VENT);

      // Terminates inside the longest life the spec can hand out, and the last
      // sample before it does is already faded out.
      const longestLife = (VENT.area.height / (0.79 * VENT.speed)) * 1.2;
      expect(steps).toBeLessThanOrEqual(Math.ceil(longestLife / 0.1) + 1);
      expect(alphas.at(-1) ?? 1).toBeLessThan(0.08);

      // A dissolved puff is still inside the column it belongs to. The box
      // emitter had no lifetime, so a mote could park anywhere in its volume.
      // The ceiling is the model's own spread: the fastest puff carries 1.28x
      // the nominal climb and the longest-lived one 1.2x the nominal life, so
      // a ragged crown reaches about 1.54x the declared height.
      expect(end.y).toBeLessThan(VENT.area.height * 1.6);
      expect(end.y).toBeGreaterThan(0);
    }
  });

  it("leans the column downwind in proportion to the shear the look declares", () => {
    const drift = (shear: [number, number]) => {
      const puff = createPlumePuff(VENT, seededRng(7));
      const { end } = runToDissolution(puff, { ...VENT, windShear: shear });
      return end.x;
    };

    const still = drift([0, 0]);
    const breeze = drift([0.35, 0]);
    const storm = drift([0.7, 0]);

    expect(breeze).toBeGreaterThan(still + 1);
    expect(storm).toBeGreaterThan(breeze + 1);
  });

  it("climbs roughly its declared column height over one life", () => {
    let total = 0;
    const samples = 40;
    for (let seed = 1; seed <= samples; seed += 1) {
      const puff = createPlumePuff(VENT, seededRng(seed * 977));
      total += runToDissolution(puff, VENT).end.y;
    }
    const mean = total / samples;
    expect(mean).toBeGreaterThan(VENT.area.height * 0.7);
    expect(mean).toBeLessThan(VENT.area.height * 1.3);
  });
});

describe("Ember particle range falloff", () => {
  it.each(EMBER_ATMOSPHERE_LOOK_IDS)(
    "charges %s embers and ash only the coverage they earn at range",
    (lookId) => {
      const look = createDefaultEmberConfig(lookId);

      for (const field of [look.embers, look.ash]) {
        expect(field?.rangeFalloff?.subPixel).toBe(true);
        const fade = field?.rangeFalloff?.fade;
        expect(fade).toBeDefined();
        expect(fade?.[1] ?? 0).toBeGreaterThan(fade?.[0] ?? 0);
      }
    }
  );

  it.each(EMBER_ATMOSPHERE_LOOK_IDS)(
    "climbs %s embers and smoke from the floor instead of stalling at the ceiling",
    (lookId) => {
      const look = createDefaultEmberConfig(lookId);
      // Two looks inherit these fields by spread, so this also guards the
      // inheritance: an override that drops the flag parks the field again.
      expect(look.embers?.buoyant).toBe(true);
      expect(look.smoke?.buoyant).toBe(true);
    }
  );

  it.each(EMBER_ATMOSPHERE_LOOK_IDS)(
    "keeps every %s ember warm, so distance can never carry one to white",
    (lookId) => {
      const look = createDefaultEmberConfig(lookId);
      const swatches = [
        ...(look.embers?.colors ?? []),
        look.embers?.rangeFalloff?.tint?.color ?? "",
      ].filter(Boolean);

      expect(swatches.length).toBeGreaterThan(3);
      for (const swatch of swatches) {
        const { r, g, b } = parseHex(swatch);
        expect(r).toBeGreaterThan(g);
        expect(g).toBeGreaterThan(b);
        // Neutral is what reads as white once additive light stacks on a lit
        // sky, so the coolest channel has to stay well under the hottest.
        expect(b).toBeLessThan(r * 0.72);
      }
    }
  );

  it.each(EMBER_ATMOSPHERE_LOOK_IDS)(
    "gives %s fumaroles an underlit mouth, a dark crown and one wind",
    (lookId) => {
      const plumes = createDefaultEmberConfig(lookId).atmosphere.plumes;
      expect(plumes.length).toBeGreaterThanOrEqual(3);

      const shears = new Set<string>();
      for (const plume of plumes) {
        const lit = parseHex(plume.litColor);
        const ash = parseHex(plume.ashColor);

        // Storm-grey sits closest to this floor by design: its crown is the
        // brightest of the three looks and still reads as silhouette.
        expect(luminance(lit)).toBeGreaterThan(luminance(ash) * 1.6);
        expect(lit.r).toBeGreaterThan(lit.b);
        expect(plume.windShear).toBeDefined();
        shears.add(JSON.stringify(plume.windShear));
      }

      expect(shears.size).toBe(1);
    }
  );
});

function parseHex(value: string): { r: number; g: number; b: number } {
  const hex = value.replace("#", "");
  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

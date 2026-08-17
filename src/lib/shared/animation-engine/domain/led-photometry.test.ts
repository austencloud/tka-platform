import { describe, it, expect } from "vitest";
import {
  PIXEL_SIGMA_PX,
  PROP_REFERENCE_FLUX,
  perLedFlux,
  emitterSigmaPx,
  effectiveSigmaPx,
  splatAmplitude,
  streakEffectiveLengthPx,
  streakDensity,
  streakEnergy,
  subStepCount,
  MAX_SUB_STEPS,
  shutterWeight,
  shutterNormalization,
  shutterCutoffSeconds,
  glareFalloffExponent,
  DEFAULT_GLARE_WEIGHT,
  EYE_TIME_CONSTANT_S,
  type LedShutter,
} from "./led-photometry";

/**
 * These four invariants are the model. Each one failed in the pre-rewrite
 * renderer, and each failure was visible on screen as the same symptom: a
 * saturated formless disc instead of a light-painted ribbon.
 */

const STAFF_LENGTH_PX = 200;

/**
 * Integrate a shutter over a frame history exactly as the renderer does —
 * indexing the ring buffer by integer frame, never by an accumulating float.
 */
function integrateShutter(shutter: LedShutter, fps: number): number {
  const dt = 1 / fps;
  const frames = Math.floor(shutterCutoffSeconds(shutter) / dt);
  let total = 0;
  for (let frame = 0; frame <= frames; frame++) {
    total += shutterWeight(frame * dt, shutter) * dt;
  }
  return total / shutterNormalization(shutter, dt);
}

describe("LED photometry", () => {
  describe("invariant 1: subdivision", () => {
    it("deposits the same energy however finely the frame is sub-stepped", () => {
      const flux = perLedFlux(PROP_REFERENCE_FLUX, 72);
      const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, 72));
      const dt = 1 / 60;
      const chord = 48;

      const whole = streakEnergy(flux, dt, chord, sigma);

      for (const steps of [2, 4, 8, 16]) {
        let subdivided = 0;
        for (let i = 0; i < steps; i++) {
          subdivided += streakEnergy(flux, dt / steps, chord / steps, sigma);
        }
        expect(subdivided).toBeCloseTo(whole, 6);
      }
    });

    it("spreads that fixed energy thinner the faster the emitter moves", () => {
      const flux = perLedFlux(PROP_REFERENCE_FLUX, 72);
      const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, 72));
      const dt = 1 / 60;

      const slow = streakDensity(flux, dt, 10, sigma);
      const fast = streakDensity(flux, dt, 100, sigma);

      // Ten times the path at the same flux is ten times fainter per pixel.
      expect(fast).toBeLessThan(slow);
      expect(slow / fast).toBeCloseTo(
        streakEffectiveLengthPx(100, sigma) / streakEffectiveLengthPx(10, sigma),
        6
      );
    });

    it("paints an inner LED brighter than a tip LED on the same spin", () => {
      // The signature of a real long-exposure staff photo: speed rises with
      // radius, so the hub is a dense knot and the tip is a faint arc.
      const ledCount = 200;
      const flux = perLedFlux(PROP_REFERENCE_FLUX, ledCount);
      const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, ledCount));
      const omega = 2 * Math.PI * 3;
      const dt = 1 / 60;

      const density = (radiusPx: number) =>
        streakDensity(flux, dt, omega * radiusPx * dt, sigma);

      expect(density(10)).toBeGreaterThan(density(100));
    });
  });

  describe("invariant 2: density law", () => {
    it("emits the same total light at every LED count", () => {
      const totals = [2, 32, 72, 200].map((ledCount) => {
        const flux = perLedFlux(PROP_REFERENCE_FLUX, ledCount);
        return flux * ledCount;
      });

      for (const total of totals) {
        expect(total).toBeCloseTo(PROP_REFERENCE_FLUX, 6);
      }
    });

    it("keeps a resolved strip's peak amplitude independent of LED count", () => {
      // While LEDs stay larger than a pixel, adding more of them adds detail at
      // constant brightness. This is the term the fixed-size sprite omitted,
      // and its absence made a 200-LED staff ~100x brighter than a capsule.
      const amplitudeAt = (ledCount: number) => {
        const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, ledCount));
        return splatAmplitude(perLedFlux(PROP_REFERENCE_FLUX, ledCount), sigma);
      };

      // 8 and 16 LEDs over 200px are both comfortably resolved.
      expect(amplitudeAt(16) / amplitudeAt(8)).toBeCloseTo(1, 1);
    });

    it("dims each emitter once they pack below one pixel", () => {
      // Past the display's resolving power the footprint can shrink no further,
      // so per-emitter amplitude must fall as 1/N or the strip over-emits.
      const amplitudeAt = (ledCount: number) => {
        const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, ledCount));
        return splatAmplitude(perLedFlux(PROP_REFERENCE_FLUX, ledCount), sigma);
      };

      expect(amplitudeAt(800)).toBeLessThan(amplitudeAt(400));
      expect(amplitudeAt(400) / amplitudeAt(800)).toBeCloseTo(2, 0);
    });

    it("gives a capsule fat orbs and a dense staff sub-pixel emitters", () => {
      expect(emitterSigmaPx(STAFF_LENGTH_PX, 2)).toBeGreaterThan(20);
      expect(emitterSigmaPx(STAFF_LENGTH_PX, 200)).toBeLessThan(PIXEL_SIGMA_PX);
    });
  });

  describe("invariant 3: framerate independence", () => {
    it("integrates to the same exposure at any frame rate", () => {
      for (const shutter of [
        { mode: "eye", timeConstantSeconds: EYE_TIME_CONSTANT_S },
        { mode: "camera", exposureSeconds: 1.5 },
      ] as LedShutter[]) {
        // Exact, not approximate: the renderer divides by the very weights it
        // applied, so every frame rate integrates to unit exposure.
        for (const fps of [24, 30, 60, 90, 144, 240]) {
          expect(integrateShutter(shutter, fps)).toBeCloseTo(1, 6);
        }
      }
    });

    it("lengthens the trail without brightening the image", () => {
      // A longer exposure must extend persistence, not act as a second
      // brightness slider. The old per-frame decay rate did both at once.
      const short = integrateShutter({ mode: "camera", exposureSeconds: 0.5 }, 60);
      const long = integrateShutter({ mode: "camera", exposureSeconds: 3 }, 60);

      expect(long).toBeCloseTo(short, 1);
      expect(shutterCutoffSeconds({ mode: "camera", exposureSeconds: 3 })).toBeGreaterThan(
        shutterCutoffSeconds({ mode: "camera", exposureSeconds: 0.5 })
      );
    });

    it("holds every camera contribution at full weight, then ends", () => {
      const shutter: LedShutter = { mode: "camera", exposureSeconds: 1 };
      expect(shutterWeight(0, shutter)).toBe(1);
      expect(shutterWeight(0.99, shutter)).toBe(1);
      expect(shutterWeight(1.01, shutter)).toBe(0);
    });

    it("decays eye persistence smoothly with no hard edge", () => {
      const shutter: LedShutter = { mode: "eye", timeConstantSeconds: 0.12 };
      expect(shutterWeight(0, shutter)).toBeCloseTo(1, 6);
      expect(shutterWeight(0.12, shutter)).toBeCloseTo(Math.exp(-1), 6);
      expect(shutterWeight(0.6, shutter)).toBeLessThan(0.01);
      expect(shutterWeight(0.6, shutter)).toBeGreaterThan(0);
    });
  });

  describe("invariant 4: degenerate motion", () => {
    it("stays finite for a stationary emitter", () => {
      const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, 72));
      const density = streakDensity(perLedFlux(PROP_REFERENCE_FLUX, 72), 1 / 60, 0, sigma);

      expect(Number.isFinite(density)).toBe(true);
      expect(density).toBeGreaterThan(0);
    });

    it("passes smoothly through a turnaround", () => {
      // Approaching zero speed the density rises to a real hot knot — light
      // painting genuinely does that where the prop reverses — but it must
      // approach the floor continuously rather than spiking.
      const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, 72));
      const flux = perLedFlux(PROP_REFERENCE_FLUX, 72);
      const chords = [8, 4, 2, 1, 0.5, 0.25, 0];
      const densities = chords.map((c) => streakDensity(flux, 1 / 60, c, sigma));

      for (let i = 1; i < densities.length; i++) {
        expect(densities[i]!).toBeGreaterThanOrEqual(densities[i - 1]!);
        expect(densities[i]! / densities[i - 1]!).toBeLessThan(2);
      }
    });

    it("never divides by a vanishing footprint", () => {
      expect(Number.isFinite(splatAmplitude(1, 0))).toBe(true);
      expect(effectiveSigmaPx(0)).toBeCloseTo(PIXEL_SIGMA_PX, 6);
    });

    it("clamps sub-steps for a stalled tab resuming", () => {
      expect(subStepCount(2 * Math.PI * 5, 4, 200, 0.5)).toBe(MAX_SUB_STEPS);
      expect(subStepCount(0, 1 / 60, 200, 0.5)).toBe(1);
      expect(subStepCount(2 * Math.PI * 3, 1 / 60, 0, 0.5)).toBe(1);
    });
  });

  describe("sub-stepping", () => {
    it("asks for more steps as the prop spins faster", () => {
      const sigma = 0.5;
      const slow = subStepCount(2 * Math.PI * 1, 1 / 60, 200, sigma);
      const fast = subStepCount(2 * Math.PI * 6, 1 / 60, 200, sigma);

      expect(fast).toBeGreaterThan(slow);
    });

    it("keeps a typical fast spin in single digits", () => {
      // 3 rev/s on a 200px radius at 60fps — the common case must stay cheap.
      const steps = subStepCount(2 * Math.PI * 3, 1 / 60, 200, effectiveSigmaPx(0.5));
      expect(steps).toBeGreaterThanOrEqual(1);
      expect(steps).toBeLessThanOrEqual(8);
    });
  });

  describe("glare shape", () => {
    it("tightens the falloff as the per-mip weight drops", () => {
      // w=1 is the physical inverse-square veil; lower weights sharpen toward a
      // beam. A flat kernel is what read as a formless blob.
      expect(glareFalloffExponent(1)).toBeCloseTo(-2, 6);
      expect(glareFalloffExponent(0.5)).toBeCloseTo(-3, 6);
      expect(glareFalloffExponent(DEFAULT_GLARE_WEIGHT)).toBeLessThan(-2);
      expect(glareFalloffExponent(DEFAULT_GLARE_WEIGHT)).toBeGreaterThan(-3);
    });
  });
});

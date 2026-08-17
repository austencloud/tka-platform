import { describe, it, expect } from "vitest";
import {
  PIXEL_SIGMA_PX,
  PROP_REFERENCE_FLUX,
  perLedFlux,
  emitterSigmaPx,
  effectiveSigmaPx,
  splatAmplitude,
  stripSurfaceBrightness,
  EMITTER_DIE_LENGTH_FRACTION,
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
  advanceBoxShutter,
  SHUTTER_GAIN_REFERENCE_S,
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

    it("converges on one band brightness as the strip resolves", () => {
      // The useful form of the density law. Per-emitter peak is NOT invariant -
      // reading it as if it were is what put the flux budget ~60x low - but the
      // band the whole strip sweeps is, because neighbouring LEDs sum through
      // each other's profiles exactly as fast as their individual flux falls.
      const chordPx = 21;

      // Sum what the renderer actually deposits: every LED on the strip lays a
      // streak, and the profiles overlap onto the sample point at the middle.
      const simulate = (ledCount: number) => {
        const flux = perLedFlux(PROP_REFERENCE_FLUX, ledCount);
        const sigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, ledCount));
        const pitch = STAFF_LENGTH_PX / ledCount;
        const density = streakDensity(flux, 1, chordPx, sigma);
        let total = 0;
        for (let i = 0; i < ledCount; i++) {
          const offset = (i + 0.5) * pitch - STAFF_LENGTH_PX / 2;
          total +=
            (density * Math.exp((-0.5 * offset * offset) / (sigma * sigma))) /
            (Math.sqrt(2 * Math.PI) * sigma);
        }
        return total;
      };

      const predicted = stripSurfaceBrightness(PROP_REFERENCE_FLUX, chordPx, STAFF_LENGTH_PX);

      // A dense staff fills its band and hits the continuum value.
      expect(simulate(200) / predicted).toBeCloseTo(1, 1);

      // A sparse one sits under it, and that is the device being honest rather
      // than the model being wrong: at 32 LEDs the dies sit about four sigma
      // apart, so the strip reads as a row of discrete dots with gaps between
      // them. Filling the gaps would mean inventing light the prop does not
      // emit - the old renderer's fixed 60px sprite did exactly that, which is
      // why every device collapsed onto the same saturated disc.
      expect(simulate(32)).toBeLessThan(predicted);
      expect(simulate(32)).toBeLessThan(simulate(72));
      expect(simulate(72)).toBeLessThan(simulate(200));
    });

    it("concentrates a capsule's flux far above a dense staff's band", () => {
      // Two bulbs carrying the flux of two hundred read as intense discrete
      // arcs; the staff reads as a broad softer sheet. That contrast is the
      // whole difference between the two devices in a long exposure.
      const chordPx = 21;
      const capsuleSigma = effectiveSigmaPx(emitterSigmaPx(STAFF_LENGTH_PX, 2));
      const capsule =
        streakDensity(perLedFlux(PROP_REFERENCE_FLUX, 2), 1, chordPx, capsuleSigma) /
        (Math.sqrt(2 * Math.PI) * capsuleSigma);
      const staff = stripSurfaceBrightness(PROP_REFERENCE_FLUX, chordPx, STAFF_LENGTH_PX);

      expect(capsule / staff).toBeGreaterThan(4);
      expect(capsule / staff).toBeLessThan(64);
    });

    it("sizes emitters by pitch when dense and by the die when sparse", () => {
      // A capsule's bulbs are discrete emitters near the shaft ends, not orbs
      // covering a quarter of the staff each - pitch bounds the die, it is not
      // the die. Without the cap the capsule spread its flux over ~25px orbs
      // and came out dimmer than the staff it should dwarf.
      const dieCap = STAFF_LENGTH_PX * EMITTER_DIE_LENGTH_FRACTION;
      expect(emitterSigmaPx(STAFF_LENGTH_PX, 2)).toBeCloseTo(dieCap / 2, 6);
      expect(emitterSigmaPx(STAFF_LENGTH_PX, 200)).toBeLessThan(PIXEL_SIGMA_PX);
      expect(emitterSigmaPx(STAFF_LENGTH_PX, 32)).toBeLessThan(dieCap / 2);
    });
  });

  describe("invariant 3: framerate independence", () => {
    it("integrates to the same exposure at any frame rate", () => {
      for (const tau of [0.04, EYE_TIME_CONSTANT_S, 0.5]) {
        const shutter: LedShutter = { mode: "eye", timeConstantSeconds: tau };
        // A geometric series sampled at frame boundaries sums to `tau + dt/2`,
        // so a flat gain would leave 24fps ~15% brighter than 240fps; the
        // normalization carries that half-sample correction exactly. What is
        // left is the cutoff's own frame quantization, a fraction of a percent.
        const reference = integrateShutter(shutter, 60);
        for (const fps of [24, 30, 60, 90, 144, 240]) {
          const relative = Math.abs(integrateShutter(shutter, fps) - reference) / reference;
          expect(relative).toBeLessThan(0.005);
        }
      }
    });

    it("collects more light the longer persistence lasts", () => {
      // The physical behavior of a leaky integrator, and the fix for the defect
      // that made every eye-shutter preset read as a dim ghost: the old rule
      // divided by the persistence window, so trail luminance fell as `1/tau`
      // and asking for a longer trail cost brightness one-for-one.
      const short = integrateShutter({ mode: "eye", timeConstantSeconds: 0.04 }, 60);
      const long = integrateShutter({ mode: "eye", timeConstantSeconds: 0.4 }, 60);

      expect(long / short).toBeGreaterThan(5);
    });

    it("holds a single frame's contribution steady across persistence lengths", () => {
      // The head of one moving pass is one frame's deposit, so it must not
      // change when only the trail length changes. Accumulation over repeated
      // passes is what scales with persistence, per the test above.
      const head = (tau: number, fps: number) =>
        1 / fps / shutterNormalization({ mode: "eye", timeConstantSeconds: tau }, 1 / fps);

      const reference = head(EYE_TIME_CONSTANT_S, 60);
      for (const tau of [0.04, 0.12, 0.4, 1]) {
        expect(head(tau, 60) / reference).toBeGreaterThan(0.75);
        expect(head(tau, 60) / reference).toBeLessThan(1.35);
      }
    });

    it("scales a camera exposure by a fixed gain, not by its own window", () => {
      // A camera integrates at constant gain, which is why a longer exposure
      // paints more of the arc instead of fading each pass toward the floor.
      expect(shutterNormalization({ mode: "camera", exposureSeconds: 0.5 }, 1 / 60)).toBe(
        shutterNormalization({ mode: "camera", exposureSeconds: 4 }, 1 / 60)
      );
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

  describe("box shutter phase", () => {
    const EXPOSURE = 2.5;
    const PERIOD = EXPOSURE * 2;
    const DT = 1 / 60;

    /** Runs the pair from the seeded stagger for `frames` frames. */
    function run(frames: number, dt = DT, exposure = EXPOSURE) {
      let ageA = 0;
      let ageB = exposure;
      const history = [];
      for (let i = 0; i < frames; i++) {
        const phase = advanceBoxShutter(ageA, ageB, exposure, dt);
        ageA = phase.ageA;
        ageB = phase.ageB;
        history.push(phase);
      }
      return history;
    }

    it("keeps the weights summing to one across several full cycles", () => {
      // The whole point of the complementary triangles: if they ever fail to sum
      // to 1, total exposure changes with shutter phase and the trail pulses.
      for (const phase of run(Math.ceil((PERIOD * 3) / DT))) {
        expect(phase.weightA + phase.weightB).toBeCloseTo(1, 6);
      }
    });

    it("integrates over exactly the requested exposure at every instant", () => {
      // The pair runs for twice the exposure and is staggered by one, so the
      // age-weighted mean is algebraically half the period. This is what stops a
      // steadily swept disc from breathing with the clear cycle — and it is the
      // reason the resolve pass can scale by a fixed gain rather than by age.
      for (const phase of run(Math.ceil((PERIOD * 3) / DT))) {
        const effective = phase.weightA * phase.ageA + phase.weightB * phase.ageB;
        expect(effective).toBeCloseTo(EXPOSURE, 1);
      }
    });

    it("gives a cleared accumulator no weight on the frame it is cleared", () => {
      // A buffer that still carries weight as it is emptied is exactly the pop
      // this design exists to avoid.
      const resets = run(Math.ceil((PERIOD * 2) / DT)).filter((p) => p.resetA || p.resetB);
      expect(resets.length).toBeGreaterThan(0);
      for (const phase of resets) {
        if (phase.resetA) expect(phase.weightA).toBeLessThan(0.02);
        if (phase.resetB) expect(phase.weightB).toBeLessThan(0.02);
      }
    });

    it("never clears both accumulators on the same frame", () => {
      // One exposure of stagger is what guarantees a buffer always holds history;
      // losing both at once would blank the trail.
      for (const phase of run(Math.ceil((PERIOD * 3) / DT))) {
        expect(phase.resetA && phase.resetB).toBe(false);
      }
    });

    it("resets each accumulator once per period", () => {
      const history = run(Math.ceil((PERIOD * 4) / DT));
      const resetsA = history.filter((p) => p.resetA).length;
      // Four periods of frames, one clear apiece, allowing for the partial cycle
      // the run ends on.
      expect(resetsA).toBeGreaterThanOrEqual(3);
      expect(resetsA).toBeLessThanOrEqual(4);
    });

    it("clamps a frame longer than the period to a single frame of age", () => {
      // A tab restored after a stall delivers one enormous dt; without the clamp
      // the accumulators would report ages far past their own window.
      const phase = advanceBoxShutter(0, EXPOSURE, EXPOSURE, PERIOD * 10);
      expect(phase.resetA).toBe(true);
      expect(phase.resetB).toBe(true);
      expect(phase.ageA).toBeLessThanOrEqual(PERIOD);
      expect(phase.ageB).toBeLessThanOrEqual(PERIOD);
      expect(phase.weightA + phase.weightB).toBeCloseTo(1, 6);
    });

    it("holds ages inside the period at every frame rate", () => {
      for (const fps of [24, 30, 60, 144]) {
        for (const phase of run(Math.ceil(PERIOD * 2 * fps), 1 / fps)) {
          expect(phase.ageA).toBeGreaterThan(0);
          expect(phase.ageA).toBeLessThanOrEqual(PERIOD);
          expect(phase.ageB).toBeGreaterThan(0);
          expect(phase.ageB).toBeLessThanOrEqual(PERIOD);
        }
      }
    });

    it("shares one detector gain between both shutter modes", () => {
      // Switching shutter mode must change how long light persists and nothing
      // else, so a single pass reads at the same brightness either way. Dividing
      // the camera path by its own window instead made a 2.5s exposure read ~20x
      // dimmer than the same pass under 0.12s of persistence, and the
      // light-painted disc the mode exists for vanished.
      expect(SHUTTER_GAIN_REFERENCE_S).toBe(EYE_TIME_CONSTANT_S);
      expect(shutterNormalization({ mode: "camera", exposureSeconds: 2.5 }, 1 / 60)).toBe(
        SHUTTER_GAIN_REFERENCE_S
      );
    });
  });
});

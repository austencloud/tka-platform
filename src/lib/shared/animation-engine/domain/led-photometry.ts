/**
 * LED photometry — the one place the light math lives.
 *
 * Both LED backends (WebGL2 `led/web-gl-led-renderer.ts` and the WebGPU
 * `render-graph/services/web-gpu-led-executor.ts`) consume these functions so
 * the two cannot drift on physics; only the shader plumbing differs between
 * them.
 *
 * The model is a photographic one. A prop carries a fixed luminous flux budget
 * that its LEDs divide between them, each LED deposits that flux along the path
 * it sweeps during a frame, and the frames are integrated under an explicit
 * shutter. Every stage divides by something. The previous implementation
 * divided by nothing at any stage, so a 200-LED staff emitted roughly two
 * orders of magnitude more light than a 2-LED capsule and every preset
 * saturated to the same white disc.
 *
 * Four invariants hold, and `led-photometry.test.ts` asserts each:
 *
 *   1. Subdivision  — splitting a frame into more sub-steps deposits the same
 *                     total energy.
 *   2. Density      — changing LED count at fixed prop flux emits the same
 *                     total light.
 *   3. Framerate    — halving the frame rate leaves the exposure integral
 *                     unchanged.
 *   4. Degeneracy   — a stationary emitter stays finite.
 *
 * References:
 *   Zwicker et al., EWA Splatting (TVCG 2002) — reconstruction kernel must be
 *     convolved with the pixel prefilter and renormalized.
 *   Yu et al., Mip-Splatting (CVPR 2024) — the same rule for sub-pixel
 *     primitives; dilating instead of convolving shifts brightness with
 *     sampling rate.
 *   Trailing loss (LSST SMTN-002) — a streaked source's surface brightness
 *     falls as flux / (trail length x PSF width).
 */

// ─── Screen-space constants ───────────────────────────────────────────────────

/**
 * Standard deviation of the pixel reconstruction filter, in pixels. A Gaussian
 * of this width approximates a one-pixel box, and it is the floor below which
 * no emitter footprint can shrink — the display cannot resolve finer.
 */
export const PIXEL_SIGMA_PX = 0.5;

/**
 * Fraction of the LED pitch occupied by the emitter itself. Real addressable
 * strips run roughly half die, half gap; the gap is what makes individual
 * pixels readable on a sparse device.
 */
export const EMITTER_DUTY_CYCLE = 0.5;

/**
 * Physical size of one lit die, as a fraction of the strip it sits on.
 *
 * Pitch is only an upper bound on emitter size — LEDs cannot overlap, but they
 * are free to be much smaller than their spacing, and on a sparse device they
 * are. A capsule's two bulbs are two discrete emitters near the shaft ends, not
 * two orbs each covering a quarter of the staff, which is what pitch alone
 * implies. Roughly a 25mm diffuser cap on a 1m staff.
 */
export const EMITTER_DIE_LENGTH_FRACTION = 1 / 40;

// ─── Flux budget ──────────────────────────────────────────────────────────────

/**
 * Luminous flux one prop emits at brightness 1.0, in linear HDR render units
 * where diffuse scene white is 1.0.
 *
 * Sized so a resolved LED core lands well above the tone curve's shoulder — the
 * core is meant to clip to white while its halo keeps hue, which is what makes
 * an LED read as blinding rather than as a bright colored dot. Published
 * guidance puts emissive peaks in the 4x–32x range over diffuse white.
 *
 * Calibrated against a capsule at brightness level 3 spinning at a couple of
 * revolutions per second, which is the case the eye judges: its arcs land near
 * the top of that range, so the core clips and the halo carries the hue. A
 * 200-LED staff at the same budget paints a band around 0.5 — bright, saturated,
 * and deliberately not clipped, because 200 emitters share the flux two share.
 *
 * This is a surface brightness, so it carries both of the renderer's divisions
 * (path length and profile width). An earlier value of 900 was read off the
 * linear formula alone and rendered roughly 60x too dim on stage.
 */
export const PROP_REFERENCE_FLUX = 3500;

/**
 * Flux for a single LED.
 *
 * A real prop has a power budget: a 200-LED staff and a 32-LED staff of the
 * same length draw the same current, so the 200 resolves finer rather than
 * shining brighter. LED count is a resolution control, never a brightness
 * control — that separation is the whole reason the device picker can offer
 * 2 through 200 without the presets needing different brightness values.
 */
export function perLedFlux(propFlux: number, ledCount: number): number {
  if (ledCount <= 0) return 0;
  return propFlux / ledCount;
}

// ─── Emitter footprint ────────────────────────────────────────────────────────

/**
 * The on-screen footprint of one LED, derived from how densely the strip packs
 * them rather than authored as a constant.
 *
 * This is the fix for the original defect: the old renderer used a fixed 60px
 * radius per LED regardless of device, so a 200-LED staff painted 200 overlapping
 * 120px orbs along a shaft only ~200px long.
 *
 * Two bounds, whichever is tighter. Dense strips are pitch-limited, because
 * adjacent dies cannot overlap; sparse devices are die-limited, because a bulb
 * does not grow to fill the dark shaft around it. A 200-LED staff lands
 * sub-pixel on pitch, a 32-LED staff lands a couple of pixels on pitch, and a
 * capsule lands on the die bound — three devices, one expression.
 */
export function emitterSigmaPx(stripLengthPx: number, ledCount: number): number {
  if (ledCount <= 0) return PIXEL_SIGMA_PX;
  const pitchPx = stripLengthPx / ledCount;
  const diePx = Math.min(pitchPx * EMITTER_DUTY_CYCLE, stripLengthPx * EMITTER_DIE_LENGTH_FRACTION);
  // Half the lit die, so +/-2 sigma spans it.
  return Math.max(diePx / 2, PIXEL_SIGMA_PX * 0.5);
}

/**
 * Emitter footprint convolved with the pixel prefilter.
 *
 * Convolution, not dilation: variances add, so an emitter far below pixel size
 * lands at the pixel filter's own width instead of vanishing or aliasing.
 */
export function effectiveSigmaPx(emitterSigma: number): number {
  return Math.hypot(emitterSigma, PIXEL_SIGMA_PX);
}

/**
 * Accumulated peak of one emitter, renormalized so the splat integrates to
 * exactly its flux.
 *
 * Dividing by the footprint is the term the old renderer omitted. Without it,
 * shrinking an emitter dims it and packing more emitters in brightens the
 * strip — both wrong.
 *
 * The renderer spreads flux twice: along the path it sweeps (`streakDensity`)
 * and across the perpendicular profile (the shader's normalized Gaussian). This
 * is the product of both, so it is a surface brightness rather than a linear
 * one. Reading a single emitter's peak as if only one division happened is what
 * put `PROP_REFERENCE_FLUX` two orders of magnitude low on the first pass.
 */
export function splatAmplitude(flux: number, sigmaEff: number): number {
  const sigma = Math.max(sigmaEff, 1e-6);
  return flux / (2 * sigma * Math.sqrt(2 * Math.PI) * sigma);
}

/**
 * Surface brightness of the band a whole strip paints as it sweeps.
 *
 * On a spinning prop the strip lies along the direction the streaks spread
 * across, so neighbouring LEDs sum through each other's profiles. Summing them
 * cancels both the per-LED flux division and the footprint division exactly,
 * leaving flux over the area swept — independent of LED count and of emitter
 * size, which is the density law in its useful form. Per-emitter peak is not
 * N-invariant and was never meant to be; the band is.
 */
export function stripSurfaceBrightness(
  propFlux: number,
  pathLengthPx: number,
  stripLengthPx: number
): number {
  const area = Math.max(pathLengthPx, 1e-6) * Math.max(stripLengthPx, 1e-6);
  return propFlux / area;
}

// ─── Motion ───────────────────────────────────────────────────────────────────

/**
 * Path length an emitter's energy spreads over, floored at its own footprint.
 *
 * The floor is what keeps a stationary or turning-around emitter finite:
 * geometric length goes to zero at a turnaround but the emitter still covers
 * its own width. Adding in quadrature rather than clamping keeps the function
 * smooth through the transition, so a prop slowing to a stop does not pop.
 */
export function streakEffectiveLengthPx(chordPx: number, sigmaEff: number): number {
  return Math.sqrt(chordPx * chordPx + 4 * sigmaEff * sigmaEff);
}

/**
 * Linear energy density along a motion streak: flux-seconds per pixel of path.
 *
 * The photographic core of the model. Exposure is the time integral of
 * irradiance, so an emitter moving fast spreads a fixed amount of energy over a
 * longer path and must be *dimmer* per unit length. On a spinning prop the
 * speed of an LED is `angular speed x radius`, so this alone makes inner LEDs
 * paint bright dense knots and tip LEDs paint long faint arcs — the contrast
 * that reads as a real long-exposure photograph.
 */
export function streakDensity(
  flux: number,
  dtSeconds: number,
  chordPx: number,
  sigmaEff: number
): number {
  const lengthPx = streakEffectiveLengthPx(chordPx, sigmaEff);
  return (flux * dtSeconds) / lengthPx;
}

/**
 * Total energy a streak deposits. Always `flux x dt`, independent of how the
 * frame is subdivided or how fast the emitter moves — subdividing redistributes
 * energy, it never creates any.
 */
export function streakEnergy(
  flux: number,
  dtSeconds: number,
  chordPx: number,
  sigmaEff: number
): number {
  return streakDensity(flux, dtSeconds, chordPx, sigmaEff) * streakEffectiveLengthPx(chordPx, sigmaEff);
}

/** Sub-steps are capped so a stalled tab resuming cannot request thousands. */
export const MAX_SUB_STEPS = 32;

/**
 * Number of sub-steps needed to keep a curved path from polygonizing.
 *
 * Extruding one straight segment per frame chords the arc, and the error is the
 * sagitta `r x theta^2 / 8`. Requiring that to stay under the emitter's own
 * footprint gives the step angle, and hence the count. At a fast spin on a
 * large canvas this lands around 3-4; the correctness test is that raising it
 * further changes nothing (Haeberli & Akeley's Nyquist condition on the fastest
 * motion in frame).
 */
export function subStepCount(
  angularSpeedRadPerSec: number,
  dtSeconds: number,
  radiusPx: number,
  sigmaEff: number
): number {
  const sweptAngle = Math.abs(angularSpeedRadPerSec) * Math.max(dtSeconds, 0);
  if (sweptAngle <= 0 || radiusPx <= 0) return 1;
  const maxStepAngle = Math.sqrt((8 * sigmaEff) / radiusPx);
  if (!Number.isFinite(maxStepAngle) || maxStepAngle <= 0) return MAX_SUB_STEPS;
  return Math.min(MAX_SUB_STEPS, Math.max(1, Math.ceil(sweptAngle / maxStepAngle)));
}

// ─── Shutter ──────────────────────────────────────────────────────────────────

/**
 * How accumulated frames are weighted by age.
 *
 * `eye` is what a spinner perceives — visual persistence, an exponential decay
 * with no hard edge. `camera` is what the long-exposure photograph captures — a
 * box shutter that holds every contribution at full weight and then ends.
 *
 * These replace the old `trailFadeRate`, a per-frame multiplier that was
 * framerate-dependent (the same value produced different trails at 30 and 60fps)
 * and modeled neither behavior.
 */
export type LedShutter =
  | { mode: "eye"; timeConstantSeconds: number }
  | { mode: "camera"; exposureSeconds: number };

/** Rod response time constant. Visual persistence sits near a tenth of a second. */
export const EYE_TIME_CONSTANT_S = 0.12;

/** Exposures a light painter actually dials in. */
export const CAMERA_EXPOSURE_MIN_S = 0.25;
export const CAMERA_EXPOSURE_MAX_S = 4;

export const DEFAULT_LED_SHUTTER: LedShutter = {
  mode: "eye",
  timeConstantSeconds: EYE_TIME_CONSTANT_S,
};

/** Unnormalized weight for a contribution of the given age. */
export function shutterWeight(ageSeconds: number, shutter: LedShutter): number {
  if (ageSeconds < 0) return 0;
  if (shutter.mode === "camera") {
    return ageSeconds <= shutter.exposureSeconds ? 1 : 0;
  }
  return Math.exp(-ageSeconds / Math.max(shutter.timeConstantSeconds, 1e-6));
}

/**
 * Sum of the shutter weights the renderer will actually apply, used to
 * normalize the accumulation.
 *
 * Deliberately the *discrete* sum rather than the kernel's continuous integral.
 * Sampling a decaying kernel at frame boundaries overestimates it by about
 * `dt/2`, which is a 14% error at 30fps against a 120ms time constant and 3% at
 * 144fps — so normalizing by the integral would leave a slower machine visibly
 * brighter. Dividing by the sum actually applied is exact at every frame rate.
 *
 * Dividing at all is what keeps total exposure independent of persistence
 * length: lengthening the eye's time constant extends the trail rather than
 * blowing out the image, so the persistence control cannot double as a
 * brightness control.
 *
 * The camera branch is the same normalization applied to a box kernel, and it is
 * what the eye-path fallback uses when a camera exposure cannot run the real box
 * shutter. The shipped camera path does NOT normalize this way — a sensor
 * integrates at a constant gain, which is the whole reason a longer exposure
 * paints more of the arc. See `CAMERA_GAIN_REFERENCE_S`.
 *
 * Under variable frame times a renderer should accumulate the weights it really
 * used and divide by that running total; this closed form is the uniform-dt case.
 */
export function shutterNormalization(shutter: LedShutter, dtSeconds: number): number {
  const dt = Math.max(dtSeconds, 1e-6);
  const frames = Math.floor(shutterCutoffSeconds(shutter) / dt);

  if (shutter.mode === "camera") return dt * (frames + 1);

  const tau = Math.max(shutter.timeConstantSeconds, 1e-6);
  const ratio = Math.exp(-dt / tau);
  // -expm1(-dt/tau) is (1 - ratio) without the cancellation at small dt.
  const denominator = -Math.expm1(-dt / tau);
  return (dt * (1 - Math.pow(ratio, frames + 1))) / denominator;
}

/**
 * Reference integration time the camera shutter is scaled by.
 *
 * A camera does not renormalize by how long its shutter stayed open — it
 * integrates at a fixed gain, which is why a longer exposure paints more of the
 * arc rather than fading each pass into the floor. Dividing by the window
 * instead (the rule the eye path uses, where persistence must never double as a
 * brightness slider) made a 2.5s exposure read roughly 20x dimmer than the same
 * pass under 0.12s of visual persistence, and the light-painted disc the camera
 * mode exists for disappeared entirely.
 *
 * Fixed at the eye's own time constant, so switching shutter modes changes how
 * long light persists and nothing else: a single pass reads at the same
 * brightness either way. The consequence is the honest one — a slow or
 * stationary prop clips to white on a long exposure, exactly as it does on a
 * real sensor, which is the look the flux budget is already calibrated for.
 */
export const CAMERA_GAIN_REFERENCE_S = EYE_TIME_CONSTANT_S;

/**
 * State of the paired box-shutter accumulators a camera exposure runs on.
 *
 * A box shutter needs every contribution held at full weight and then dropped,
 * which no single decaying buffer can do. Renderers keep two plain additive
 * accumulators staggered half a period apart and blend them under the
 * complementary triangular weights this returns, so one is always at least half
 * full and neither pops when it is cleared. See `LED_BOX_RESOLVE_FRAG`.
 */
export interface BoxShutterPhase {
  /** Seconds each accumulator has been integrating. */
  ageA: number;
  ageB: number;
  /** Blend weights. Always sum to 1. */
  weightA: number;
  weightB: number;
  /** True when that accumulator must be cleared before this frame's deposit. */
  resetA: boolean;
  resetB: boolean;
}

/**
 * Advances the two accumulators by `dt` and returns the weights to blend them.
 *
 * Each accumulator runs for twice the requested exposure and they are staggered
 * by one exposure, which is what makes the pair integrate over the exposure the
 * caller actually asked for. Under the triangular weights the age-weighted mean
 * `wA*ageA + wB*ageB` is exactly half the period at every instant — algebraically,
 * not approximately — so a steadily swept pattern holds one brightness instead of
 * breathing with the clear cycle.
 *
 * `ageA`/`ageB` are the previous frame's ages; seed them one exposure apart
 * (`0` and `exposureSeconds`) so the triangles are complementary from the first
 * frame. An accumulator that reaches the end of its period is reported as
 * needing a reset, and comes back with an age of exactly one frame.
 */
export function advanceBoxShutter(
  ageA: number,
  ageB: number,
  exposureSeconds: number,
  dtSeconds: number
): BoxShutterPhase {
  const period = Math.max(exposureSeconds, 1e-6) * 2;
  const dt = Math.max(dtSeconds, 1e-6);

  const step = (age: number): { age: number; reset: boolean } => {
    const next = age + dt;
    // A frame longer than the whole period would otherwise leave the
    // accumulator permanently over-full, so clamp the restart to one frame.
    return next >= period ? { age: Math.min(dt, period), reset: true } : { age: next, reset: false };
  };

  const a = step(ageA);
  const b = step(ageB);

  // Triangle peaking at mid-period, zero at both ends. Two accumulators exactly
  // half a period apart make these sum to 1 at every instant.
  const triangle = (age: number): number =>
    Math.max(0, 1 - Math.abs((2 * age) / period - 1));

  const wA = triangle(a.age);
  const wB = triangle(b.age);
  // Immediately after a reset both triangles can be near zero at once (a long
  // frame desynchronizes them), so fall back to an even split rather than
  // dividing by ~0 and flashing.
  const total = wA + wB;
  const normalizedA = total > 1e-4 ? wA / total : 0.5;

  return {
    ageA: a.age,
    ageB: b.age,
    weightA: normalizedA,
    weightB: 1 - normalizedA,
    resetA: a.reset,
    resetB: b.reset,
  };
}

/** Age past which a contribution is dropped from the accumulation buffer. */
export function shutterCutoffSeconds(shutter: LedShutter): number {
  // Five time constants leaves under 1% of the kernel — below display precision.
  return shutter.mode === "camera"
    ? shutter.exposureSeconds
    : shutter.timeConstantSeconds * 5;
}

// ─── Glare ────────────────────────────────────────────────────────────────────

/**
 * Per-mip weight of the bloom pyramid, the single control over glare shape.
 *
 * With geometric weight `w` the composite point-spread falls off as
 * `r^(log2(w) - 2)`, so w=1 gives the physical inverse-square veil and lower
 * values tighten it toward a sharp beam. The CIE veiling-glare law is a very
 * sharp core with a heavy tail; a near-flat kernel (every mip weighted alike)
 * is what produced formless blobs.
 *
 * This is a camera property applied once to the whole composited frame. It is
 * deliberately not a per-LED value: a per-emitter glow sprite reintroduces
 * dependence on LED count, which is the defect this module exists to remove.
 */
export const GLARE_WEIGHT_MIN = 0.5;
export const GLARE_WEIGHT_MAX = 0.9;
export const DEFAULT_GLARE_WEIGHT = 0.75;

/** Falloff exponent implied by a per-mip weight, for tests and tooling. */
export function glareFalloffExponent(weight: number): number {
  return Math.log2(weight) - 2;
}

/**
 * Tent-filter radius of the upsample pass, as a fraction of frame HEIGHT.
 *
 * Held in UV so the halo subtends the same angle at any DPR or canvas size.
 * Where `glare` sets the kernel's falloff, this sets its spatial scale — the
 * two together are the whole shape of the veil, so they belong in one place
 * even though this one is a screen-space quantity rather than a photometric
 * one. Both backends had their own copy of it.
 */
export const BLOOM_TENT_RADIUS_FRAME_FRACTION = 0.005;

/**
 * Weight of the glare pyramid in the final composite lerp.
 *
 * Bloom is a veil over the scene, not an addition to it, so this cannot
 * brighten the image — which is what keeps the emitter's own flux budget the
 * only thing that sets exposure.
 */
export const BLOOM_COMPOSITE_STRENGTH = 0.06;

/** Ceiling on the composite weight. At 1.0 the veil replaces the scene. */
export const BLOOM_COMPOSITE_STRENGTH_MAX = 0.95;

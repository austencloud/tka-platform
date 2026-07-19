/**
 * Poi momentum sim — drives the shared Verlet solver with a kinematic hand
 * and a gravity-driven head, tethered by a tension-only distance constraint.
 *
 * Two particles:
 *  - index 0: hand. Weight 0; each tick its position AND positionsPrev are
 *    written directly from the sampled hand path (so it carries no implicit
 *    velocity of its own between samples), AND it is driven by a
 *    `createPointConstraint` pin constraint whose target is updated every
 *    tick via `setPosition`. The pin is what actually makes the drive
 *    "kinematic" through the solver: `createDistanceConstraint.applyConstraint`
 *    ignores particle weight and splits every correction 50/50 between the
 *    two endpoints, so without a pin the "weight 0" hand would still get
 *    shoved by the tether. The pin constraint runs after the local distance
 *    constraint each solver iteration and forces the hand back to its exact
 *    driven position regardless of what the tether did to it.
 *  - index 1: head. Unit weight, gravity force 9.81 m/s^2 toward +y (this
 *    codebase's grid/mandala coordinate convention is y-down — see
 *    `LOCATION_ANGLES`/`mandala-geometry-calculator` — and `gridToMeters` is a
 *    pure positive scale with no sign flip, so +y is "down" in meters too).
 *    z stays 0 throughout (2D sim in the x/y plane).
 *
 * Tether: `createDistanceConstraint([0, L], 0, 1)` — min 0 makes it
 * tension-only (taut at L, free/slack inside L). This is the entire physics
 * model; the extension-floor tempo emerges from it, not from tuned rules.
 */

import {
	ParticleSystem,
	createDistanceConstraint,
	createPointConstraint,
	type Constraint,
} from "$lib/shared/physics/verlet";

type PointConstraint = Constraint & { setPosition: (x: number, y: number, z: number) => void };

export interface Vec2 {
	x: number;
	y: number;
}

export interface PoiSimFrame {
	/** Simulation time, in seconds, at this frame. */
	t: number;
	hand: Vec2;
	head: Vec2;
	/** True when the tether is at (or within epsilon of) full extension. */
	taut: boolean;
}

export interface PoiSimOptions {
	/** Tether (cord) length, in meters. */
	tetherLength: number;
	/** Gravity magnitude, m/s^2 (positive; applied as -g on y). Defaults to 9.81. */
	gravity?: number;
	/** Substeps per second for the fixed-timestep integrator. Defaults to 480 (>=240 required). */
	substepsPerSecond?: number;
	/** Distance (meters) inside full extension still counted as "taut". Defaults to 1e-3. */
	tautEpsilon?: number;
	/**
	 * Overrides the head's seed position (defaults to directly below the hand
	 * at full tether extension). Useful for ground-truth tests that need to
	 * start the head at rest somewhere other than the neutral pose.
	 */
	seedHead?: Vec2;
	/**
	 * Overrides the head's initial velocity (m/s), applied via the Verlet
	 * "previous position" trick (`prev = seedHead - velocity * dt`). Defaults
	 * to zero (at rest). Only meaningful together with `seedHead`.
	 */
	seedHeadVelocity?: Vec2;
}

const DEFAULT_GRAVITY = 9.81;
const DEFAULT_SUBSTEPS_PER_SECOND = 480;
const DEFAULT_TAUT_EPSILON = 1e-3;

function gravityForce(gravity: number) {
	return {
		applyForce(ix: number, f0: Float32Array) {
			// Only the head (index 1, ix === 3) experiences gravity; the hand
			// (index 0, ix === 0) is kinematically driven and has weight 0, so
			// forces on it are moot, but we still gate on ix===3 to keep the
			// force model explicit and correct if weights ever change.
			//
			// +y is "down" in this codebase's y-down grid/meters convention (see
			// the class doc comment above), so gravity accelerates the head
			// toward +y, not -y.
			if (ix === 3) {
				f0[ix + 1] = f0[ix + 1]! + gravity;
			}
		},
	};
}

/**
 * A stateful, steppable driver for live/interactive playback (the test page
 * drives this frame-by-frame) AND the batch entry point (`runSimulation`
 * below drives the same instance in a loop). Construct once per run, call
 * `driveHandTo` + `tick` (or `stepAlongPath`) per fixed-size time slice.
 */
export class PoiSimDriver {
	private readonly system: ParticleSystem;
	private readonly handPin: PointConstraint;
	readonly dt: number;
	private readonly tautEpsilon: number;
	readonly tetherLength: number;
	private time = 0;

	constructor(seedHand: Vec2, options: PoiSimOptions) {
		this.tetherLength = options.tetherLength;
		this.tautEpsilon = options.tautEpsilon ?? DEFAULT_TAUT_EPSILON;
		this.dt = 1 / (options.substepsPerSecond ?? DEFAULT_SUBSTEPS_PER_SECOND);

		// Seed the head directly below the hand, at rest, at full extension —
		// a neutral starting pose that doesn't bias the taut/slack outcome —
		// unless the caller supplied an explicit seed (both position AND its
		// "prev" copy, so the head starts genuinely at rest, not with a
		// spurious first-tick velocity).
		const headSeed = options.seedHead ?? { x: seedHand.x, y: seedHand.y - this.tetherLength };
		const verts = [seedHand.x, seedHand.y, 0, headSeed.x, headSeed.y, 0];
		this.system = new ParticleSystem(verts, 4);
		this.system.setWeight(0, 0);
		this.system.setWeight(1, 1);
		this.system.addForce(gravityForce(options.gravity ?? DEFAULT_GRAVITY));
		this.system.addConstraint(createDistanceConstraint([0, this.tetherLength], 0, 1));
		this.handPin = createPointConstraint([seedHand.x, seedHand.y, 0], 0) as PointConstraint;
		this.system.addPinConstraint(this.handPin);
		this.driveHandTo(seedHand);

		const velocity = options.seedHeadVelocity;
		if (velocity) {
			// Verlet's "previous position" encodes velocity implicitly:
			// prev = current - velocity * dt.
			this.system.positionsPrev[3] = headSeed.x - velocity.x * this.dt;
			this.system.positionsPrev[4] = headSeed.y - velocity.y * this.dt;
		}
	}

	/**
	 * Writes the hand particle's position (and prev) directly — kinematic
	 * drive, not a force — AND retargets the hand's pin constraint to match.
	 * The direct write keeps the hand free of implicit velocity between
	 * samples; the pin is what holds it there once the tether constraint (which
	 * ignores particle weight) runs against it in `satisfyConstraints`.
	 */
	driveHandTo(p: Vec2): void {
		const positions = this.system.positions;
		const positionsPrev = this.system.positionsPrev;
		positions[0] = positionsPrev[0] = p.x;
		positions[1] = positionsPrev[1] = p.y;
		positions[2] = positionsPrev[2] = 0;
		this.handPin.setPosition(p.x, p.y, 0);
	}

	/** Advances the solver by one fixed substep of size `this.dt`. Call `driveHandTo` first. */
	tick(): PoiSimFrame {
		this.time += this.dt;
		this.system.tick(this.dt);

		const p = this.system.positions;
		const hand: Vec2 = { x: p[0]!, y: p[1]! };
		const head: Vec2 = { x: p[3]!, y: p[4]! };
		const dist = Math.hypot(head.x - hand.x, head.y - hand.y);
		const taut = dist >= this.tetherLength - this.tautEpsilon;

		return { t: this.time, hand, head, taut };
	}

	/** Convenience: drives the hand to `p` and ticks in one call. */
	step(p: Vec2): PoiSimFrame {
		this.driveHandTo(p);
		return this.tick();
	}

	get positions(): Float32Array {
		return this.system.positions;
	}
}

/**
 * Samples `path` at time `t` (seconds), treating the path as spanning
 * `[0, durationSeconds]` uniformly across its points and looping past the
 * end for continuous playback. Linearly interpolates between the two
 * nearest samples.
 */
function sampleAt(path: readonly Vec2[], t: number, durationSeconds: number): Vec2 {
	const n = path.length;
	const pathSpan = n - 1;
	const normalized = (t / durationSeconds) * pathSpan;
	const wrapped = ((normalized % pathSpan) + pathSpan) % pathSpan || 0;
	const lo = Math.floor(wrapped);
	const hi = Math.min(lo + 1, n - 1);
	const frac = wrapped - lo;
	const a = path[lo]!;
	const b = path[hi]!;
	return {
		x: a.x + (b.x - a.x) * frac,
		y: a.y + (b.y - a.y) * frac,
	};
}

export interface RunSimulationOptions {
	handPathMeters: readonly Vec2[];
	/** Total duration to simulate, in seconds — the path is stretched (in time) to fill it. */
	durationSeconds: number;
	tetherLength: number;
	gravity?: number;
	substepsPerSecond?: number;
	tautEpsilon?: number;
}

export interface RunSimulationResult {
	frames: PoiSimFrame[];
}

/**
 * Runs the full sim for `durationSeconds` at a fixed timestep, driving the
 * hand from `handPathMeters` (stretched in time to fill `durationSeconds`).
 * Returns every substep frame — the headless/batch entry point. The
 * interactive test page should drive `PoiSimDriver` directly instead, for
 * real-time playback control (play/pause/scrub).
 */
export function runSimulation(options: RunSimulationOptions): RunSimulationResult {
	if (options.handPathMeters.length < 2) {
		throw new Error("runSimulation: handPathMeters must have at least 2 samples");
	}

	const substepsPerSecond = options.substepsPerSecond ?? DEFAULT_SUBSTEPS_PER_SECOND;
	const totalSubsteps = Math.round(options.durationSeconds * substepsPerSecond);
	const seedHand = sampleAt(options.handPathMeters, 0, options.durationSeconds);

	const driver = new PoiSimDriver(seedHand, {
		tetherLength: options.tetherLength,
		gravity: options.gravity,
		substepsPerSecond,
		tautEpsilon: options.tautEpsilon,
	});

	const frames: PoiSimFrame[] = [];
	for (let i = 1; i <= totalSubsteps; i++) {
		const t = i * driver.dt;
		const hand = sampleAt(options.handPathMeters, t, options.durationSeconds);
		frames.push(driver.step(hand));
	}

	return { frames };
}

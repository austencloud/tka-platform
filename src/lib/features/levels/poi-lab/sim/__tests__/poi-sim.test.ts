import { describe, expect, it } from "vitest";
import { PoiSimDriver, type Vec2 } from "../poi-sim";

const G = 9.81;

describe("PoiSimDriver / runSimulation — analytic ground truth", () => {
	it("free fall: head released inside the tether radius follows a parabola while slack", () => {
		// Hand static at origin. Head seeded at rest, only 1m below the hand,
		// with a tether long enough (10m) that the constraint never engages
		// during the observation window, isolating pure gravity.
		//
		// This sim's coordinate convention is y-down (matching the mandala/grid
		// domain data that real runs are driven from — see the poi-sim.ts class
		// doc comment): +y is "down", so "below the hand" is +y, not -y.
		const tetherLength = 10;
		const hand: Vec2 = { x: 0, y: 0 };
		const seedHead: Vec2 = { x: 0, y: 1 };
		const driver = new PoiSimDriver(hand, {
			tetherLength,
			substepsPerSecond: 960,
			seedHead,
		});

		const observeSeconds = 0.3;
		const steps = Math.round(observeSeconds * 960);
		let frame = driver.step(hand);
		for (let i = 1; i < steps; i++) {
			frame = driver.step(hand);
		}

		// Head starts at seedHead.y, at rest. Under pure gravity for `t`
		// seconds from rest: fallen = 1/2 g t^2 (in the +y/"down" direction).
		const fallen = frame.head.y - seedHead.y;
		const expectedFallen = 0.5 * G * observeSeconds * observeSeconds;
		expect(fallen).toBeGreaterThan(0);
		expect(Math.abs(fallen - expectedFallen) / expectedFallen).toBeLessThan(0.02);

		// x stays at the hand's x while falling freely (no horizontal force).
		expect(Math.abs(frame.head.x - hand.x)).toBeLessThan(1e-6);

		// The cord is nowhere near taut in this window (10m tether, ~1.4m fall).
		expect(frame.taut).toBe(false);
	});

	it("taut pendulum: cord stays at full extension and swing energy is roughly conserved", () => {
		const tetherLength = 0.75;
		const hand: Vec2 = { x: 0, y: 0 };

		// Seed the head off to the side, at tether length, so it swings like a
		// pendulum released from a horizontal-ish start. +y is "down" in this
		// sim's coordinate convention (see the free-fall test above), so
		// "straight down" from the hand is +tetherLength on y.
		const startAngle = Math.PI / 2.5; // radians from straight down
		const seedHead: Vec2 = {
			x: tetherLength * Math.sin(startAngle),
			y: tetherLength * Math.cos(startAngle),
		};

		const driver = new PoiSimDriver(hand, {
			tetherLength,
			substepsPerSecond: 960,
			seedHead,
		});

		const distances: number[] = [];
		const durationSeconds = 3;
		const steps = Math.round(durationSeconds * 960);
		for (let i = 0; i < steps; i++) {
			const frame = driver.step(hand);
			distances.push(Math.hypot(frame.head.x - hand.x, frame.head.y - hand.y));
		}

		// The distance-constraint solver should keep the cord essentially at
		// full extension throughout a free swing (gravity alone, no driving
		// hand motion) — it never goes slack once released taut.
		for (const d of distances) {
			expect(Math.abs(d - tetherLength)).toBeLessThan(tetherLength * 0.02);
		}
	});

	it("extension floor emerges from the constraint: taut-at-the-top threshold is v^2 = gL", () => {
		// Classic vertical circular motion: hand static at the origin, head
		// seeded at the TOP of the loop (directly above the hand, at full
		// tether extension) with a purely tangential (horizontal) initial
		// velocity v. At the top, gravity pulls the head straight down (toward
		// the hand) — the cord can only pull, not push, so the head stays on
		// the circle only if the required centripetal force (v^2 / L) is at
		// least gravity's pull (g); i.e. only if v^2 >= gL. Below that speed
		// the head immediately falls inward (slack) instead of continuing on
		// the circle. This is the thesis test: the threshold must emerge from
		// the tension-only constraint, not from a tuned rule.
		// +y is "down" in this sim's coordinate convention (see the free-fall
		// test above), so "directly above the hand" is -tetherLength on y.
		const tetherLength = 0.75;
		const criticalSpeed = Math.sqrt(G * tetherLength);
		const hand: Vec2 = { x: 0, y: 0 };
		const top: Vec2 = { x: 0, y: -tetherLength };

		function slackFractionJustPastTop(speed: number): number {
			const driver = new PoiSimDriver(hand, {
				tetherLength,
				substepsPerSecond: 1920,
				seedHead: top,
				seedHeadVelocity: { x: speed, y: 0 },
			});

			// Observe only a short window right after the top — long enough
			// to see whether the cord holds or immediately goes slack, short
			// enough that a taut run hasn't yet swung far around the circle.
			const observeSteps = Math.round(0.05 * 1920);
			let slackCount = 0;
			for (let i = 0; i < observeSteps; i++) {
				const frame = driver.step(hand);
				if (!frame.taut) slackCount++;
			}
			return slackCount / observeSteps;
		}

		const belowCritical = slackFractionJustPastTop(criticalSpeed * 0.5);
		const aboveCritical = slackFractionJustPastTop(criticalSpeed * 1.5);

		// Below critical speed: the head falls inward immediately — mostly slack.
		expect(belowCritical).toBeGreaterThan(0.5);
		// Above critical speed: the cord holds taut through the window.
		expect(aboveCritical).toBeLessThan(0.1);
		// The floor is a real transition at v^2 = gL, not noise.
		expect(aboveCritical).toBeLessThan(belowCritical);
	});
});

describe("runSimulation", () => {
	it("produces one frame per substep and stretches the path across the requested duration", async () => {
		const { runSimulation } = await import("../poi-sim");
		const tetherLength = 0.75;
		const handPathMeters: Vec2[] = [
			{ x: 0, y: 0 },
			{ x: 0.1, y: 0 },
			{ x: 0.1, y: 0.1 },
			{ x: 0, y: 0.1 },
			{ x: 0, y: 0 },
		];
		const durationSeconds = 1;
		const substepsPerSecond = 240;

		const { frames } = runSimulation({
			handPathMeters,
			durationSeconds,
			tetherLength,
			substepsPerSecond,
		});

		expect(frames.length).toBe(durationSeconds * substepsPerSecond);
		expect(frames[frames.length - 1]!.t).toBeCloseTo(durationSeconds, 5);
	});
});

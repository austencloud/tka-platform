import { describe, expect, it } from "vitest";

import {
  WALK_PATTERNS,
  stepOf,
  walkPattern,
} from "$lib/shared/3d/diagnostics/gait/walk-patterns";
import type { WalkPattern } from "$lib/shared/3d/diagnostics/gait/walk-patterns";

const DT = 1 / 60;

/** Walk a lap the way the driver does and report where it ended up. */
function lap(
  pattern: WalkPattern,
  speed: number
): { x: number; z: number; far: number; travelled: number } {
  const seconds = pattern.period(speed);
  const steps = Math.round(seconds / DT);
  let x = 0;
  let z = 0;
  let far = 0;
  let travelled = 0;

  for (let i = 0; i < steps; i++) {
    const step = stepOf(pattern.tick(i * DT, speed), speed, DT);
    x += step.dx;
    z += step.dz;
    travelled += step.distance;
    far = Math.max(far, Math.hypot(x, z));
  }

  return { x, z, far, travelled };
}

/** Every speed the lab's slider can reach, plus the ends. */
const SPEEDS = [0.15, 0.6, 1, 1.8];

/**
 * The ramp deliberately does not close: its yaw rate follows its speed, so the
 * facing it has swept by the end of a lap is not a whole number of turns. It
 * still holds a fixed radius, which is what keeps it in the arena, so it is
 * checked for that instead.
 */
const OPEN_LAPS = new Set(["ramp"]);

/**
 * Patterns whose period is a fixed script rather than a distance to cover.
 * Their laps grow with the speed instead of holding their shape.
 */
const TIME_BASED = new Set(["zigzag", "compass", "ramp", "pivot"]);

describe("walk patterns", () => {
  it("names every pattern once", () => {
    const ids = WALK_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(walkPattern(id).id).toBe(id);
  });

  it("says what each one is hunting", () => {
    for (const pattern of WALK_PATTERNS) {
      expect(pattern.label.length).toBeGreaterThan(0);
      expect(pattern.hunts.length).toBeGreaterThan(0);
    }
  });

  for (const pattern of WALK_PATTERNS) {
    it(`keeps ${pattern.id} inside the arena`, () => {
      for (const speed of SPEEDS) {
        const walked = lap(pattern, speed);

        // Six metres is the ground the lab lights and the camera frames. A
        // pattern that leaves it has the character walking out of the picture
        // mid-measurement, which reads as the rig failing rather than as the
        // schedule being wrong.
        expect(walked.far).toBeLessThan(6);

        if (!OPEN_LAPS.has(pattern.id)) {
          // Ending anywhere but the start means every lap drifts, and after a
          // few minutes of watching the character is gone.
          expect(Math.hypot(walked.x, walked.z)).toBeLessThan(0.1);
        }
      }
    });
  }

  it("is either a fixed lap or a fixed clock, and says which", () => {
    // Two kinds of pattern, and the difference is deliberate. A distance-based
    // one stretches its period as the speed drops so the shape of the lap
    // stays put while the stride under it changes - otherwise the slow end of
    // the slider would trace a lap a tenth of the size and stop exercising the
    // turns at all. A time-based one is a fixed script: ten seconds walking
    // every direction is ten seconds at any speed, and its lap grows instead.
    for (const pattern of WALK_PATTERNS) {
      const slow = lap(pattern, 0.15);
      const fast = lap(pattern, 1.8);
      if (TIME_BASED.has(pattern.id)) {
        expect(pattern.period(0.15)).toBeCloseTo(pattern.period(1.8), 6);
      } else {
        expect(Math.abs(fast.far - slow.far)).toBeLessThan(0.6);
        expect(fast.travelled).toBeCloseTo(slow.travelled, 1);
      }
    }
  });

  it("only ever asks for a direction it can normalise", () => {
    for (const pattern of WALK_PATTERNS) {
      const seconds = pattern.period(1);
      for (let i = 0; i < Math.round(seconds / DT); i++) {
        const tick = pattern.tick(i * DT, 1);
        expect(Number.isFinite(tick.facing)).toBe(true);
        expect(Number.isFinite(tick.direction.x)).toBe(true);
        expect(Number.isFinite(tick.direction.z)).toBe(true);
        expect(tick.rate).toBeGreaterThanOrEqual(0);
        if (tick.isMoving) {
          expect(
            Math.hypot(tick.direction.x, tick.direction.z)
          ).toBeGreaterThan(1e-6);
        }
      }
    }
  });

  it("walks the character's right when told to go right", () => {
    // Facing +Z, the character's right is -X. Getting this backwards mirrors
    // every strafe and every diagonal, and a mirrored strafe looks exactly
    // like a rig fault, so it is worth pinning in one place.
    const step = stepOf(
      {
        facing: 0,
        isMoving: true,
        rate: 1,
        direction: { x: 1, z: 0 },
        phase: "right",
      },
      1,
      1
    );
    expect(step.dx).toBeCloseTo(-1, 6);
    expect(step.dz).toBeCloseTo(0, 6);
  });

  it("stands still when it is standing still", () => {
    const step = stepOf(
      {
        facing: 1.2,
        isMoving: false,
        rate: 0,
        direction: { x: 0, z: 0 },
        phase: "standing",
      },
      1,
      DT
    );
    expect(step).toEqual({ dx: 0, dz: 0, distance: 0 });
  });
});

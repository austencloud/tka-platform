/**
 * Turning in place is an angular move.
 *
 * A pan used to resolve to two keyframes carrying two aim POINTS, and the
 * sampler interpolated between them in world space. That chords across the
 * arc: halfway through a wide turn the aim point sits inside the circle it is
 * supposed to be sweeping, so the framing distance dips and the camera turns
 * fast at the ends and slow through the middle. Nobody asked for that; it was
 * a consequence of the aim having no representation other than a point.
 *
 * These tests pin the fixed version by its observable behaviour rather than by
 * its implementation: constant aim distance through the turn, and angle that
 * tracks the eased progress of the move.
 */
import { describe, expect, it } from "vitest";

import { compileCameraMoves } from "../../../src/routes/test/film-director/_lib/camera-language";
import { sampleDirectorCameraTrack } from "../../../src/routes/test/film-director/_lib/director-camera-track";

type V3 = [number, number, number];

const CONTEXT = {
  durationSeconds: 4,
  aspectRatio: 16 / 9,
  groundOffset: 0,
  performers: [],
};

/** Looking straight down +z from six metres out, level with the subject. */
const LEVEL: { position: V3; target: V3; fovDeg: number } = {
  position: [0, 1.5, -6],
  target: [0, 1.5, 0],
  fovDeg: 50,
};

/** Looking down at the floor from above, so pitch is not zero. */
const HIGH: { position: V3; target: V3; fovDeg: number } = {
  position: [0, 4, -6],
  target: [0, 1, 0],
  fovDeg: 50,
};

function aimDistance(position: V3, target: V3): number {
  return Math.hypot(
    target[0] - position[0],
    target[1] - position[1],
    target[2] - position[2]
  );
}

function yawDeg(position: V3, target: V3): number {
  return (
    (Math.atan2(target[0] - position[0], target[2] - position[2]) * 180) /
    Math.PI
  );
}

function pitchDeg(position: V3, target: V3): number {
  const dy = target[1] - position[1];
  return (Math.asin(dy / aimDistance(position, target)) * 180) / Math.PI;
}

describe("a pan turns in place", () => {
  const track = compileCameraMoves(
    [{ move: "pan", direction: "left", amount: { degrees: 90 } }],
    LEVEL,
    CONTEXT
  );

  it("holds its framing distance all the way through the turn", () => {
    const start = aimDistance(LEVEL.position, LEVEL.target);
    for (let step = 0; step <= 20; step += 1) {
      const frame = sampleDirectorCameraTrack(track, (step / 20) * 4);
      expect(aimDistance(frame.position, frame.target)).toBeCloseTo(start, 9);
    }
  });

  it("sweeps a real arc rather than the chord across it", () => {
    // The chord's midpoint sits at cos(45) of the radius. Anything that close
    // to the camera means the aim point is cutting the corner.
    const radius = aimDistance(LEVEL.position, LEVEL.target);
    const middle = sampleDirectorCameraTrack(track, 2);
    expect(aimDistance(middle.position, middle.target)).toBeGreaterThan(
      radius * 0.99
    );
  });

  it("reaches the stated angle, and no further", () => {
    const end = sampleDirectorCameraTrack(track, 4);
    expect(yawDeg(end.position, end.target)).toBeCloseTo(
      yawDeg(LEVEL.position, LEVEL.target) + 90,
      6
    );
  });

  it("leaves the rig where it found it", () => {
    for (let step = 0; step <= 8; step += 1) {
      const frame = sampleDirectorCameraTrack(track, (step / 8) * 4);
      expect(frame.position).toEqual(LEVEL.position);
    }
  });

  it("turns at the rate its easing states", () => {
    // ease-in-out is symmetric, so the midpoint of the window is the midpoint
    // of the turn. Under the old chord this read about 60 degrees.
    const middle = sampleDirectorCameraTrack(track, 2);
    expect(yawDeg(middle.position, middle.target)).toBeCloseTo(
      yawDeg(LEVEL.position, LEVEL.target) + 45,
      6
    );
  });
});

describe("a turn past a half circle keeps its direction", () => {
  it("a 270 degree pan arrives 270 degrees round, not 90 the other way", () => {
    const track = compileCameraMoves(
      [{ move: "pan", direction: "left", amount: { degrees: 270 } }],
      LEVEL,
      CONTEXT
    );
    // A quarter of the way through, a real 270 has turned 67.5 degrees; the
    // short way round would be heading toward -22.5.
    const quarter = sampleDirectorCameraTrack(track, 1);
    expect(yawDeg(quarter.position, quarter.target)).toBeGreaterThan(0);
    // Three quarters through, it is past the half circle, which `atan2` alone
    // could never report.
    const late = sampleDirectorCameraTrack(track, 3.5);
    expect(aimDistance(late.position, late.target)).toBeCloseTo(
      aimDistance(LEVEL.position, LEVEL.target),
      9
    );
  });

  it("survives the move that follows it replacing its closing key", () => {
    const track = compileCameraMoves(
      [
        { move: "pan", direction: "left", amount: { degrees: 270 } },
        { move: "hold" },
      ],
      LEVEL,
      CONTEXT
    );
    // Midway through the pan's own window a real 270 has turned 135 degrees,
    // so it has crossed the +-180 seam that a recovered angle folds back.
    const middle = sampleDirectorCameraTrack(track, 1);
    expect(yawDeg(middle.position, middle.target)).toBeCloseTo(135, 4);
  });
});

describe("a tilt turns in place, vertically", () => {
  const track = compileCameraMoves(
    [{ move: "tilt", direction: "up", amount: { degrees: 20 } }],
    HIGH,
    CONTEXT
  );

  it("reaches the stated angle from wherever it started", () => {
    const before = pitchDeg(HIGH.position, HIGH.target);
    const end = sampleDirectorCameraTrack(track, 4);
    expect(pitchDeg(end.position, end.target)).toBeCloseTo(before + 20, 6);
  });

  it("holds its framing distance and its heading", () => {
    const radius = aimDistance(HIGH.position, HIGH.target);
    const heading = yawDeg(HIGH.position, HIGH.target);
    for (let step = 0; step <= 20; step += 1) {
      const frame = sampleDirectorCameraTrack(track, (step / 20) * 4);
      expect(aimDistance(frame.position, frame.target)).toBeCloseTo(radius, 9);
      expect(yawDeg(frame.position, frame.target)).toBeCloseTo(heading, 6);
    }
  });

  it("refuses a tilt that would pass straight up", () => {
    expect(() =>
      compileCameraMoves(
        [{ move: "tilt", direction: "up", amount: { degrees: 120 } }],
        HIGH,
        CONTEXT
      )
    ).toThrow(/past the 85 degree limit/);
  });

  it("tilts down when asked to", () => {
    const down = compileCameraMoves(
      [{ move: "tilt", direction: "down", amount: { degrees: 10 } }],
      HIGH,
      CONTEXT
    );
    const before = pitchDeg(HIGH.position, HIGH.target);
    const end = sampleDirectorCameraTrack(down, 4);
    expect(pitchDeg(end.position, end.target)).toBeCloseTo(before - 10, 6);
  });
});

describe("moves that carry the aim keep interpolating it as a point", () => {
  it("a push-in holds the aim point exactly still", () => {
    const track = compileCameraMoves(
      [{ move: "push-in", amount: { meters: 2 } }],
      LEVEL,
      CONTEXT
    );
    for (let step = 0; step <= 12; step += 1) {
      const frame = sampleDirectorCameraTrack(track, (step / 12) * 4);
      expect(frame.target[0]).toBeCloseTo(LEVEL.target[0], 9);
      expect(frame.target[1]).toBeCloseTo(LEVEL.target[1], 9);
      expect(frame.target[2]).toBeCloseTo(LEVEL.target[2], 9);
    }
  });

  it("a truck carries the aim point sideways with the rig", () => {
    const track = compileCameraMoves(
      [{ move: "truck", direction: "right", amount: { meters: 3 } }],
      LEVEL,
      CONTEXT
    );
    const end = sampleDirectorCameraTrack(track, 4);
    // The rig and its aim moved together, so the heading never changed.
    expect(yawDeg(end.position, end.target)).toBeCloseTo(
      yawDeg(LEVEL.position, LEVEL.target),
      6
    );
    expect(end.target[0]).not.toBeCloseTo(LEVEL.target[0], 3);
  });
});

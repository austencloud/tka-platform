import { describe, expect, it } from "vitest";

import {
  AUDIENCE_FACING_ANGLE,
  compileBlockingMoves,
  type DirectorBlockingMove,
} from "../../../src/routes/test/film-director/_lib/blocking-language";
import { sampleDirectorBlockingTrack } from "../../../src/routes/test/film-director/_lib/director-blocking-track";

const CONTEXT = {
  durationSeconds: 8,
  performerId: "performer-1",
  startPosition: { x: 0, z: 0 },
  startFacingAngle: AUDIENCE_FACING_ANGLE,
};

function track(moves: DirectorBlockingMove[]) {
  return compileBlockingMoves(moves, CONTEXT);
}

describe("sampleDirectorBlockingTrack", () => {
  it("an empty track rests at the origin", () => {
    const frame = sampleDirectorBlockingTrack([], 3);
    expect(frame.isMoving).toBe(false);
    expect(frame.moveSpeed).toBe(0);
    expect(frame.position).toEqual({ x: 0, z: 0 });
  });

  it("holds the opening pose before the track starts and after it ends", () => {
    const frames = track([{ move: "walk", direction: "forward", amount: { meters: 2 } }]);
    const before = sampleDirectorBlockingTrack(frames, -5);
    const after = sampleDirectorBlockingTrack(frames, 100);
    expect(before.position).toEqual({ x: 0, z: 0 });
    expect(before.isMoving).toBe(false);
    expect(after.position.x).toBeCloseTo(frames.at(-1)!.position.x, 6);
    expect(after.isMoving).toBe(false);
    expect(after.moveSpeed).toBeCloseTo(0, 6);
  });

  it("reaches the halfway mark at the halfway time on a linear walk", () => {
    const frames = track([{ move: "walk", to: { x: 0, z: 4 } }]);
    const middle = sampleDirectorBlockingTrack(frames, 4);
    expect(middle.position.z).toBeCloseTo(2, 6);
    expect(middle.isMoving).toBe(true);
  });

  it("reports ground speed as distance over time", () => {
    const frames = track([
      { move: "walk", to: { x: 0, z: 8 }, durationSeconds: 8 },
    ]);
    expect(sampleDirectorBlockingTrack(frames, 4).moveSpeed).toBeCloseTo(1, 3);
  });

  it("reports zero speed while standing", () => {
    const frames = track([{ move: "stand" }]);
    const frame = sampleDirectorBlockingTrack(frames, 4);
    expect(frame.isMoving).toBe(false);
    expect(frame.moveSpeed).toBeCloseTo(0, 6);
  });

  it("an eased walk still reports speed, measured from the sampled path", () => {
    const frames = track([
      { move: "walk", to: { x: 0, z: 4 }, easing: "ease-in-out" },
    ]);
    // Fastest at the middle of an ease-in-out, slower a beat before the end.
    const middle = sampleDirectorBlockingTrack(frames, 4).moveSpeed;
    const late = sampleDirectorBlockingTrack(frames, 7.5).moveSpeed;
    expect(middle).toBeGreaterThan(late);
    expect(late).toBeGreaterThanOrEqual(0);
  });

  it("names travel in the performer's own frame", () => {
    const cases = [
      { direction: "forward", local: { x: 0, z: 1 } },
      { direction: "backward", local: { x: 0, z: -1 } },
      { direction: "right", local: { x: 1, z: 0 } },
      { direction: "left", local: { x: -1, z: 0 } },
    ] as const;
    for (const { direction, local } of cases) {
      const frames = track([
        { move: "walk", direction, amount: { meters: 2 } },
      ]);
      const frame = sampleDirectorBlockingTrack(frames, 4);
      expect(frame.moveDirection.x).toBeCloseTo(local.x, 6);
      expect(frame.moveDirection.z).toBeCloseTo(local.z, 6);
    }
  });

  it("a walk to a mark settles into forward as the performer turns toward it", () => {
    // Opens facing the audience and travels the other way, so the first
    // strides are a backpedal that resolves into a walk as the body comes
    // around. The direction has to track that, or the clip blend lies.
    const frames = track([{ move: "walk", to: { x: 3, z: 3 } }]);
    const early = sampleDirectorBlockingTrack(frames, 0.5).moveDirection;
    const late = sampleDirectorBlockingTrack(frames, 7.9).moveDirection;
    expect(early.z).toBeLessThan(0);
    expect(late.z).toBeGreaterThan(0.99);
    expect(Math.abs(late.x)).toBeLessThan(Math.abs(early.x));
  });

  it("turns the short way around rather than the long way", () => {
    const frames = compileBlockingMoves(
      [{ move: "turn", facing: { degrees: -170 } }],
      { ...CONTEXT, startFacingAngle: (170 * Math.PI) / 180 }
    );
    const middle = sampleDirectorBlockingTrack(frames, 4).facingAngle;
    // Going the short way crosses ±180°, so the midpoint leaves [-170, 170].
    expect(Math.abs(middle)).toBeGreaterThan((170 * Math.PI) / 180);
  });

  it("rotates without travelling during a turn", () => {
    const frames = track([{ move: "turn", direction: "right" }]);
    const middle = sampleDirectorBlockingTrack(frames, 4);
    expect(middle.isMoving).toBe(false);
    expect(middle.moveSpeed).toBeCloseTo(0, 6);
    expect(middle.facingAngle).toBeCloseTo(
      AUDIENCE_FACING_ANGLE + Math.PI / 4,
      6
    );
  });
});

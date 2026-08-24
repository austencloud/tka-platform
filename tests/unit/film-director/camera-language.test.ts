import { describe, expect, it } from "vitest";

import { computeCameraFraming } from "../../../src/routes/test/film-director/_lib/camera-language";

const CONTEXT = {
  durationSeconds: 8,
  aspectRatio: 16 / 9,
  groundOffset: 0,
  performers: [
    {
      id: "performer-1", name: "P1", avatarId: "y-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: -1, z: 0 }, facingAngle: 0, beatOffset: 0, staffLengthCm: null,
    },
    {
      id: "performer-2", name: "P2", avatarId: "x-bot" as never,
      prop: "staff" as never, effect: "none" as never, effort: "linear" as never,
      position: { x: 1, z: 0 }, facingAngle: 0, beatOffset: 0, staffLengthCm: null,
    },
  ],
};

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe("computeCameraFraming", () => {
  it("close-up is nearer than wide, which is nearer than extreme-wide", () => {
    const closeUp = computeCameraFraming({ shotSize: "close-up" }, CONTEXT);
    const wide = computeCameraFraming({ shotSize: "wide" }, CONTEXT);
    const extreme = computeCameraFraming({ shotSize: "extreme-wide" }, CONTEXT);
    expect(distance(closeUp.position, closeUp.target)).toBeLessThan(
      distance(wide.position, wide.target)
    );
    expect(distance(wide.position, wide.target)).toBeLessThan(
      distance(extreme.position, extreme.target)
    );
  });

  it("a performer subject targets that performer's position", () => {
    const framing = computeCameraFraming(
      { subject: { kind: "performer", performerId: "performer-2" } },
      CONTEXT
    );
    expect(framing.target[0]).toBeCloseTo(1, 5);
  });

  it("low angle puts the camera below eye target height; top well above", () => {
    const low = computeCameraFraming({ angle: "low" }, CONTEXT);
    const top = computeCameraFraming({ angle: "top" }, CONTEXT);
    expect(low.position[1]).toBeLessThan(low.target[1]);
    expect(top.position[1]).toBeGreaterThan(top.target[1] + 2);
  });

  it("left and behind vantages sit on opposite sides from right and front", () => {
    const front = computeCameraFraming({ position: "front" }, CONTEXT);
    const behind = computeCameraFraming({ position: "behind" }, CONTEXT);
    const left = computeCameraFraming({ position: "left" }, CONTEXT);
    const right = computeCameraFraming({ position: "right" }, CONTEXT);
    expect(Math.sign(front.position[2] - front.target[2])).not.toBe(
      Math.sign(behind.position[2] - behind.target[2])
    );
    expect(Math.sign(left.position[0] - left.target[0])).not.toBe(
      Math.sign(right.position[0] - right.target[0])
    );
  });

  it("rejects an unknown subject performer", () => {
    expect(() =>
      computeCameraFraming(
        { subject: { kind: "performer", performerId: "ghost" } },
        CONTEXT
      )
    ).toThrow(/ghost/);
  });
});

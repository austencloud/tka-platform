import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { SpineTwister } from "./SpineTwister";

const bodyCenter = new Vector3(0, 1, 0);

function yawFromResult(result: { head: { y: number; w: number } }) {
  // Head quaternion Y component is sin(yaw/2); extract signed direction.
  const { y, w } = result.head;
  return Math.sign(y) * 2 * Math.atan2(Math.abs(y), Math.abs(w));
}

describe("SpineTwister", () => {
  const twister = new SpineTwister();

  it("returns identity when both hands are null", () => {
    const result = twister.computeSpineTwist(null, null, bodyCenter);
    const bones = [result.spine1, result.spine2, result.neck, result.head, result.hips];
    for (const q of bones) {
      expect(q.x).toBeCloseTo(0, 6);
      expect(q.y).toBeCloseTo(0, 6);
      expect(q.z).toBeCloseTo(0, 6);
      expect(q.w).toBeCloseTo(1, 6);
    }
  });

  it("orients toward a single right-side hand", () => {
    const result = twister.computeSpineTwist(
      null,
      new Vector3(0.5, 1.2, 0),
      bodyCenter
    );
    expect(yawFromResult(result)).toBeGreaterThan(0);
  });

  it("orients toward a single left-side hand", () => {
    const result = twister.computeSpineTwist(
      new Vector3(-0.5, 1.2, 0),
      null,
      bodyCenter
    );
    expect(yawFromResult(result)).toBeLessThan(0);
  });

  it("does not counter-rotate hips in single-hand gaze", () => {
    const result = twister.computeSpineTwist(
      null,
      new Vector3(0.5, 1.2, 0),
      bodyCenter
    );
    expect(result.hips.x).toBeCloseTo(0, 6);
    expect(result.hips.y).toBeCloseTo(0, 6);
    expect(result.hips.z).toBeCloseTo(0, 6);
    expect(result.hips.w).toBeCloseTo(1, 6);
  });

  it("cross-body reach still counter-rotates hips", () => {
    const result = twister.computeSpineTwist(
      new Vector3(0.3, 1.3, 0),
      new Vector3(0.5, 1.3, 0),
      bodyCenter
    );
    // Hips should have a non-identity rotation (counter to head yaw).
    const hipsMagnitude = Math.abs(result.hips.y);
    expect(hipsMagnitude).toBeGreaterThan(0);
  });

  it("two-hand pose with both hands at body center yields no yaw", () => {
    const result = twister.computeSpineTwist(
      bodyCenter.clone(),
      bodyCenter.clone(),
      bodyCenter
    );
    expect(Math.abs(yawFromResult(result))).toBeLessThan(0.01);
  });

  it("single-hand yaw is gentler than cross-body reach at the same hand position", () => {
    const hand = new Vector3(0.5, 1.2, 0);
    const single = twister.computeSpineTwist(null, hand, bodyCenter);
    const crossReach = twister.computeSpineTwist(hand.clone(), hand, bodyCenter);
    expect(yawFromResult(single)).toBeLessThan(yawFromResult(crossReach));
  });
});

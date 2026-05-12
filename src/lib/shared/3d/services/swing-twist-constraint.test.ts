import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  decomposeSwingTwist,
  constrainShoulderCone,
  constrainElbowHinge,
} from "./swing-twist-constraint";

function expectQuatClose(q: Quaternion, expected: Quaternion, precision = 4) {
  const sign = Math.sign(q.w * expected.w + q.x * expected.x + q.y * expected.y + q.z * expected.z) || 1;
  expect(q.x * sign).toBeCloseTo(expected.x, precision);
  expect(q.y * sign).toBeCloseTo(expected.y, precision);
  expect(q.z * sign).toBeCloseTo(expected.z, precision);
  expect(q.w * sign).toBeCloseTo(expected.w, precision);
}

describe("decomposeSwingTwist", () => {
  it("identity quaternion decomposes to identity swing and twist", () => {
    const q = new Quaternion();
    const twistAxis = new Vector3(1, 0, 0);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    expectQuatClose(swing, new Quaternion());
    expectQuatClose(twist, new Quaternion());
  });

  it("pure twist around axis stays in twist component", () => {
    const angle = Math.PI / 4;
    const twistAxis = new Vector3(1, 0, 0);
    const q = new Quaternion().setFromAxisAngle(twistAxis, angle);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    expectQuatClose(swing, new Quaternion());
    expectQuatClose(twist, q);
  });

  it("pure swing perpendicular to axis stays in swing component", () => {
    const angle = Math.PI / 6;
    const swingAxis = new Vector3(0, 1, 0);
    const twistAxis = new Vector3(1, 0, 0);
    const q = new Quaternion().setFromAxisAngle(swingAxis, angle);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    expectQuatClose(twist, new Quaternion());
    expectQuatClose(swing, q);
  });

  it("recomposition: swing * twist ≈ original", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(1, 1, 1).normalize(),
      Math.PI / 3
    );
    const twistAxis = new Vector3(1, 0, 0);
    const { swing, twist } = decomposeSwingTwist(q, twistAxis);
    const recomposed = swing.clone().multiply(twist);
    expectQuatClose(recomposed, q);
  });
});

describe("constrainShoulderCone", () => {
  it("passes through rotation within cone limits", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (30 * Math.PI) / 180
    );
    const restDir = new Vector3(1, 0, 0);
    const result = constrainShoulderCone(q, restDir, "left");
    expectQuatClose(result, q);
  });

  it("clamps rotation exceeding backward limit", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, -1),
      (90 * Math.PI) / 180
    );
    const restDir = new Vector3(1, 0, 0);
    const result = constrainShoulderCone(q, restDir, "left");
    const diff = result.angleTo(q);
    expect(diff).toBeGreaterThan(0.01);
  });

  it("clamps adduction past 45 degrees", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 1, 0),
      (70 * Math.PI) / 180
    );
    const restDir = new Vector3(1, 0, 0);
    const result = constrainShoulderCone(q, restDir, "left");
    const diff = result.angleTo(q);
    expect(diff).toBeGreaterThan(0.01);
  });
});

describe("constrainElbowHinge", () => {
  it("passes through valid flexion angle", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (90 * Math.PI) / 180
    );
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(q, bendAxis, restDir);
    expectQuatClose(result, q);
  });

  it("clamps hyperextension (negative angle)", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (-20 * Math.PI) / 180
    );
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(q, bendAxis, restDir);
    expectQuatClose(result, new Quaternion(), 2);
  });

  it("clamps past max flexion", () => {
    const q = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (170 * Math.PI) / 180
    );
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(q, bendAxis, restDir);
    const diff = result.angleTo(q);
    expect(diff).toBeGreaterThan(0.01);
  });

  it("removes off-axis twist", () => {
    const flexion = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      (60 * Math.PI) / 180
    );
    const twistContam = new Quaternion().setFromAxisAngle(
      new Vector3(1, 0, 0),
      (30 * Math.PI) / 180
    );
    const combined = flexion.clone().multiply(twistContam);
    const bendAxis = new Vector3(0, 0, 1);
    const restDir = new Vector3(1, 0, 0);
    const result = constrainElbowHinge(combined, bendAxis, restDir);
    expectQuatClose(result, flexion, 2);
  });
});

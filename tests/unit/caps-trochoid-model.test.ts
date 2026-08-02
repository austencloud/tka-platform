import { describe, expect, it } from "vitest";
import {
  classifyTrochoid,
  evaluateTrochoid,
  isCycloidTrochoid,
  sampleTrochoid,
  type TrochoidParameters,
} from "@caps/domain";

const FIVE_PETAL_ROSETTE: TrochoidParameters = {
  theta1: 1,
  theta2: 4,
  rho1: 1,
  rho2: 1,
  d: 1,
};

describe("Zaltymbunk's trochoid model", () => {
  it("places O, M, and E on the two-vector construction", () => {
    const frame = evaluateTrochoid(FIVE_PETAL_ROSETTE, 0);

    expect(frame.shoulder).toEqual({ x: 0, y: 0 });
    expect(frame.hand).toEqual({ x: 1, y: 0 });
    expect(frame.tip).toEqual({ x: 2, y: 0 });
  });

  it("uses theta1 + theta2 for the ground-frame prop angle", () => {
    const frame = evaluateTrochoid(FIVE_PETAL_ROSETTE, 0.25);

    expect(frame.armAngle).toBeCloseTo(Math.PI / 2, 12);
    expect(frame.propAngle).toBeCloseTo((5 * Math.PI) / 2, 12);
    expect(frame.tip.x).toBeCloseTo(0, 12);
    expect(frame.tip.y).toBeCloseTo(2, 12);
  });

  it("samples the requested cycle fraction and includes both endpoints", () => {
    const halfCycle = { ...FIVE_PETAL_ROSETTE, d: 0.5 };
    const points = sampleTrochoid(halfCycle, 8);
    const expectedEnd = evaluateTrochoid(halfCycle, 0.5).tip;

    expect(points).toHaveLength(9);
    expect(points[0]).toEqual({ x: 2, y: 0 });
    expect(points.at(-1)?.x).toBeCloseTo(expectedEnd.x, 12);
    expect(points.at(-1)?.y).toBeCloseTo(expectedEnd.y, 12);
  });

  it("closes an integer-frequency full-cycle trace", () => {
    const points = sampleTrochoid(FIVE_PETAL_ROSETTE, 720);

    expect(points.at(-1)?.x).toBeCloseTo(points[0]!.x, 12);
    expect(points.at(-1)?.y).toBeCloseTo(points[0]!.y, 12);
  });

  it("recognizes the source model's cycloid radius ratio", () => {
    const cycloid: TrochoidParameters = {
      theta1: 1,
      theta2: 4,
      rho1: 1,
      rho2: 1 / 5,
      d: 1,
    };

    expect(isCycloidTrochoid(cycloid)).toBe(true);
    expect(classifyTrochoid(cycloid)).toBe("cycloid");
    expect(classifyTrochoid(FIVE_PETAL_ROSETTE)).toBe("rosette");
  });

  it("rejects invalid radii and cycle fractions", () => {
    expect(() =>
      evaluateTrochoid({ ...FIVE_PETAL_ROSETTE, rho2: 0 }, 0)
    ).toThrow(/rho1 and rho2/);
    expect(() => sampleTrochoid({ ...FIVE_PETAL_ROSETTE, d: 1.25 })).toThrow(
      /no greater than one/
    );
  });
});

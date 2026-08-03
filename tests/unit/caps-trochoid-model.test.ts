import { describe, expect, it } from "vitest";
import {
  CAP_MATH_MODEL,
  CAPJoinError,
  classifyTrochoid,
  countTrochoidFeatures,
  evaluateTrochoid,
  resolveCAPAssembly,
  isCycloidTrochoid,
  sampleTrochoid,
  solveCAPJoinPhases,
  type TrochoidParameters,
} from "@caps/domain";

const FOUR_PETAL_ROSETTE: TrochoidParameters = {
  theta1: 1,
  theta2: 4,
  rho1: 1,
  rho2: 1,
  d: 1,
};

describe("Zaltymbunk's trochoid model", () => {
  it("places O, M, and E on the two-vector construction", () => {
    const frame = evaluateTrochoid(FOUR_PETAL_ROSETTE, 0);

    expect(frame.shoulder).toEqual({ x: 0, y: 0 });
    expect(frame.hand).toEqual({ x: 1, y: 0 });
    expect(frame.tip).toEqual({ x: 2, y: 0 });
  });

  it("uses theta1 + theta2 for the ground-frame prop angle", () => {
    const frame = evaluateTrochoid(FOUR_PETAL_ROSETTE, 0.25);

    expect(frame.armAngle).toBeCloseTo(Math.PI / 2, 12);
    expect(frame.propAngle).toBeCloseTo((5 * Math.PI) / 2, 12);
    expect(frame.tip.x).toBeCloseTo(0, 12);
    expect(frame.tip.y).toBeCloseTo(2, 12);
  });

  it("samples the requested cycle fraction and includes both endpoints", () => {
    const halfCycle = { ...FOUR_PETAL_ROSETTE, d: 0.5 };
    const points = sampleTrochoid(halfCycle, 8);
    const expectedEnd = evaluateTrochoid(halfCycle, 0.5).tip;

    expect(points).toHaveLength(9);
    expect(points[0]).toEqual({ x: 2, y: 0 });
    expect(points.at(-1)?.x).toBeCloseTo(expectedEnd.x, 12);
    expect(points.at(-1)?.y).toBeCloseTo(expectedEnd.y, 12);
  });

  it("closes an integer-frequency full-cycle trace", () => {
    const points = sampleTrochoid(FOUR_PETAL_ROSETTE, 720);

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
    expect(classifyTrochoid(FOUR_PETAL_ROSETTE)).toBe("rosette");
  });

  it("rejects invalid radii and cycle fractions", () => {
    expect(() =>
      evaluateTrochoid({ ...FOUR_PETAL_ROSETTE, rho2: 0 }, 0)
    ).toThrow(/rho1 and rho2/);
    expect(() => sampleTrochoid({ ...FOUR_PETAL_ROSETTE, d: 1.25 })).toThrow(
      /no greater than one/
    );
  });

  it("derives corrected petal and cusp counts from theta2", () => {
    const byId = new Map(
      CAP_MATH_MODEL.elementaryPatterns.map((pattern) => [pattern.id, pattern])
    );

    expect(countTrochoidFeatures(byId.get("rosette-1-4")!)).toBe(4);
    expect(countTrochoidFeatures(byId.get("rosette-1-neg6")!)).toBe(6);
    expect(countTrochoidFeatures(byId.get("antispin-1-neg3")!)).toBe(3);
    expect(countTrochoidFeatures(byId.get("cycloid-1-4")!)).toBe(4);
    expect(countTrochoidFeatures(byId.get("cycloid-1-neg3")!)).toBe(3);
    expect(() =>
      countTrochoidFeatures({ ...FOUR_PETAL_ROSETTE, d: 0.5 })
    ).toThrow(/full cycle/);
  });
});

describe("CAP assembly continuity", () => {
  it("keeps M and E continuous and closes all three source assemblies", () => {
    expect(CAP_MATH_MODEL.assemblies).toHaveLength(3);

    for (const assembly of CAP_MATH_MODEL.assemblies) {
      const resolved = resolveCAPAssembly(assembly.segments);

      for (const junction of resolved.junctions) {
        expect(junction.handGap, assembly.id).toBeLessThan(1e-9);
        expect(junction.tipGap, assembly.id).toBeLessThan(1e-9);
        const segment = resolved.segments[junction.segmentIndex - 1]!;
        expect(junction.tipRadius, assembly.id).toBeCloseTo(
          segment.rho1 + segment.rho2,
          9
        );
      }

      expect(resolved.closure.handGap, assembly.id).toBeLessThan(1e-9);
      expect(resolved.closure.tipGap, assembly.id).toBeLessThan(1e-9);
    }
  });

  it("selects the hand-continuous branch at an off-extension join", () => {
    const expectedHand = {
      x: Math.cos(Math.PI / 3),
      y: Math.sin(Math.PI / 3),
    };
    const targetTip = {
      x: expectedHand.x + Math.cos(-Math.PI / 6),
      y: expectedHand.y + Math.sin(-Math.PI / 6),
    };

    const solution = solveCAPJoinPhases(1, 1, targetTip, expectedHand);

    expect(solution.handGap).toBeLessThan(1e-9);
    expect(solution.tipGap).toBeLessThan(1e-9);
    expect(solution.phi1).toBeCloseTo(Math.PI / 3, 12);
  });

  it("raises a typed error when a radius change cannot preserve the hand", () => {
    const segments = [
      { theta1: 1, theta2: 1, rho1: 1, rho2: 1, d: 1 / 4 },
      { theta1: -1, theta2: 2, rho1: 1, rho2: 1 / 2, d: 1 / 4 },
    ];

    try {
      resolveCAPAssembly(segments);
      throw new Error("Expected resolveCAPAssembly to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CAPJoinError);
      expect((error as CAPJoinError).kind).toBe("hand-discontinuity");
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  activeHandsAreValid,
  buildActiveHands,
  QFT_FLOWERS,
  resolveSessionHand,
  validOriginPhases,
  validVtgModes,
} from "../../src/lib/shared/notation/qft/qft-app-selection";
import type { QftSessionHand } from "../../src/lib/shared/notation/qft/qft-session";
import { GUIDE_MOVES } from "../../src/lib/shared/notation/qft/qft-guide";
import {
  buildTrajectoryIncrements,
  createPendulumTrajectory,
} from "../../src/lib/shared/notation/qft/qft-trajectory";

const flower = (index: number, radius = 1): QftSessionHand => ({
  source: { kind: "flower", index },
  radius,
});

const preset = (id: string, radius: number): QftSessionHand => ({
  source: { kind: "preset", id },
  radius,
});

describe("QfT app hand selection", () => {
  it("keeps the twelve-flower axis used by the existing matrix surface", () => {
    expect(QFT_FLOWERS).toHaveLength(12);
  });

  it("lets one preset change radius without changing its rate profile", () => {
    const pendulum = resolveSessionHand(preset("pendulum", 0));
    const extendulum = resolveSessionHand(preset("pendulum", 1));

    expect(extendulum.propRate).toEqual(pendulum.propRate);
    expect(extendulum.radius).toBe(1);
    expect(
      buildTrajectoryIncrements(extendulum).map((row) => row.radius)
    ).toEqual(Array(8).fill(1));
  });

  it("keeps Triquetra available as a preset outside the odd-rate flower axis", () => {
    const triquetra = GUIDE_MOVES.find(({ id }) => id === "triquetra")!;
    expect(new Set(triquetra.trajectory.propRate)).toEqual(new Set([-2]));
    expect(
      QFT_FLOWERS.some((candidate) =>
        resolveSessionHand({
          source: { kind: "flower", index: QFT_FLOWERS.indexOf(candidate) },
          radius: 1,
        }).propRate.every((rate) => Math.abs(rate) === 2)
      )
    ).toBe(false);
  });

  it("allows horizontal reversal phases and blocks quarter turns", () => {
    const swing: QftSessionHand = {
      source: { kind: "custom", trajectory: createPendulumTrajectory(1) },
      radius: 1,
    };

    expect(validOriginPhases("one", swing, flower(0), "TS")).toEqual([0, 4]);
    expect(
      activeHandsAreValid(buildActiveHands("one", swing, flower(0), "TS", 2))
    ).toBe(false);
  });

  it("blocks quarter timing when the red hand reverses", () => {
    const reversal: QftSessionHand = {
      source: { kind: "custom", trajectory: createPendulumTrajectory(1) },
      radius: 1,
    };

    expect(validVtgModes(flower(0), reversal, 0)).toEqual([
      "SS",
      "TS",
      "SO",
      "TO",
    ]);
  });
});

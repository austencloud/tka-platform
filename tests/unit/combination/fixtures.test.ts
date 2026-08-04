import { describe, expect, it } from "vitest";

import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

import {
  AAAA_CCW,
  ALL_FIXTURE_STEPS,
  GGGG_CW,
  GHGH,
  HHHH_CCW,
  PHI_STEP,
  PSI_STEP,
  seamsOf,
} from "./fixtures";

describe("combination fixtures", () => {
  it("GGGG is a closed 4-step loop with position continuity", () => {
    const seams = seamsOf(GGGG_CW);
    for (let i = 0; i < GGGG_CW.steps.length; i++) {
      expect(GGGG_CW.steps[i]!.startPosition).toBe(seams[i]);
    }
    for (let i = 1; i < GGGG_CW.steps.length; i++) {
      expect(GGGG_CW.steps[i]!.startPosition).toBe(
        GGGG_CW.steps[i - 1]!.endPosition
      );
    }
    expect(GGGG_CW.steps.at(-1)!.endPosition).toBe(
      GGGG_CW.steps[0]!.startPosition
    );
  });

  it("HHHH is a closed 4-step loop", () => {
    for (let i = 1; i < HHHH_CCW.steps.length; i++) {
      expect(HHHH_CCW.steps[i]!.startPosition).toBe(
        HHHH_CCW.steps[i - 1]!.endPosition
      );
    }
    expect(HHHH_CCW.steps.at(-1)!.endPosition).toBe(
      HHHH_CCW.steps[0]!.startPosition
    );
  });

  it("AAAA is a closed 4-step loop", () => {
    for (let i = 1; i < AAAA_CCW.steps.length; i++) {
      expect(AAAA_CCW.steps[i]!.startPosition).toBe(
        AAAA_CCW.steps[i - 1]!.endPosition
      );
    }
    expect(AAAA_CCW.steps.at(-1)!.endPosition).toBe(
      AAAA_CCW.steps[0]!.startPosition
    );
  });

  it("GHGH (Austen's fused example) is closed and alternates letters", () => {
    expect(GHGH.steps.map((s) => s.letter)).toEqual(["G", "H", "G", "H"]);
    for (let i = 1; i < GHGH.steps.length; i++) {
      expect(GHGH.steps[i]!.startPosition).toBe(GHGH.steps[i - 1]!.endPosition);
    }
    expect(GHGH.steps.at(-1)!.endPosition).toBe(GHGH.steps[0]!.startPosition);
  });

  it("every fixture's positions agree with getGridPositionFromLocations", () => {
    // The mapper is canon. A fixture's transcribed position label is only
    // correct if it equals the position computed from that step's own motion
    // locations — otherwise the label is the bug, not the function.
    const label = (step: StepData, edge: "start" | "end") => {
      const blue = step.motions.blue;
      const red = step.motions.red;
      return edge === "start"
        ? getGridPositionFromLocations(blue.startLocation, red.startLocation)
        : getGridPositionFromLocations(blue.endLocation, red.endLocation);
    };

    expect(ALL_FIXTURE_STEPS.length).toBeGreaterThan(0);
    for (const { name, step } of ALL_FIXTURE_STEPS) {
      expect(
        { where: `${name} start`, position: step.startPosition },
        `${name} startPosition`
      ).toEqual({ where: `${name} start`, position: label(step, "start") });
      expect(
        { where: `${name} end`, position: step.endPosition },
        `${name} endPosition`
      ).toEqual({ where: `${name} end`, position: label(step, "end") });
    }
  });

  it("every fixture sequence's start position matches its first step's seam", () => {
    for (const seq of [GGGG_CW, HHHH_CCW, GHGH, AAAA_CCW]) {
      const first = seq.steps[0]!;
      expect(seq.startPosition?.startPosition).toBe(first.startPosition);
      expect(seq.startPosition?.endPosition).toBe(first.startPosition);
      expect(seq.startPosition?.gridPosition).toBe(first.startPosition);
      // Static both-hands hold: nothing moves, nothing rotates.
      for (const color of ["blue", "red"] as const) {
        const held = seq.startPosition!.motions[color]!;
        const live = first.motions[color];
        expect(held.motionType).toBe("static");
        expect(held.rotationDirection).toBe("noRotation");
        expect(held.startLocation).toBe(live.startLocation);
        expect(held.endLocation).toBe(live.startLocation);
        expect(held.startOrientation).toBe(live.startOrientation);
        expect(held.endOrientation).toBe(live.startOrientation);
      }
    }
  });

  it("Ψ and Φ steps carry dash/static motions", () => {
    expect(PSI_STEP.letter).toBe("Ψ");
    expect(PHI_STEP.letter).toBe("Φ");
    expect(PSI_STEP.motions.blue.motionType).toBe("static");
    expect(PSI_STEP.motions.red.motionType).toBe("dash");
    expect(PHI_STEP.motions.blue.motionType).toBe("dash");
    expect(PHI_STEP.motions.red.motionType).toBe("static");
  });

  it("Ψ and Φ bridge the alpha and beta worlds the fixtures live in", () => {
    // The engine's impossibility story (AAAA + GGGG needs an ambient bridge)
    // depends on these two steps actually touching both families.
    expect(PSI_STEP.startPosition).toBe("alpha5");
    expect(PSI_STEP.endPosition).toBe("beta1");
    expect(PHI_STEP.startPosition).toBe("beta5");
    expect(PHI_STEP.endPosition).toBe("alpha5");
    expect(seamsOf(AAAA_CCW)).toContain(PSI_STEP.startPosition);
    expect(seamsOf(GGGG_CW)).toContain(PSI_STEP.endPosition);
    expect(seamsOf(GGGG_CW)).toContain(PHI_STEP.startPosition);
  });
});

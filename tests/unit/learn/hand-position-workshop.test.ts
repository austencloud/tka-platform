import { describe, expect, it, vi } from "vitest";
import {
  GridLocation,
  GridMode,
} from "../../../src/lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getPlacementGridPoints } from "../../../src/lib/shared/pictograph/grid/services/placement-grid-points";
import {
  POSITION_CHALLENGES,
  POSITION_KINDS,
  positionKindFor,
  positionExample,
  positionCorrection,
  restorePositionWorkshop,
  transformPosition,
} from "../../../src/lib/features/learn/components/interactive/positions/hand-position-lesson";
import { createPositionWorkshopState } from "../../../src/lib/features/learn/components/interactive/positions/positions-experience-state.svelte";

function memory(saved?: unknown) {
  let workshop = saved;
  return {
    load: () => ({ step: 0, phaseData: { workshop } }),
    savePhaseData: vi.fn((_key: string, value: unknown) => {
      workshop = value;
    }),
    saveStep: vi.fn(),
    reset: vi.fn(),
    getPhaseData: <T>(_key: string, fallback: T) => fallback,
  };
}

describe("hand position workshop domain", () => {
  for (const mode of [GridMode.DIAMOND, GridMode.BOX]) {
    it(`classifies all 16 ${mode} pairs and preserves families under transforms`, () => {
      const counts = { alpha: 0, beta: 0, gamma: 0 };
      const points = getPlacementGridPoints(mode);
      for (const left of points)
        for (const right of points) {
          const kind = positionKindFor(left.location, right.location)!;
          counts[kind]++;
          for (const action of ["rotate", "mirror", "swap"] as const) {
            const moved = transformPosition(
              left.location,
              right.location,
              action
            );
            expect(positionKindFor(moved.left, moved.right)).toBe(kind);
            expect(points.some((p) => p.location === moved.left)).toBe(true);
            expect(points.some((p) => p.location === moved.right)).toBe(true);
          }
        }
      expect(counts).toEqual({ alpha: 4, beta: 4, gamma: 8 });
    });

    it(`gives a valid one-hand correction for every wrong ${mode} answer`, () => {
      const points = getPlacementGridPoints(mode);
      for (const left of points)
        for (const right of points)
          for (const target of POSITION_KINDS) {
            if (positionKindFor(left.location, right.location) === target)
              continue;
            const message = positionCorrection(
              left.location,
              right.location,
              target,
              mode
            );
            const destination = points.find((point) =>
              message.endsWith(`to ${point.label}.`)
            );
            expect(destination).toBeDefined();
            expect(positionKindFor(left.location, destination!.location)).toBe(
              target
            );
          }
    });

    it(`renders examples on the selected ${mode} grid`, () => {
      const points = getPlacementGridPoints(mode);
      for (const kind of POSITION_KINDS) {
        const example = positionExample(kind, mode);
        expect(positionKindFor(example.left, example.right)).toBe(kind);
        expect(points.some((p) => p.location === example.left)).toBe(true);
        expect(points.some((p) => p.location === example.right)).toBe(true);
      }
    });
  }

  it("never mislabels incomplete, center, or mixed-grid placements as Gamma", () => {
    expect(positionKindFor(null, GridLocation.NORTH)).toBeNull();
    expect(positionKindFor(GridLocation.CENTER, GridLocation.NORTH)).toBeNull();
    expect(
      positionKindFor(GridLocation.NORTH, GridLocation.NORTHEAST)
    ).toBeNull();
  });

  it("does not trust corrupt or legacy completion checkpoints", () => {
    for (const value of [
      null,
      { version: 0, round: 6 },
      { version: 1, phase: "complete", round: -1 },
      { version: 1, phase: "complete", round: 2.5 },
      { version: 1, phase: "complete", round: 999 },
    ]) {
      expect(restorePositionWorkshop(value)).toMatchObject({
        phase: "explore",
        round: 0,
      });
    }
    expect(
      restorePositionWorkshop({ version: 1, phase: "complete", round: 2 }).phase
    ).not.toBe("complete");
  });
});

describe("self-paced practice progress", () => {
  it("requires each correct construction, invalidates edited answers, and never double-advances", () => {
    const state = createPositionWorkshopState(memory());
    expect(state.next()).toBe(false);
    state.practice();
    state.check("beta");
    expect(state.feedback).toBe("incorrect");
    expect(state.next()).toBe(false);
    state.check("alpha");
    state.edited();
    expect(state.next()).toBe(false);
    for (const question of POSITION_CHALLENGES) {
      expect(state.canFinish).toBe(false);
      state.check(question.kind);
      expect(state.next()).toBe(true);
      expect(state.next()).toBe(false);
    }
    expect(state.canFinish).toBe(true);
  });

  it("resumes completed rounds without converting old checks into new passes", () => {
    const persistence = memory();
    const first = createPositionWorkshopState(persistence);
    first.practice();
    first.check("alpha");
    first.next();
    first.check("beta");
    const resumed = createPositionWorkshopState(persistence);
    expect(resumed.round).toBe(1);
    expect(resumed.challenge?.kind).toBe("beta");
    expect(resumed.feedback).toBe("idle");
    expect(resumed.next()).toBe(false);
    resumed.explore();
    resumed.practice();
    expect(resumed.round).toBe(1);
  });

  it("opens review in exploration without overwriting the saved lesson", () => {
    const persistence = memory({
      version: 1,
      phase: "practice",
      round: 4,
      explored: ["alpha"],
    });
    const review = createPositionWorkshopState(persistence, true);
    expect(review.phase).toBe("explore");
    review.discover("gamma");
    review.practice();
    review.check("alpha");
    review.next();
    expect(persistence.savePhaseData).not.toHaveBeenCalled();
  });

  it("counts distinct discoveries, and resets practice after a completed pass", () => {
    const state = createPositionWorkshopState(
      memory({ version: 1, phase: "complete", round: 6, explored: [] })
    );
    state.discover("beta");
    state.discover("beta");
    expect(state.explored).toEqual(["beta"]);
    state.explore();
    expect(state.canFinish).toBe(true);
    state.practice();
    expect(state.round).toBe(0);
    expect(state.canFinish).toBe(false);
  });
});

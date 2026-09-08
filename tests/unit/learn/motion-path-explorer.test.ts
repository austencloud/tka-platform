import { describe, expect, it, vi } from "vitest";
import { createMotionPathExplorerState } from "../../../src/routes/(public)/guide/motion-paths/_data/motion-path-explorer-state.svelte";
import { motionPathExamples } from "../../../src/routes/(public)/guide/motion-paths/_data/motion-path-examples";
import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("motion path guide isolation", () => {
  it("keeps the underlying fixed path for floats in Hybrid", () => {
    const explorer = createMotionPathExplorerState();
    const source = structuredClone(motionPathExamples[2]!);
    source.steps[0]!.motions.left.motionType = MotionType.FLOAT;
    explorer.chooseSequence(source);
    explorer.scope.visibility.setPathPolicy({
      pathShape: "concave",
      motionAwarePaths: true,
    });
    explorer.syncPolicy();
    expect(explorer.sequence.steps[0]!.motions.left.pathShape).toBe("concave");
    expect(explorer.sequence.steps[0]!.motions.right.pathShape).toBe("arc");
  });
  it("compares authored exceptions without changing the selected source", () => {
    const explorer = createMotionPathExplorerState();
    const source = structuredClone(motionPathExamples[2]!);
    source.steps[0]!.motions.left.pathShape = "concave";
    const before = JSON.stringify(source);
    explorer.chooseSequence(source);
    explorer.scope.visibility.setPathPolicy({
      pathShape: "arc",
      motionAwarePaths: true,
    });
    explorer.syncPolicy();
    const hybridId = explorer.sequence.id;
    expect(explorer.sequence.steps[0]!.motions.left.pathShape).toBe("concave");
    expect(explorer.sequence.steps[0]!.motions.right.pathShape).toBe("arc");
    explorer.scope.visibility.setPathPolicy({
      pathShape: "arc",
      motionAwarePaths: false,
    });
    explorer.syncPolicy();
    expect(explorer.sequence.id).not.toBe(hybridId);
    expect(
      explorer.sequence.steps.every((step) =>
        Object.values(step.motions).every(
          (motion) => motion.pathShape === "arc"
        )
      )
    ).toBe(true);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("leaves stored defaults and neighboring explorers alone", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    try {
      const first = createMotionPathExplorerState();
      const second = createMotionPathExplorerState();
      first.scope.visibility.setPathPolicy({
        pathShape: "concave",
        motionAwarePaths: true,
      });
      first.syncPolicy();
      first.toggleGuides();
      first.trace = "hands";
      first.chooseExample("anti");
      expect(second.selectedPath).toBe("arc");
      expect(second.guides).toBe(true);
      expect(second.example).toBe("mixed");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps complete, closing MCP examples through the app adapter", () => {
    for (const sequence of motionPathExamples) {
      expect(sequence.steps).toHaveLength(4);
      for (const hand of ["left", "right"] as const) {
        const motions = sequence.steps.map((step) => step.motions[hand]);
        for (let index = 0; index < motions.length; index++) {
          const current = motions[index]!;
          const next = motions[(index + 1) % motions.length]!;
          expect(current.endLocation).toBe(next.startLocation);
          expect(current.endOrientation).toBe(next.startOrientation);
        }
        expect(sequence.startPosition!.motions[hand].endLocation).toBe(
          motions[0]!.startLocation
        );
      }
    }
  });
});

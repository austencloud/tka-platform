import { describe, it, expect } from "vitest";
import { PositionTransitionGraph } from "../../../src/generation/reachability/PositionTransitionGraph.js";
import type { PictographData, MotionData } from "../../../src/generation/constraints/types.js";


function makeMotion(overrides: Partial<MotionData> = {}): MotionData {
  return {
    hand: "left",
    startLocation: "n",
    endLocation: "s",
    motionType: "pro",
    rotationDirection: "cw",
    startOrientation: "in",
    endOrientation: "in",
    ...overrides,
  };
}

function variation(start: string, end: string): PictographData {
  return {
    letter: "A",
    startPosition: start,
    endPosition: end,
    timing: "together",
    direction: "together",
    leftMotion: makeMotion({ hand: "left" }),
    rightMotion: makeMotion({ hand: "right" }),
  };
}


describe("PositionTransitionGraph", () => {
  it("builds forward adjacency from variations", () => {
    const graph = new PositionTransitionGraph([
      variation("A", "B"),
      variation("A", "C"),
      variation("B", "C"),
    ]);

    expect(graph.getReachableFrom("A")).toEqual(new Set(["B", "C"]));
    expect(graph.getReachableFrom("B")).toEqual(new Set(["C"]));
    expect(graph.getReachableFrom("C")).toEqual(new Set());
  });

  it("builds reverse adjacency from variations", () => {
    const graph = new PositionTransitionGraph([
      variation("A", "B"),
      variation("A", "C"),
      variation("B", "C"),
    ]);

    expect(graph.getReachableTo("B")).toEqual(new Set(["A"]));
    expect(graph.getReachableTo("C")).toEqual(new Set(["A", "B"]));
    expect(graph.getReachableTo("A")).toEqual(new Set());
  });

  it("returns all positions from both sides", () => {
    const graph = new PositionTransitionGraph([
      variation("A", "B"),
      variation("C", "D"),
    ]);

    expect(graph.getAllPositions()).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("deduplicates multiple variations with same start/end", () => {
    // Two different letters A→B, should only appear once in adjacency
    const graph = new PositionTransitionGraph([
      variation("A", "B"),
      { ...variation("A", "B"), letter: "D" },
    ]);

    expect(graph.getReachableFrom("A")).toEqual(new Set(["B"]));
  });

  it("handles self-loops (start === end)", () => {
    const graph = new PositionTransitionGraph([
      variation("A", "A"),
    ]);

    expect(graph.getReachableFrom("A")).toEqual(new Set(["A"]));
    expect(graph.getReachableTo("A")).toEqual(new Set(["A"]));
    expect(graph.getAllPositions()).toEqual(new Set(["A"]));
  });

  it("handles empty variation set", () => {
    const graph = new PositionTransitionGraph([]);

    expect(graph.getReachableFrom("A")).toEqual(new Set());
    expect(graph.getReachableTo("A")).toEqual(new Set());
    expect(graph.getAllPositions()).toEqual(new Set());
  });
});

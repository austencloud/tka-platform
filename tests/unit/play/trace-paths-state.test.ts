import { describe, expect, it } from "vitest";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createHandPath } from "$lib/shared/foundation/services/hand-path-factory";
import {
  handPathToTraceRound,
  pairHandPathsToTraceRound,
} from "$lib/features/learn/play/games/trace-paths/services/hand-path-to-trace";
import {
  createTracePathsState,
  segmentStartPoint,
} from "$lib/features/learn/play/games/trace-paths/state/trace-paths-state.svelte";
import type { TraceSample } from "$lib/features/learn/play/games/trace-paths/domain/trace-types";

function oneHandRound() {
  return handPathToTraceRound(
    createHandPath([GridLocation.NORTH, GridLocation.EAST]),
    MotionColor.BLUE
  );
}

function twoHandRound() {
  return pairHandPathsToTraceRound(
    createHandPath([GridLocation.NORTH, GridLocation.EAST]),
    createHandPath([GridLocation.SOUTH, GridLocation.WEST])
  );
}

/** Walk the canonical route as if a finger followed it exactly. */
function samplesAlong(points: readonly { x: number; y: number }[], t0 = 0): TraceSample[] {
  return points.map((p, i) => ({ x: p.x, y: p.y, t: t0 + i * 10 }));
}

describe("trace paths state", () => {
  it("loads a round into preview and reports the start location", () => {
    const state = createTracePathsState();
    state.loadRound(oneHandRound());
    expect(state.phase.name).toBe("preview");
    expect(state.totalBeats).toBe(1);
    expect(state.statusText).toContain("north");
  });

  it("surfaces a conversion refusal as an error phase, not a crash", () => {
    const state = createTracePathsState();
    state.loadRound(
      handPathToTraceRound(createHandPath([GridLocation.NORTH]), MotionColor.BLUE)
    );
    expect(state.phase.name).toBe("error");
    expect(state.statusText.length).toBeGreaterThan(0);
  });

  it("assigns the hand from the stage it was touched on, not pointer order", () => {
    const state = createTracePathsState();
    state.loadRound(twoHandRound());
    state.beginArming();

    const redStart = segmentStartPoint(state.currentSegments[MotionColor.RED]!);
    const blueStart = segmentStartPoint(state.currentSegments[MotionColor.BLUE]!);

    // The FIRST pointer lands on red's grid. Pointer order would make it blue.
    expect(state.pointerDown(101, redStart, MotionColor.RED)).toBe(MotionColor.RED);
    expect(state.pointerDown(102, blueStart, MotionColor.BLUE)).toBe(MotionColor.BLUE);
  });

  it("ignores a third pointer with a cue and never reassigns an armed hand", () => {
    const state = createTracePathsState();
    state.loadRound(twoHandRound());
    state.beginArming();

    const blueStart = segmentStartPoint(state.currentSegments[MotionColor.BLUE]!);
    const redStart = segmentStartPoint(state.currentSegments[MotionColor.RED]!);
    state.pointerDown(1, blueStart, MotionColor.BLUE);
    state.pointerDown(2, redStart, MotionColor.RED);

    // A third finger on blue's grid: blue is taken, so it gets nothing.
    expect(state.pointerDown(3, blueStart, MotionColor.BLUE)).toBeNull();
    expect(state.cue).not.toBeNull();
  });

  it("completes a clean two-hand round and scores it", () => {
    const scored: unknown[] = [];
    const state = createTracePathsState({ onRoundScored: (o) => scored.push(o) });
    state.loadRound(twoHandRound());
    state.beginArming();

    const blueSeg = state.currentSegments[MotionColor.BLUE]!;
    const redSeg = state.currentSegments[MotionColor.RED]!;
    if (blueSeg.kind !== "move" || redSeg.kind !== "move") throw new Error("expected moves");

    state.pointerDown(1, blueSeg.expectedPath[0]!, MotionColor.BLUE);
    state.pointerDown(2, redSeg.expectedPath[0]!, MotionColor.RED);
    state.pointerMove(1, samplesAlong(blueSeg.expectedPath));
    state.pointerMove(2, samplesAlong(redSeg.expectedPath));

    expect(state.phase.name).toBe("feedback");
    if (state.phase.name !== "feedback") throw new Error("unreachable");
    expect(state.phase.metrics.coverage).toBe(1);
    expect(state.phase.metrics.divergence).toBeNull();
    expect(state.phase.score.points).toBeGreaterThan(0);
    expect(scored).toHaveLength(1);
  });

  it("treats a pointer interruption as a pause that keeps completed beats", () => {
    const state = createTracePathsState();
    state.loadRound(twoHandRound());
    state.beginArming();

    const blueSeg = state.currentSegments[MotionColor.BLUE]!;
    if (blueSeg.kind !== "move") throw new Error("expected a move");
    state.pointerDown(1, blueSeg.expectedPath[0]!, MotionColor.BLUE);
    state.pointerMove(1, samplesAlong(blueSeg.expectedPath.slice(0, 6)));

    state.pointerInterrupted(1);
    expect(state.phase.name).toBe("paused");
    if (state.phase.name !== "paused") throw new Error("unreachable");
    expect(state.phase.reason).toBe("pointer-lost");

    state.resume();
    expect(state.phase.name).toBe("arming");
    // The round did not restart or fail.
    expect(state.totalBeats).toBe(1);
  });

  it("scopes pointer ids to the round so a recycled id can't claim a hand", () => {
    const state = createTracePathsState();
    state.loadRound(twoHandRound());
    state.beginArming();
    const blueSeg = state.currentSegments[MotionColor.BLUE]!;
    if (blueSeg.kind !== "move") throw new Error("expected a move");
    state.pointerDown(7, blueSeg.expectedPath[0]!, MotionColor.BLUE);

    // New round; pointer 7 is stale. Moving it must be a no-op, not a stray
    // sample fed into the fresh evaluator.
    state.loadRound(twoHandRound());
    state.beginArming();
    state.pointerMove(7, samplesAlong(blueSeg.expectedPath));
    expect(state.phase.name).toBe("arming");
  });

  it("completes via Tap Route in order only, and claims no trace score", () => {
    const outcomes: { assisted: boolean; score: { points: number } }[] = [];
    const state = createTracePathsState({
      onRoundScored: (o) => outcomes.push(o as never),
    });
    state.loadRound(twoHandRound());
    state.setSetting("tapRouteMode", true);
    state.beginArming();

    expect(state.tapWaypoints).toHaveLength(2);
    // Out of order is refused.
    expect(state.tapWaypoint(1)).toBe(false);
    expect(state.tapWaypoint(0)).toBe(true);
    expect(state.tapWaypoint(1)).toBe(true);

    expect(state.phase.name).toBe("feedback");
    expect(outcomes[0]!.assisted).toBe(true);
    expect(outcomes[0]!.score.points).toBe(0);
  });

  it("steps through the route for keyboard and screen-reader users", () => {
    const state = createTracePathsState();
    state.loadRound(twoHandRound());
    expect(state.previewText).toContain("Beat 1");
    expect(state.previewText).toContain("Blue");
    state.stepPreview(-1);
    expect(state.previewBeat).toBe(0);
    state.completeStepThrough();
    expect(state.phase.name).toBe("feedback");
  });
});

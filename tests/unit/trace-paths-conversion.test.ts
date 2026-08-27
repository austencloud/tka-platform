/**
 * Trace Paths — content → trace conversion.
 *
 * These lock the properties the game is unplayable without: order and
 * direction survive the conversion, a broken chain is reported rather than
 * repaired, and a hand that stays put gets a hold instead of a zero-length
 * move. Fixtures go through the real domain factories so a shape change over
 * there breaks this file instead of quietly diverging from it.
 */

import { describe, it, expect } from "vitest";

import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createHandPath } from "$lib/shared/foundation/services/hand-path-factory";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

import { sequenceToTraceRound } from "$lib/features/learn/play/games/trace-paths/services/sequence-to-trace";
import {
  handPathToTraceRound,
  pairHandPathsToTraceRound,
} from "$lib/features/learn/play/games/trace-paths/services/hand-path-to-trace";
import type {
  TraceHand,
  TraceRound,
  TraceSegment,
} from "$lib/features/learn/play/games/trace-paths/domain/trace-types";

// Fixtures

/** One hand's motion for one beat. Equal endpoints build a genuine STATIC. */
function handMotion(
  color: MotionColor,
  start: GridLocation,
  end: GridLocation
): MotionData {
  const still = start === end;
  return createMotionData({
    color,
    startLocation: start,
    endLocation: end,
    motionType: still ? MotionType.STATIC : MotionType.PRO,
    rotationDirection: still
      ? RotationDirection.NO_ROTATION
      : RotationDirection.CLOCKWISE,
    gridMode: GridMode.DIAMOND,
  });
}

/**
 * Build a two-hand sequence from per-hand location walks. `blue`/`red` are
 * full location lists (start + one entry per beat), so `["n","e","s"]` is two
 * beats: n→e then e→s.
 */
function twoHandSequence(
  blue: readonly GridLocation[],
  red: readonly GridLocation[],
  options: { withStartPosition?: boolean } = {}
) {
  const beatCount = blue.length - 1;
  const steps: StepData[] = [];

  for (let i = 0; i < beatCount; i++) {
    steps.push(
      createStepData({
        stepNumber: i + 1,
        motions: {
          [MotionColor.BLUE]: handMotion(
            MotionColor.BLUE,
            blue[i] as GridLocation,
            blue[i + 1] as GridLocation
          ),
          [MotionColor.RED]: handMotion(
            MotionColor.RED,
            red[i] as GridLocation,
            red[i + 1] as GridLocation
          ),
        },
      })
    );
  }

  return createSequenceData({
    id: "fixture-sequence",
    word: "TEST",
    gridMode: GridMode.DIAMOND,
    steps,
    ...(options.withStartPosition
      ? {
          startPosition: createStartPositionData({
            motions: {
              [MotionColor.BLUE]: handMotion(
                MotionColor.BLUE,
                blue[0] as GridLocation,
                blue[0] as GridLocation
              ),
              [MotionColor.RED]: handMotion(
                MotionColor.RED,
                red[0] as GridLocation,
                red[0] as GridLocation
              ),
            },
          }),
        }
      : {}),
  });
}

/** Unwrap a result that is expected to have converted, failing loudly if it didn't. */
function expectOk(
  result: ReturnType<typeof sequenceToTraceRound>
): TraceRound {
  if (!result.ok) {
    throw new Error(
      `expected conversion to succeed, got ${result.error.code}: ${result.error.message}`
    );
  }
  return result.round;
}

/** The end location of a segment, whichever kind it is. */
function segmentEnd(segment: TraceSegment): GridLocation {
  return segment.kind === "move" ? segment.end : segment.location;
}

function walkOf(round: TraceRound, hand: TraceHand): GridLocation[] {
  const trace = round.hands[hand];
  if (!trace) throw new Error(`round has no ${hand} hand`);
  return [trace.start, ...trace.segments.map(segmentEnd)];
}

// ---------------------------------------------------------------------------

describe("sequenceToTraceRound", () => {
  it("preserves every hand's ordered start and end locations", () => {
    const blueWalk = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ] as const;
    const redWalk = [
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.NORTH,
      GridLocation.EAST,
    ] as const;

    const round = expectOk(
      sequenceToTraceRound(
        twoHandSequence(blueWalk, redWalk, { withStartPosition: true })
      )
    );

    expect(walkOf(round, MotionColor.BLUE)).toEqual([...blueWalk]);
    expect(walkOf(round, MotionColor.RED)).toEqual([...redWalk]);

    // One beat per step, indexed in order, both hands present on each.
    expect(round.beats).toHaveLength(3);
    expect(round.beats.map((b) => b.index)).toEqual([0, 1, 2]);
    for (const beat of round.beats) {
      expect(beat.segments[MotionColor.BLUE]).toBeDefined();
      expect(beat.segments[MotionColor.RED]).toBeDefined();
    }
  });

  it("keeps direction, not just the set of locations", () => {
    const forward = expectOk(
      sequenceToTraceRound(
        twoHandSequence(
          [GridLocation.NORTH, GridLocation.EAST],
          [GridLocation.SOUTH, GridLocation.WEST]
        )
      )
    );
    const reversed = expectOk(
      sequenceToTraceRound(
        twoHandSequence(
          [GridLocation.EAST, GridLocation.NORTH],
          [GridLocation.WEST, GridLocation.SOUTH]
        )
      )
    );

    const forwardBlue = forward.hands[MotionColor.BLUE]?.segments[0];
    const reversedBlue = reversed.hands[MotionColor.BLUE]?.segments[0];
    expect(forwardBlue?.kind).toBe("move");
    expect(reversedBlue?.kind).toBe("move");

    if (forwardBlue?.kind !== "move" || reversedBlue?.kind !== "move") {
      throw new Error("expected move segments");
    }
    expect(forwardBlue.start).toBe(GridLocation.NORTH);
    expect(forwardBlue.end).toBe(GridLocation.EAST);
    expect(reversedBlue.start).toBe(GridLocation.EAST);
    expect(reversedBlue.end).toBe(GridLocation.NORTH);

    // The sampled routes run opposite ways, so the first point of one is the
    // last point of the other.
    const f = forwardBlue.expectedPath;
    const r = reversedBlue.expectedPath;
    expect(f[0]?.x).toBeCloseTo(r[r.length - 1]?.x as number, 6);
    expect(f[0]?.y).toBeCloseTo(r[r.length - 1]?.y as number, 6);
  });

  it("reports a domain error naming the hand and beat when a beat does not chain", () => {
    // Red teleports: beat 2 starts at north although beat 1 left it at west.
    const steps: StepData[] = [
      createStepData({
        stepNumber: 1,
        motions: {
          [MotionColor.BLUE]: handMotion(
            MotionColor.BLUE,
            GridLocation.NORTH,
            GridLocation.EAST
          ),
          [MotionColor.RED]: handMotion(
            MotionColor.RED,
            GridLocation.SOUTH,
            GridLocation.WEST
          ),
        },
      }),
      createStepData({
        stepNumber: 2,
        motions: {
          [MotionColor.BLUE]: handMotion(
            MotionColor.BLUE,
            GridLocation.EAST,
            GridLocation.SOUTH
          ),
          [MotionColor.RED]: handMotion(
            MotionColor.RED,
            GridLocation.NORTH,
            GridLocation.EAST
          ),
        },
      }),
    ];

    const result = sequenceToTraceRound(
      createSequenceData({ id: "broken", word: "TEST", steps })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a discontinuity error");
    expect(result.error.code).toBe("discontinuous-beat");
    expect(result.error.hand).toBe(MotionColor.RED);
    expect(result.error.beatIndex).toBe(1);
  });

  it("does not silently repair a discontinuity", () => {
    const result = sequenceToTraceRound(
      createSequenceData({
        id: "broken-start",
        word: "TEST",
        steps: [
          createStepData({
            stepNumber: 1,
            motions: {
              [MotionColor.BLUE]: handMotion(
                MotionColor.BLUE,
                GridLocation.NORTH,
                GridLocation.EAST
              ),
              [MotionColor.RED]: handMotion(
                MotionColor.RED,
                GridLocation.SOUTH,
                GridLocation.WEST
              ),
            },
          }),
        ],
        // The start position disagrees with beat 1: blue is parked at west but
        // beat 1 wants it to leave from north.
        startPosition: createStartPositionData({
          motions: {
            [MotionColor.BLUE]: handMotion(
              MotionColor.BLUE,
              GridLocation.WEST,
              GridLocation.WEST
            ),
            [MotionColor.RED]: handMotion(
              MotionColor.RED,
              GridLocation.SOUTH,
              GridLocation.SOUTH
            ),
          },
        }),
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a discontinuity error");
    expect(result.error.code).toBe("discontinuous-beat");
    expect(result.error.hand).toBe(MotionColor.BLUE);
    expect(result.error.beatIndex).toBe(0);
  });

  it("turns a held (static) motion into a hold, never a zero-length move", () => {
    const round = expectOk(
      sequenceToTraceRound(
        twoHandSequence(
          // Blue stays put on beat 1, then travels on beat 2.
          [GridLocation.NORTH, GridLocation.NORTH, GridLocation.EAST],
          [GridLocation.SOUTH, GridLocation.WEST, GridLocation.NORTH]
        )
      )
    );

    const blueSegments = round.hands[MotionColor.BLUE]?.segments ?? [];
    expect(blueSegments[0]).toEqual({
      kind: "hold",
      location: GridLocation.NORTH,
    });
    expect(blueSegments[1]?.kind).toBe("move");

    // No move segment anywhere may have identical endpoints.
    for (const trace of Object.values(round.hands)) {
      for (const segment of trace.segments) {
        if (segment.kind === "move") {
          expect(segment.start).not.toBe(segment.end);
        }
      }
    }
  });

  it("reports a domain error when a participating hand goes missing mid-round", () => {
    const steps: StepData[] = [
      createStepData({
        stepNumber: 1,
        motions: {
          [MotionColor.BLUE]: handMotion(
            MotionColor.BLUE,
            GridLocation.NORTH,
            GridLocation.EAST
          ),
          [MotionColor.RED]: handMotion(
            MotionColor.RED,
            GridLocation.SOUTH,
            GridLocation.WEST
          ),
        },
      }),
      // Red omitted: createStepData fills it with an invisible placeholder.
      createStepData({
        stepNumber: 2,
        motions: {
          [MotionColor.BLUE]: handMotion(
            MotionColor.BLUE,
            GridLocation.EAST,
            GridLocation.SOUTH
          ),
        },
      }),
    ];

    const result = sequenceToTraceRound(
      createSequenceData({ id: "dropped-hand", word: "TEST", steps })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a missing-hand error");
    expect(result.error.code).toBe("missing-hand-motion");
    expect(result.error.hand).toBe(MotionColor.RED);
    expect(result.error.beatIndex).toBe(1);
  });

  it("converts a single-hand sequence with only that hand populated", () => {
    const steps: StepData[] = [
      createStepData({
        stepNumber: 1,
        motions: {
          [MotionColor.BLUE]: handMotion(
            MotionColor.BLUE,
            GridLocation.NORTH,
            GridLocation.EAST
          ),
        },
      }),
    ];

    const round = expectOk(
      sequenceToTraceRound(
        createSequenceData({ id: "solo", word: "TEST", steps })
      )
    );

    expect(Object.keys(round.hands)).toEqual([MotionColor.BLUE]);
    expect(round.beats[0]?.segments[MotionColor.RED]).toBeUndefined();
  });

  it("refuses an empty sequence", () => {
    const result = sequenceToTraceRound(
      createSequenceData({ id: "empty", word: "", steps: [] })
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an empty-round error");
    expect(result.error.code).toBe("empty-round");
  });

  it("carries the sequence's grid mode onto the round", () => {
    const sequence = createSequenceData({
      id: "boxed",
      word: "TEST",
      gridMode: GridMode.BOX,
      steps: [
        createStepData({
          stepNumber: 1,
          motions: {
            [MotionColor.BLUE]: handMotion(
              MotionColor.BLUE,
              GridLocation.NORTHEAST,
              GridLocation.SOUTHEAST
            ),
          },
        }),
      ],
    });

    expect(expectOk(sequenceToTraceRound(sequence)).gridMode).toBe(GridMode.BOX);
  });
});

describe("handPathToTraceRound", () => {
  it("populates only the one hand", () => {
    const path = createHandPath([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
    ]);

    const result = handPathToTraceRound(path);
    const round = expectOk(result);

    expect(Object.keys(round.hands)).toEqual([MotionColor.BLUE]);
    expect(round.hands[MotionColor.RED]).toBeUndefined();
    expect(walkOf(round, MotionColor.BLUE)).toEqual([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
    ]);
    expect(round.beats).toHaveLength(2);
    for (const beat of round.beats) {
      expect(beat.segments[MotionColor.RED]).toBeUndefined();
    }
  });

  it("can be assigned to the red hand instead", () => {
    const path = createHandPath([GridLocation.WEST, GridLocation.NORTH]);
    const round = expectOk(handPathToTraceRound(path, MotionColor.RED));

    expect(Object.keys(round.hands)).toEqual([MotionColor.RED]);
    expect(walkOf(round, MotionColor.RED)).toEqual([
      GridLocation.WEST,
      GridLocation.NORTH,
    ]);
  });

  it("refuses a path with nothing to trace", () => {
    const result = handPathToTraceRound(createHandPath([GridLocation.NORTH]));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an empty-round error");
    expect(result.error.code).toBe("empty-round");
  });
});

describe("pairHandPathsToTraceRound", () => {
  it("puts two equal-length paths on one beat timeline", () => {
    const blue = createHandPath([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
    ]);
    const red = createHandPath([
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.NORTH,
    ]);

    const round = expectOk(pairHandPathsToTraceRound(blue, red));

    expect(round.beats).toHaveLength(2);
    expect(walkOf(round, MotionColor.BLUE)).toEqual([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
    ]);
    expect(walkOf(round, MotionColor.RED)).toEqual([
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.NORTH,
    ]);
    for (const beat of round.beats) {
      expect(beat.segments[MotionColor.BLUE]).toBeDefined();
      expect(beat.segments[MotionColor.RED]).toBeDefined();
    }
  });

  it("errors when the two paths cover different numbers of beats", () => {
    const blue = createHandPath([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
    ]);
    const red = createHandPath([GridLocation.SOUTH, GridLocation.WEST]);

    const result = pairHandPathsToTraceRound(blue, red);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected an unequal-length error");
    expect(result.error.code).toBe("unequal-hand-path-lengths");
  });
});

describe("normalized geometry", () => {
  it("keeps every expected-path point inside the 0..1 stage", () => {
    const round = expectOk(
      sequenceToTraceRound(
        twoHandSequence(
          // Covers an arc (adjacent points) and a dash (opposite points).
          [
            GridLocation.NORTH,
            GridLocation.EAST,
            GridLocation.WEST,
            GridLocation.WEST,
          ],
          [
            GridLocation.SOUTH,
            GridLocation.WEST,
            GridLocation.EAST,
            GridLocation.NORTH,
          ]
        )
      )
    );

    let checked = 0;
    for (const trace of Object.values(round.hands)) {
      for (const segment of trace.segments) {
        if (segment.kind !== "move") continue;
        expect(segment.expectedPath.length).toBeGreaterThan(1);
        for (const point of segment.expectedPath) {
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(1);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(1);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("starts and ends each sampled route at its own endpoints", () => {
    const round = expectOk(
      sequenceToTraceRound(
        twoHandSequence(
          [GridLocation.NORTH, GridLocation.EAST],
          [GridLocation.SOUTH, GridLocation.WEST]
        )
      )
    );

    const blue = round.hands[MotionColor.BLUE]?.segments[0];
    const red = round.hands[MotionColor.RED]?.segments[0];
    if (blue?.kind !== "move" || red?.kind !== "move") {
      throw new Error("expected move segments");
    }

    // Blue leaves north and arrives east; red leaves south and arrives west.
    // In the 950-space grid north is above centre (y < 0.5) and east is right
    // of it (x > 0.5), which is what the normalized endpoints must show.
    const blueFirst = blue.expectedPath[0];
    const blueLast = blue.expectedPath[blue.expectedPath.length - 1];
    expect(blueFirst?.y).toBeLessThan(0.5);
    expect(blueLast?.x).toBeGreaterThan(0.5);

    const redFirst = red.expectedPath[0];
    const redLast = red.expectedPath[red.expectedPath.length - 1];
    expect(redFirst?.y).toBeGreaterThan(0.5);
    expect(redLast?.x).toBeLessThan(0.5);
  });
});

/**
 * HandPathDataBuilder Tests
 *
 * These tests cover two things: parsing the hand-path ID string into typed
 * GridLocation arrays, and converting a trace into PictographData beats.
 * Bugs here are silent — a wrong motion type or handPath direction would
 * render the wrong arrow on the card without throwing.
 */

import { describe, it, expect } from "vitest";
import { HandPathDataBuilder } from "$lib/features/choreo-card/services/implementations/HandPathDataBuilder";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionType,
  MotionColor,
  HandPath,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

// ============================================================================
// HELPERS
// ============================================================================

// Standard 9-location trace (8 beats) used across multiple tests.
// Blue: n→e→e→s→s→w→w→n→n  (clockwise around the diamond, back to start)
// Red:  s→w→w→n→n→e→e→s→s  (same motion starting from south)
const STANDARD_ID =
  "n→e→e→s→s→w→w→n→n|s→w→w→n→n→e→e→s→s";

// ============================================================================
// PARSE HAND PATH ID
// ============================================================================

describe("HandPathDataBuilder.parseHandPathId", () => {
  const builder = new HandPathDataBuilder();

  it("parses 9 blue locations from the standard trace", () => {
    const trace = builder.parseHandPathId(STANDARD_ID);
    expect(trace.blue).toHaveLength(9);
  });

  it("parses 9 red locations from the standard trace", () => {
    const trace = builder.parseHandPathId(STANDARD_ID);
    expect(trace.red).toHaveLength(9);
  });

  it("maps blue locations to correct GridLocation enum values", () => {
    const trace = builder.parseHandPathId(STANDARD_ID);
    expect(trace.blue).toEqual([
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.WEST,
      GridLocation.NORTH,
      GridLocation.NORTH,
    ]);
  });

  it("maps red locations to correct GridLocation enum values", () => {
    const trace = builder.parseHandPathId(STANDARD_ID);
    expect(trace.red).toEqual([
      GridLocation.SOUTH,
      GridLocation.WEST,
      GridLocation.WEST,
      GridLocation.NORTH,
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.SOUTH,
    ]);
  });

  it("handles intercardinal locations (ne, se, sw, nw)", () => {
    const intercardinalId =
      "ne→se→sw→nw→ne|nw→sw→se→ne→nw";
    const trace = builder.parseHandPathId(intercardinalId);
    expect(trace.blue).toEqual([
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
      GridLocation.NORTHEAST,
    ]);
    expect(trace.red).toEqual([
      GridLocation.NORTHWEST,
      GridLocation.SOUTHWEST,
      GridLocation.SOUTHEAST,
      GridLocation.NORTHEAST,
      GridLocation.NORTHWEST,
    ]);
  });

  it("throws on a missing pipe separator", () => {
    expect(() => builder.parseHandPathId("n→e→s")).toThrow();
  });
});

// ============================================================================
// BUILD FROM TRACE
// ============================================================================

describe("HandPathDataBuilder.buildFromTrace", () => {
  const builder = new HandPathDataBuilder();

  // Re-use the same parsed trace for all beat-level assertions.
  const trace = builder.parseHandPathId(STANDARD_ID);

  it("produces 8 beats from a 9-location trace", () => {
    const beats = builder.buildFromTrace(trace);
    expect(beats).toHaveLength(8);
  });

  it("sets null letter on all beats", () => {
    const beats = builder.buildFromTrace(trace);
    for (const beat of beats) {
      expect(beat.letter).toBeNull();
    }
  });

  it("sets DIAMOND grid mode on all beats", () => {
    const beats = builder.buildFromTrace(trace);
    for (const beat of beats) {
      expect(beat.gridMode).toBe(GridMode.DIAMOND);
    }
  });

  it("sets HAND prop type on all blue motions", () => {
    const beats = builder.buildFromTrace(trace);
    for (const beat of beats) {
      expect(beat.motions[MotionColor.BLUE]?.propType).toBe(PropType.HAND);
    }
  });

  it("sets HAND prop type on all red motions", () => {
    const beats = builder.buildFromTrace(trace);
    for (const beat of beats) {
      expect(beat.motions[MotionColor.RED]?.propType).toBe(PropType.HAND);
    }
  });

  it("sets FLOAT motion type when hand moves (n→e)", () => {
    // Beat 1: blue goes n→e (moves), red goes s→w (moves)
    const beats = builder.buildFromTrace(trace);
    const beat1 = beats[0]!;
    expect(beat1.motions[MotionColor.BLUE]?.motionType).toBe(MotionType.FLOAT);
  });

  it("sets 'fl' turns when hand moves", () => {
    const beats = builder.buildFromTrace(trace);
    const beat1 = beats[0]!;
    expect(beat1.motions[MotionColor.BLUE]?.turns).toBe("fl");
  });

  it("records correct start and end locations for a float beat", () => {
    // Beat 1: blue n→e
    const beats = builder.buildFromTrace(trace);
    const blue1 = beats[0]!.motions[MotionColor.BLUE]!;
    expect(blue1.startLocation).toBe(GridLocation.NORTH);
    expect(blue1.endLocation).toBe(GridLocation.EAST);
  });

  it("sets STATIC motion type when hand stays at the same location (e→e)", () => {
    // Beat 2: blue e→e (static), red w→w (static)
    const beats = builder.buildFromTrace(trace);
    const beat2 = beats[1]!;
    expect(beat2.motions[MotionColor.BLUE]?.motionType).toBe(MotionType.STATIC);
  });

  it("sets 0 turns when hand stays", () => {
    const beats = builder.buildFromTrace(trace);
    const beat2 = beats[1]!;
    expect(beat2.motions[MotionColor.BLUE]?.turns).toBe(0);
  });

  it("sets STATIC handPath when hand doesn't move", () => {
    // Beat 2: blue e→e
    const beats = builder.buildFromTrace(trace);
    const beat2 = beats[1]!;
    expect(beat2.motions[MotionColor.BLUE]?.handPath).toBe(HandPath.STATIC);
  });

  it("derives CW handPath for N→E", () => {
    // Beat 1: blue n→e
    const beats = builder.buildFromTrace(trace);
    expect(beats[0]!.motions[MotionColor.BLUE]?.handPath).toBe(
      HandPath.CLOCKWISE
    );
  });

  it("derives CW handPath for S→W", () => {
    // Beat 1: red s→w
    const beats = builder.buildFromTrace(trace);
    expect(beats[0]!.motions[MotionColor.RED]?.handPath).toBe(
      HandPath.CLOCKWISE
    );
  });

  it("derives CCW handPath for E→N", () => {
    // Build a trace where blue goes e→n (counter-clockwise step)
    const ccwTrace = {
      blue: [GridLocation.EAST, GridLocation.NORTH],
      red: [GridLocation.WEST, GridLocation.WEST],
    };
    const beats = builder.buildFromTrace(ccwTrace);
    expect(beats[0]!.motions[MotionColor.BLUE]?.handPath).toBe(
      HandPath.COUNTER_CLOCKWISE
    );
  });

  it("derives DASH handPath for opposite locations (N→S)", () => {
    const dashTrace = {
      blue: [GridLocation.NORTH, GridLocation.SOUTH],
      red: [GridLocation.WEST, GridLocation.WEST],
    };
    const beats = builder.buildFromTrace(dashTrace);
    expect(beats[0]!.motions[MotionColor.BLUE]?.handPath).toBe(HandPath.DASH);
  });

  it("sets DASH motionType for opposite locations (N→S)", () => {
    const dashTrace = {
      blue: [GridLocation.NORTH, GridLocation.SOUTH],
      red: [GridLocation.EAST, GridLocation.EAST],
    };
    const beats = builder.buildFromTrace(dashTrace);
    expect(beats[0]!.motions[MotionColor.BLUE]?.motionType).toBe(MotionType.DASH);
    expect(beats[0]!.motions[MotionColor.BLUE]?.turns).toBe(0);
  });

  it("derives HASH_IN for perimeter → center", () => {
    const hashTrace = {
      blue: [GridLocation.NORTH, GridLocation.CENTER],
      red: [GridLocation.SOUTH, GridLocation.SOUTH],
    };
    const beats = builder.buildFromTrace(hashTrace);
    expect(beats[0]!.motions[MotionColor.BLUE]?.handPath).toBe(HandPath.HASH_IN);
    expect(beats[0]!.motions[MotionColor.BLUE]?.motionType).toBe(MotionType.DASH);
  });

  it("derives HASH_OUT for center → perimeter", () => {
    const hashTrace = {
      blue: [GridLocation.CENTER, GridLocation.EAST],
      red: [GridLocation.SOUTH, GridLocation.SOUTH],
    };
    const beats = builder.buildFromTrace(hashTrace);
    expect(beats[0]!.motions[MotionColor.BLUE]?.handPath).toBe(HandPath.HASH_OUT);
    expect(beats[0]!.motions[MotionColor.BLUE]?.motionType).toBe(MotionType.DASH);
  });

  it("generates deterministic beat IDs for the same trace", () => {
    const beats1 = builder.buildFromTrace(trace);
    const beats2 = builder.buildFromTrace(trace);
    for (let i = 0; i < beats1.length; i++) {
      expect(beats1[i]!.id).toBe(beats2[i]!.id);
    }
  });

  it("generates different beat IDs for different traces", () => {
    const altTrace = {
      blue: [
        GridLocation.EAST,
        GridLocation.SOUTH,
        GridLocation.WEST,
        GridLocation.NORTH,
        GridLocation.EAST,
        GridLocation.SOUTH,
        GridLocation.WEST,
        GridLocation.NORTH,
        GridLocation.EAST,
      ],
      red: trace.red,
    };
    const beats1 = builder.buildFromTrace(trace);
    const beats2 = builder.buildFromTrace(altTrace);
    expect(beats1[0]!.id).not.toBe(beats2[0]!.id);
  });

  it("embeds beat index in the ID (beat-1, beat-2...)", () => {
    const beats = builder.buildFromTrace(trace);
    for (let i = 0; i < beats.length; i++) {
      expect(beats[i]!.id).toContain(`beat-${i + 1}`);
    }
  });
});

// ============================================================================
// BUILD FROM HAND PATH ID (integration)
// ============================================================================

describe("HandPathDataBuilder.buildFromHandPathId", () => {
  const builder = new HandPathDataBuilder();

  it("produces the same result as parseHandPathId + buildFromTrace", () => {
    const viaId = builder.buildFromHandPathId(STANDARD_ID);
    const viaTrace = builder.buildFromTrace(
      builder.parseHandPathId(STANDARD_ID)
    );
    expect(viaId).toHaveLength(viaTrace.length);
    for (let i = 0; i < viaId.length; i++) {
      expect(viaId[i]!.id).toBe(viaTrace[i]!.id);
    }
  });
});

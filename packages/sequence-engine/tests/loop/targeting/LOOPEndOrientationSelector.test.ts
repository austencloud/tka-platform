/**
 * LOOPEndOrientationSelector — per-type closure rules.
 *
 * Locks the required-end-orientation mapping for each (loopType, period,
 * domain) combination. Future beam-search-native closure will consume these
 * values to prune states that can't reach a closing end.
 */

import { describe, it, expect } from "vitest";
import { LOOPEndOrientationSelector } from "../../../src/loop/targeting/LOOPEndOrientationSelector.js";
import { LOOPType } from "../../../src/loop/loop-types.js";

const selector = new LOOPEndOrientationSelector();

describe("LOOPEndOrientationSelector", () => {
  it("ROTATED location-domain period 2: end orientation equals start", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.ROTATED,
      period: 2,
      domain: "location",
      blueStartOrientation: "in",
      redStartOrientation: "out",
    });
    expect(result.blueEndOrientation).toBe("in");
    expect(result.redEndOrientation).toBe("out");
  });

  it("ROTATED orientation-domain period 4: end orientation advances by 1 quarter", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.ROTATED,
      period: 4,
      domain: "orientation",
      blueStartOrientation: "in",
      redStartOrientation: "in",
    });
    expect(result.blueEndOrientation).toBe("clock");
    expect(result.redEndOrientation).toBe("clock");
  });

  it("ROTATED orientation-domain wraps from counter → in", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.ROTATED,
      period: 4,
      domain: "orientation",
      blueStartOrientation: "counter",
      redStartOrientation: "counter",
    });
    expect(result.blueEndOrientation).toBe("in");
    expect(result.redEndOrientation).toBe("in");
  });

  it("MIRRORED period 2: end orientation equals start", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.MIRRORED,
      period: 2,
      domain: "location",
      blueStartOrientation: "clock",
      redStartOrientation: "in",
    });
    expect(result.blueEndOrientation).toBe("clock");
    expect(result.redEndOrientation).toBe("in");
  });

  it("SWAPPED period 2: end orientations are blue/red-swapped from start", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.SWAPPED,
      period: 2,
      domain: "location",
      blueStartOrientation: "in",
      redStartOrientation: "out",
    });
    // Blue must end at what red started with so pass 2 picks up cleanly.
    expect(result.blueEndOrientation).toBe("out");
    expect(result.redEndOrientation).toBe("in");
  });

  it("INVERTED period 2: end orientation equals start", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.INVERTED,
      period: 2,
      domain: "location",
      blueStartOrientation: "in",
      redStartOrientation: "in",
    });
    expect(result.blueEndOrientation).toBe("in");
    expect(result.redEndOrientation).toBe("in");
  });

  it("FLIPPED period 2: end orientation equals start", () => {
    const result = selector.determineEndOrientations({
      loopType: LOOPType.FLIPPED,
      period: 2,
      domain: "location",
      blueStartOrientation: "clock",
      redStartOrientation: "counter",
    });
    expect(result.blueEndOrientation).toBe("clock");
    expect(result.redEndOrientation).toBe("counter");
  });
});

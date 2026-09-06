import { describe, expect, it } from "vitest";
import {
  cycle,
  downbeatEvents,
  nextDownbeat,
  placementFromPositions,
  spatialPhase,
  timePhase,
  timingFromPhases,
  type Rotation,
} from "../../../src/lib/features/learn/components/interactive/motions/timing-intro-phase";

describe("placement is not timing", () => {
  it("keeps east/west alpha while rotation determines its downbeat timing", () => {
    expect(placementFromPositions(0.25, 0.75)).toBe("alpha");
    expect(timingFromPhases(timePhase(0.25, 1), timePhase(0.75, 1))).toBe(
      "split"
    );
    expect(timingFromPhases(timePhase(0.25, 1), timePhase(0.75, -1))).toBe(
      "together"
    );
    expect(timingFromPhases(timePhase(0.25, -1), timePhase(0.75, 1))).toBe(
      "together"
    );
  });
  it("observes both east/west dots arriving at the bottom together", () => {
    for (const time of [0, 0.25, 0.5, 0.75, 1])
      expect(timingFromPhases(time + 0.25, time + 0.25)).toBe("together");
    expect(spatialPhase(1, 1)).toBe(0);
    expect(spatialPhase(1, -1)).toBe(0);
    expect(
      placementFromPositions(spatialPhase(0.5, 1), spatialPhase(0.5, -1))
    ).toBe("beta");
  });
  it("round-trips any position through either rotation without moving it", () => {
    for (const direction of [1, -1] as Rotation[])
      for (const position of [0, 0.25, 0.5, 0.75, 0.123])
        expect(
          spatialPhase(timePhase(position, direction), direction)
        ).toBeCloseTo(position);
  });
  it("does not call arbitrary offsets quarter timing or intermediate placements gamma", () => {
    expect(timingFromPhases(0, 0.1)).toBe("offset");
    expect(placementFromPositions(0, 0.1)).toBe("between");
  });
  it("schedules actual downbeat crossings and skips the current event when stepping", () => {
    for (const offset of [0, 0.25, 0.5, 0.75, -2.25])
      for (const event of downbeatEvents(offset))
        expect(cycle(event + offset)).toBeCloseTo(0);
    expect(nextDownbeat(0, [0.25, 0.25])).toBe(0.75);
    expect(nextDownbeat(0.75, [0.25, 0.25])).toBe(1.75);
    expect(nextDownbeat(0, [0, 0.5])).toBe(0.5);
    expect(nextDownbeat(0.5, [0, 0.5])).toBe(1);
  });
});

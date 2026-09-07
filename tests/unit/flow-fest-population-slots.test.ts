import { describe, expect, it } from "vitest";
import {
  FLOW_FEST_SLOT_RELEASE_MARGIN_METERS,
  FLOW_FEST_SLOT_SWAP_MARGIN_METERS,
  assignFlowFestPopulationSlots,
} from "../../src/routes/test/flow-fest-sim/flow-fest-population-slots";

const CULL = 100;

describe("Flow Fest population render slots", () => {
  it("fills free slots nearest-first", () => {
    expect(
      assignFlowFestPopulationSlots([-1, -1, -1], [40, 10, 25, 5], 3, CULL)
    ).toEqual([3, 1, 2]);
  });

  it("changes nothing when nothing changed", () => {
    const held = [4, 1, -1];
    expect(
      assignFlowFestPopulationSlots(held, [50, 20, 60, 70, 10], 2, CULL)
    ).toEqual(held);
  });

  it("keeps a held person who is no longer among the nearest", () => {
    // Agent 0 is held at 20 m. Agent 1 waits at 12 m: closer, but not by the
    // swap margin, so the body on screen stays who it was.
    expect(FLOW_FEST_SLOT_SWAP_MARGIN_METERS).toBe(12);
    expect(assignFlowFestPopulationSlots([0], [20, 12], 1, CULL)).toEqual([0]);
  });

  it("swaps for a clear win, one person per pass", () => {
    // Two far people are held; two near people wait. Only the farthest held
    // slot changes hands this pass; the other waits for the next one.
    expect(
      assignFlowFestPopulationSlots([0, 1], [40, 45, 5, 6], 2, CULL)
    ).toEqual([0, 2]);
    expect(
      assignFlowFestPopulationSlots([0, 2], [40, 45, 5, 6], 2, CULL)
    ).toEqual([3, 2]);
  });

  it("releases a held person only well past the cull radius", () => {
    expect(FLOW_FEST_SLOT_RELEASE_MARGIN_METERS).toBe(8);
    const kept = assignFlowFestPopulationSlots([0], [CULL + 7], 1, CULL);
    expect(kept).toEqual([0]);
    const released = assignFlowFestPopulationSlots([0], [CULL + 9], 1, CULL);
    expect(released).toEqual([-1]);
  });

  it("never mounts anyone beyond the cull radius", () => {
    expect(
      assignFlowFestPopulationSlots([-1, -1], [CULL + 1, 30], 2, CULL)
    ).toEqual([1, -1]);
  });

  it("drops people the fire circle renders and never mounts them", () => {
    const infinity = Number.POSITIVE_INFINITY;
    expect(
      assignFlowFestPopulationSlots([0, -1], [infinity, 10, infinity], 2, CULL)
    ).toEqual([1, -1]);
  });

  it("releases the farthest people first when the budget shrinks", () => {
    expect(
      assignFlowFestPopulationSlots([0, 1, 2], [30, 50, 10], 1, CULL)
    ).toEqual([-1, -1, 2]);
  });
});

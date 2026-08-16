/**
 * The pedestal standard's two load-bearing claims.
 *
 * 1. Every pedestal in the museum puts the prop circle on the visitor's eye
 *    line. That rule — not a fixed height — is the constant, because Water
 *    stands its performers 0.7 m below the walking line and a single number
 *    cannot serve both a level floor and a sunken alcove.
 * 2. A bilateral prop draws two figures, a unilateral prop draws one.
 */
import { describe, it, expect } from "vitest";
import {
  PEDESTAL_MIN_H,
  PERFORMER_PROP_CENTRE_ABOVE_FEET,
  faceTraceCount,
  propIsBilateral,
  sizePedestal,
} from "../../../src/lib/features/museum/domain/pedestal-standard";
import {
  buildDrownedGalleryLayout,
  CAUSEWAY_Y,
  EYE_ABOVE_FLOOR,
  SHELF_Y,
} from "../../../src/lib/features/museum/data/drowned-gallery-terrain";
import { buildVulcanCaveFloorPlan } from "../../../src/lib/features/museum/data/vulcan-cave-floor-plan";

describe("pedestal standard", () => {
  it("lands the prop circle on the visitor's eye line from a sunken shelf", () => {
    const sizing = sizePedestal(SHELF_Y, CAUSEWAY_Y, EYE_ABOVE_FLOOR);
    const propCircleY = sizing.topY + PERFORMER_PROP_CENTRE_ABOVE_FEET;
    expect(propCircleY).toBeCloseTo(CAUSEWAY_Y + EYE_ABOVE_FLOOR, 9);
    expect(sizing.flooredToMinimum).toBe(false);
  });

  it("collapses to a low disc when performer and visitor share a floor", () => {
    // The opener case: nothing needs lifting, so the same object the alcoves
    // turn into a stanchion comes out as a step rather than raising the
    // drawing above the visitor's head. It is still derived, not floored —
    // the eye line genuinely wants a quarter metre here.
    const level = sizePedestal(CAUSEWAY_Y, CAUSEWAY_Y, EYE_ABOVE_FLOOR);
    const sunken = sizePedestal(SHELF_Y, CAUSEWAY_Y, EYE_ABOVE_FLOOR);

    expect(level.flooredToMinimum).toBe(false);
    expect(level.height).toBeCloseTo(
      EYE_ABOVE_FLOOR - PERFORMER_PROP_CENTRE_ABOVE_FEET,
      9
    );
    // Same object, same rule, and the sunken one is nearly a metre taller.
    expect(sunken.height - level.height).toBeCloseTo(CAUSEWAY_Y - SHELF_Y, 9);
    // Both still put the drawing on exactly the same eye line.
    expect(level.topY + PERFORMER_PROP_CENTRE_ABOVE_FEET).toBeCloseTo(
      sunken.topY + PERFORMER_PROP_CENTRE_ABOVE_FEET,
      9
    );
  });

  it("never emits a pedestal shorter than the visible minimum", () => {
    // A performer floor ABOVE the eye line would derive a negative height.
    const sizing = sizePedestal(5, CAUSEWAY_Y, EYE_ABOVE_FLOOR);
    expect(sizing.height).toBe(PEDESTAL_MIN_H);
    expect(sizing.topY).toBe(5 + PEDESTAL_MIN_H);
  });

  it("counts traces by prop bilaterality", () => {
    expect(propIsBilateral("staff")).toBe(true);
    expect(propIsBilateral("fan")).toBe(false);
    expect(faceTraceCount("staff")).toBe(2);
    expect(faceTraceCount("Staff")).toBe(2);
    expect(faceTraceCount("fan")).toBe(1);
    expect(faceTraceCount("club")).toBe(1);
  });
});

describe("drowned gallery pedestals", () => {
  const plan = buildVulcanCaveFloorPlan();
  const layout = buildDrownedGalleryLayout(plan.grid);
  if (!layout) throw new Error("drowned gallery layout missing");

  const pedestals = layout.exhibitFixtures.filter(
    (f) => f.kind === "pedestal" || f.kind === "opener-pedestal"
  );

  it("gives every case a pedestal and the opener one too", () => {
    expect(pedestals).toHaveLength(4);
    expect(pedestals.filter((f) => f.kind === "opener-pedestal")).toHaveLength(1);
  });

  it("binds every pedestal to a sequence, because the face is generated", () => {
    for (const pedestal of pedestals) {
      expect(pedestal.sequenceId, pedestal.id).toBeTruthy();
    }
  });

  it("stands each case showcase on its own pedestal's top face", () => {
    for (const pedestal of pedestals) {
      if (pedestal.kind !== "pedestal") continue;
      const showcase = layout.exhibitFixtures.find(
        (f) => f.kind === "case-showcase" && f.caseWord === pedestal.caseWord
      );
      expect(showcase, `showcase for ${pedestal.caseWord}`).toBeDefined();
      expect(showcase!.baseY).toBeCloseTo(pedestal.baseY + pedestal.height, 9);
    }
  });
});

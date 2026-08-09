import { describe, expect, it } from "vitest";
import {
  buildEarthLongTerracePlanForGrid,
  buildNominalEarthLongTerracePlan,
  earthLongTerraceApparentBodyHeightDegrees,
  earthLongTerraceInteractionGap,
  earthLongTerraceMaximumGrade,
  earthLongTerraceMinimumFloorMargin,
  earthLongTerraceRouteLength,
  earthLongTerraceViewingSamples,
  isEarthLongTerraceBodyInsideFinalFrame,
  isEarthLongTerraceSightlineBlocked,
} from "$lib/features/museum/data/earth-long-terrace-plan";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";

describe("Earth Long Terrace Gate 1 candidate", () => {
  const nominal = buildNominalEarthLongTerracePlan();

  it("uses the compiled Earth shell and its real Fire and Air doors", () => {
    const cave = buildVulcanCaveFloorPlan();
    const plan = buildEarthLongTerracePlanForGrid(cave.grid);

    expect(plan).not.toBeNull();
    expect(plan!.room.maxX - plan!.room.minX).toBe(34);
    expect(plan!.room.maxZ - plan!.room.minZ).toBe(24);
    expect(plan!.westDoor).toEqual({ min: 12.25, max: 14.25 });
    // Matches the Earth contract's recorded exit span. The three-channels
    // Drowned Gallery revision briefly grew the Flooded Gallery to 30 × 30 m
    // and shifted this +2.5; that revision was rejected (2026-08-09) and the
    // gallery is back at its "Ring" footprint, so the span is back too.
    expect(plan!.southDoor).toEqual({ min: 114.25, max: 116.25 });
    expect(plan!.walkPath[0]).toEqual(
      expect.objectContaining({
        x: plan!.room.minX,
        z: (plan!.westDoor.min + plan!.westDoor.max) / 2,
      })
    );
    expect(plan!.walkPath.at(-1)).toEqual(
      expect.objectContaining({
        x: (plan!.southDoor.min + plan!.southDoor.max) / 2,
        z: plan!.room.maxZ,
      })
    );
  });

  it("locks the room to the real G, H, and I museum performers", () => {
    expect(
      nominal.performers.map(({ id, performerId, sequenceId }) => ({
        id,
        performerId,
        sequenceId,
      }))
    ).toEqual([
      {
        id: "g",
        performerId: "cave-earth-automaton-g",
        sequenceId: "cave-earth-seq-g",
      },
      {
        id: "h",
        performerId: "cave-earth-automaton-h",
        sequenceId: "cave-earth-seq-h",
      },
      {
        id: "i",
        performerId: "cave-earth-automaton-i",
        sequenceId: "cave-earth-seq-i",
      },
    ]);
    expect(nominal.performerClock).toEqual({
      timing: "together",
      handPath: "same",
      loop: "continuous",
    });
  });

  it("gives each live sequence a flat stage with safe prop spacing", () => {
    for (const performer of nominal.performers) {
      expect(performer.stageElevation).toBe(-4.2);
      expect(performer.stageRadius).toBe(1.4);
    }

    for (let index = 0; index < nominal.performers.length - 1; index += 1) {
      const left = nominal.performers[index]!;
      const right = nominal.performers[index + 1]!;
      const centreSpacing = Math.hypot(
        right.centre.x - left.centre.x,
        right.centre.z - left.centre.z
      );
      expect(centreSpacing).toBe(3.5);
      expect(centreSpacing - left.stageRadius - right.stageRadius).toBeCloseTo(
        0.7
      );
    }
  });

  it("keeps the forward route inside the shell at an accessible grade", () => {
    for (const point of nominal.walkPath) {
      expect(point.x).toBeGreaterThanOrEqual(nominal.room.minX);
      expect(point.x).toBeLessThanOrEqual(nominal.room.maxX);
      expect(point.z).toBeGreaterThanOrEqual(nominal.room.minZ);
      expect(point.z).toBeLessThanOrEqual(nominal.room.maxZ);
    }

    expect(earthLongTerraceRouteLength(nominal)).toBeGreaterThan(43);
    expect(earthLongTerraceRouteLength(nominal)).toBeLessThan(50);
    expect(earthLongTerraceMaximumGrade(nominal)).toBeLessThanOrEqual(1 / 16);
    expect(nominal.routeWidth).toBe(2.4);
    expect(nominal.stops.map((stop) => stop.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  it("conceals the trio at Fire and reveals all three together at Earth", () => {
    const threshold = nominal.stops.find(
      (stop) => stop.id === "fire-threshold"
    )!;
    const reveal = nominal.stops.find((stop) => stop.id === "trio-reveal")!;

    for (const performer of nominal.performers) {
      expect(
        isEarthLongTerraceSightlineBlocked(nominal, threshold, performer.centre)
      ).toBe(true);
      expect(
        isEarthLongTerraceSightlineBlocked(nominal, reveal, performer.centre)
      ).toBe(false);
    }
  });

  it("proves floor visibility over the entire legal viewing ribbon", () => {
    const samples = earthLongTerraceViewingSamples(nominal);
    expect(samples.length).toBeGreaterThan(900);

    for (const sample of samples) {
      for (const performer of nominal.performers) {
        expect(
          isEarthLongTerraceSightlineBlocked(nominal, sample, performer.centre)
        ).toBe(false);
      }
    }

    expect(earthLongTerraceMinimumFloorMargin(nominal)).toBeGreaterThan(0.35);
  });

  it("makes each comparison readable and enlarges the trio at the final stand", () => {
    const comparisonStops = nominal.stops.filter((stop) =>
      stop.id.startsWith("performer-")
    );
    for (const [index, stop] of comparisonStops.entries()) {
      expect(
        earthLongTerraceApparentBodyHeightDegrees(
          nominal,
          stop,
          nominal.performers[index]!
        )
      ).toBeGreaterThanOrEqual(8);
    }

    for (const performer of nominal.performers) {
      expect(
        earthLongTerraceApparentBodyHeightDegrees(
          nominal,
          nominal.finalCamera.position,
          performer
        )
      ).toBeGreaterThanOrEqual(9.5);
      expect(isEarthLongTerraceBodyInsideFinalFrame(nominal, performer)).toBe(
        true
      );
    }
  });

  it("overlaps adjacent interaction zones so the continuous trio has no dead gap", () => {
    expect(earthLongTerraceInteractionGap(nominal, 0)).toBeLessThanOrEqual(0);
    expect(earthLongTerraceInteractionGap(nominal, 1)).toBeLessThanOrEqual(0);
  });

  it("reserves lush habitat around the route without making vegetation the hero", () => {
    expect(nominal.habitatMasses).toHaveLength(5);
    const planArea = nominal.habitatMasses.reduce(
      (total, mass) => total + Math.PI * mass.radiusX * mass.radiusZ,
      0
    );
    expect(planArea).toBeGreaterThan(75);
    expect(nominal.habitatMasses.every((mass) => mass.label.length > 0)).toBe(
      true
    );
  });
});

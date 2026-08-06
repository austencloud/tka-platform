import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import { computeRoomDimensions } from "$lib/features/museum/domain/wall-segment-types";
import {
  FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM,
  FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES,
  buildFirstFireProcessionPlan,
  buildFirstFireProcessionPlanForGrid,
  buildNominalFirstFireProcessionPlan,
  isProcessionSightlineBlocked,
  sampleProcessionPath,
  type FireProcessionShrine,
} from "$lib/features/museum/data/first-fire-procession-plan";

const plan = buildNominalFirstFireProcessionPlan();
const EPSILON = 1e-6;

function distanceToRect(
  point: { x: number; z: number },
  rect: { minX: number; maxX: number; minZ: number; maxZ: number }
): number {
  const dx = Math.max(rect.minX - point.x, 0, point.x - rect.maxX);
  const dz = Math.max(rect.minZ - point.z, 0, point.z - rect.maxZ);
  return Math.hypot(dx, dz);
}

function orbitOuterRadius(shrine: FireProcessionShrine): number {
  return shrine.orbitRadius + shrine.orbitWidth / 2;
}

describe("First Fire Torch Procession floor plan", () => {
  it("locks the measured room and builder authoring minimum", () => {
    expect(FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES).toEqual({
      width: 60,
      depth: 30,
    });
    expect(FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM).toEqual({
      width: 80,
      height: 40,
    });
    expect(plan.room).toEqual({ minX: 0, maxX: 60, minZ: 0, maxZ: 30 });

    const emptyWall = { segments: [], minMargin: 1 } as const;
    const compiled = computeRoomDimensions({
      walls: {
        north: emptyWall,
        south: emptyWall,
        east: emptyWall,
        west: emptyWall,
      },
      minInteriorWidth: FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM.width,
      minInteriorHeight: FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM.height,
    });
    expect({
      widthMetres: (compiled.w - 2) * 0.5,
      depthMetres: (compiled.h - 2) * 0.5,
    }).toEqual({ widthMetres: 60, depthMetres: 30 });
  });

  it("keeps the review drawing on the measured coordinate contract", () => {
    const drawing = readFileSync(
      resolve(
        "docs/superpowers/specs/2026-08-06-first-fire-torch-procession-floor-plan.svg"
      ),
      "utf8"
    );
    expect(drawing).toContain('data-plan-width-metres="60"');
    expect(drawing).toContain('data-plan-depth-metres="30"');
    expect(drawing).toContain('data-dj-centre="16.5,8.5"');
    expect(drawing).toContain('data-ek-centre="31.5,21.5"');
    expect(drawing).toContain('data-fl-centre="47,8.5"');
  });

  it("keeps the existing DJ, EK and FL performer and sequence roster", () => {
    expect(
      plan.shrines.map(({ id, performerId, sequenceId }) => ({
        id,
        performerId,
        sequenceId,
      }))
    ).toEqual([
      {
        id: "dj",
        performerId: "cave-fire-automaton-dj",
        sequenceId: "cave-fire-seq-dj",
      },
      {
        id: "ek",
        performerId: "cave-fire-automaton-ek",
        sequenceId: "cave-fire-seq-ek",
      },
      {
        id: "fl",
        performerId: "cave-fire-automaton-fl",
        sequenceId: "cave-fire-seq-fl",
      },
    ]);
  });

  it("proves why the production Fire shell must be resized", () => {
    const current = buildVulcanCaveFloorPlan();
    expect(() => buildFirstFireProcessionPlanForGrid(current.grid)).toThrow(
      /requires a 60 m by 30 m interior; compiled cave-fire is 46\.5 m by 20\.5 m/
    );
  });

  it("rejects any ad hoc smaller frame", () => {
    expect(() =>
      buildFirstFireProcessionPlan({
        room: { minX: 0, maxX: 59.9, minZ: 0, maxZ: 30 },
        westDoor: { min: 14, max: 16 },
        eastDoor: { min: 27, max: 29 },
      })
    ).toThrow(/requires a 60 m by 30 m interior/);
  });

  it("connects Water to Earth through every authored section", () => {
    expect(plan.pathSections.map((section) => section.id)).toEqual([
      "water-to-steam",
      "ember-bridge",
      "torch-field-to-dj",
      "dj-orbit",
      "dj-to-ek",
      "ek-orbit",
      "ek-to-fl",
      "fl-orbit",
      "earth-growth-path",
    ]);
    for (let index = 1; index < plan.pathSections.length; index++) {
      expect(plan.pathSections[index - 1]!.points.at(-1)).toEqual(
        plan.pathSections[index]!.points[0]
      );
    }
    expect(plan.walkPath[0]).toEqual({ x: 0, z: 15 });
    expect(plan.walkPath.at(-1)).toEqual({ x: 60, z: 28 });
  });

  it("keeps every circulation sample inside the room and out of rock", () => {
    const samples = sampleProcessionPath(plan, 0.2);
    for (const sample of samples) {
      expect(sample.x).toBeGreaterThanOrEqual(plan.room.minX - EPSILON);
      expect(sample.x).toBeLessThanOrEqual(plan.room.maxX + EPSILON);
      expect(sample.z).toBeGreaterThanOrEqual(plan.room.minZ - EPSILON);
      expect(sample.z).toBeLessThanOrEqual(plan.room.maxZ + EPSILON);
      for (const occluder of plan.occluders.filter(
        (candidate) => candidate.kind === "rock-rib"
      )) {
        expect(
          distanceToRect(sample, occluder.rect),
          `${sample.x.toFixed(2)},${sample.z.toFixed(2)} clips ${occluder.id}`
        ).toBeGreaterThanOrEqual(1.15);
      }
    }
  });

  it("fits every complete shrine orbit and keeps shrine footprints separate", () => {
    for (const shrine of plan.shrines) {
      const radius = orbitOuterRadius(shrine);
      expect(shrine.centre.x - radius).toBeGreaterThan(plan.room.minX);
      expect(shrine.centre.x + radius).toBeLessThan(plan.room.maxX);
      expect(shrine.centre.z - radius).toBeGreaterThan(plan.room.minZ);
      expect(shrine.centre.z + radius).toBeLessThan(plan.room.maxZ);
      expect(shrine.orbitSweepDegrees).toSatisfy(
        (sweep: number) => Math.abs(sweep) === 240
      );
    }
    for (let first = 0; first < plan.shrines.length; first++) {
      for (let second = first + 1; second < plan.shrines.length; second++) {
        const a = plan.shrines[first]!;
        const b = plan.shrines[second]!;
        const distance = Math.hypot(
          b.centre.x - a.centre.x,
          b.centre.z - a.centre.z
        );
        expect(distance).toBeGreaterThan(
          orbitOuterRadius(a) + orbitOuterRadius(b)
        );
      }
    }
  });

  it("uses overlapping orbit zones so a boundary event cannot strand progress", () => {
    for (const shrine of plan.shrines) {
      expect(shrine.activationZones).toHaveLength(4);
      const direction = Math.sign(shrine.orbitSweepDegrees);
      for (let index = 1; index < shrine.activationZones.length; index++) {
        const previous = shrine.activationZones[index - 1]!;
        const current = shrine.activationZones[index]!;
        const previousEnd = previous.startDegrees + previous.sweepDegrees;
        expect(
          Math.abs(previousEnd - current.startDegrees),
          `${shrine.id} zones ${index} and ${index + 1}`
        ).toBe(20);
        expect(Math.sign(current.sweepDegrees)).toBe(direction);
      }
    }
  });

  it("blocks every performer pair with authored rock", () => {
    const rock = plan.occluders.filter(
      (occluder) => occluder.kind === "rock-rib"
    );
    for (let first = 0; first < plan.shrines.length; first++) {
      for (let second = first + 1; second < plan.shrines.length; second++) {
        expect(
          isProcessionSightlineBlocked(
            plan.shrines[first]!.centre,
            plan.shrines[second]!.centre,
            rock
          ),
          `${plan.shrines[first]!.id} can see ${plan.shrines[second]!.id}`
        ).toBe(true);
      }
    }
  });

  it("never exposes two performers from a sampled visitor position", () => {
    const offenders = sampleProcessionPath(plan, 0.2).flatMap((sample) => {
      const visible = plan.shrines.filter(
        (shrine) =>
          !isProcessionSightlineBlocked(sample, shrine.centre, plan.occluders)
      );
      return visible.length > 1
        ? [
            `${sample.x.toFixed(2)},${sample.z.toFixed(2)} sees ${visible.map((s) => s.id).join("+")}`,
          ]
        : [];
    });
    expect(offenders.slice(0, 12)).toEqual([]);
  });

  it("caps detailed fire at one shrine while keeping a dense static field", () => {
    expect(plan.torchBudget).toEqual({
      fieldStems: 72,
      perimeterStemsPerShrine: 18,
      maximumDetailedShrines: 1,
    });
    expect(
      plan.torchBudget.fieldStems +
        plan.torchBudget.perimeterStemsPerShrine * plan.shrines.length
    ).toBe(126);
  });
});

import { describe, expect, it } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import { computeRoomDimensions } from "$lib/features/museum/domain/wall-segment-types";
import {
  FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM,
  FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES,
  buildFirstFireProcessionPlan,
  buildFirstFireProcessionPlanForGrid,
  buildNominalFirstFireProcessionPlan,
  isProcessionSightlineBlocked,
  pointInProcessionPolygon,
  sampleProcessionPath,
  type FireProcessionPathSection,
  type FireProcessionShrine,
} from "$lib/features/museum/data/first-fire-procession-plan";

const plan = buildNominalFirstFireProcessionPlan();
const EPSILON = 1e-6;

function compiledInterior(width: number, height: number) {
  const emptyWall = { segments: [], minMargin: 1 } as const;
  const compiled = computeRoomDimensions({
    walls: { north: emptyWall, south: emptyWall, east: emptyWall, west: emptyWall },
    minInteriorWidth: width,
    minInteriorHeight: height,
  });
  return { width: (compiled.w - 2) * 0.5, depth: (compiled.h - 2) * 0.5 };
}

function sampleSection(section: FireProcessionPathSection, spacing = 0.2) {
  const samples: Array<{ x: number; z: number }> = [];
  for (let index = 0; index < section.points.length - 1; index++) {
    const from = section.points[index]!;
    const to = section.points[index + 1]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / spacing));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      samples.push({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t });
    }
  }
  samples.push(section.points.at(-1)!);
  return samples;
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function orbitOuterRadius(shrine: FireProcessionShrine) {
  return shrine.orbitRadius + shrine.orbitWidth / 2;
}

describe("First Fire Cinder Court measured plan", () => {
  it("locks the isolated 58 by 44 metre shell, doors, centre and returning hub", () => {
    expect(FIRST_FIRE_PROCESSION_MIN_INTERIOR_METRES).toEqual({ width: 58, depth: 44 });
    expect(plan.room).toEqual({ minX: 0, maxX: 58, minZ: 0, maxZ: 44 });
    expect(plan.centre).toEqual({ x: 29, z: 22 });
    expect(plan.westDoor).toEqual({ min: 20, max: 24 });
    expect(plan.eastDoor).toEqual({ min: 32, max: 36 });
    expect(plan.hub).toEqual({ minX: 13.5, maxX: 26.5, minZ: 15.5, maxZ: 28.5 });
    expect(plan.hubCircle).toEqual({ centre: { x: 20, z: 22 }, radius: 6.5 });
    expect(plan.hub.maxX - plan.hub.minX).toBe(13);
    expect(plan.hub.maxZ - plan.hub.minZ).toBe(13);
  });

  it("captures the integer authoring trap and accepts the first non-stretched size", () => {
    expect(FIRST_FIRE_PROCESSION_AUTHORING_MINIMUM).toEqual({ width: 77, height: 59 });
    expect(compiledInterior(77, 58)).toEqual({ width: 58, depth: 43.5 });
    expect(compiledInterior(77, 59)).toEqual({ width: 58, depth: 44.5 });
    expect(() => buildFirstFireProcessionPlan({
      room: { minX: 0, maxX: 58, minZ: 0, maxZ: 43.5 },
      westDoor: { min: 19.75, max: 23.75 },
      eastDoor: { min: 31.75, max: 35.75 },
    })).toThrow(/requires a 58 m by 44 m interior/);
    expect(() => buildFirstFireProcessionPlan({
      room: { minX: 0, maxX: 58, minZ: 0, maxZ: 44.5 },
      westDoor: { min: 20.25, max: 24.25 },
      eastDoor: { min: 32.25, max: 36.25 },
    })).not.toThrow();
  });

  it("keeps the current live 46.5 by 20.5 Fire room out of this isolated Gate 2", () => {
    expect(() => buildFirstFireProcessionPlanForGrid(buildVulcanCaveFloorPlan().grid)).toThrow(
      /requires a 58 m by 44 m interior; compiled cave-fire is 46\.5 m by 20\.5 m/
    );
  });

  it("preserves the DJ, EK and FL roster and measured court anchors", () => {
    expect(plan.shrines.map(({ id, performerId, sequenceId, centre }) => ({ id, performerId, sequenceId, centre }))).toEqual([
      { id: "dj", performerId: "cave-fire-automaton-dj", sequenceId: "cave-fire-seq-dj", centre: { x: 8.9, z: 9.5 } },
      { id: "ek", performerId: "cave-fire-automaton-ek", sequenceId: "cave-fire-seq-ek", centre: { x: 9, z: 29.1 } },
      { id: "fl", performerId: "cave-fire-automaton-fl", sequenceId: "cave-fire-seq-fl", centre: { x: 46.5, z: 10 } },
    ]);
  });

  it("uses one visible 3.5 metre gate and one shared entry/exit throat per shrine", () => {
    expect(plan.gates.map(({ id, shrineId, width }) => ({ id, shrineId, width }))).toEqual([
      { id: "dj-gate", shrineId: "dj", width: 3.5 },
      { id: "ek-gate", shrineId: "ek", width: 3.5 },
      { id: "fl-gate", shrineId: "fl", width: 3.5 },
    ]);
    for (const shrine of plan.shrines) {
      const gate = plan.gates.find((candidate) => candidate.id === shrine.gateId)!;
      expect(shrine.entry).toEqual(gate.courtThreshold);
      expect(shrine.exit).toEqual(gate.courtThreshold);
      expect(isProcessionSightlineBlocked(gate.hubApproach, gate.beacon, plan.basaltMasses)).toBe(false);
      expect(isProcessionSightlineBlocked(gate.hubApproach, shrine.centre, plan.basaltMasses)).toBe(true);
      expect(isProcessionSightlineBlocked(gate.courtThreshold, shrine.centre, plan.basaltMasses)).toBe(false);
    }
  });

  it("returns through the hub after every court and reaches both doors continuously", () => {
    expect(plan.pathSections.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: "water-to-hub", kind: "water-approach" },
      { id: "hub-to-dj", kind: "shrine-approach" },
      { id: "dj-orbit", kind: "shrine-orbit" },
      { id: "dj-return-to-hub", kind: "shrine-return" },
      { id: "hub-to-ek", kind: "shrine-approach" },
      { id: "ek-orbit", kind: "shrine-orbit" },
      { id: "ek-return-to-hub", kind: "shrine-return" },
      { id: "hub-to-fl", kind: "shrine-approach" },
      { id: "fl-orbit", kind: "shrine-orbit" },
      { id: "fl-return-to-hub", kind: "shrine-return" },
      { id: "earth-growth-path", kind: "growth-path" },
    ]);
    for (let index = 1; index < plan.pathSections.length; index++) {
      expect(plan.pathSections[index - 1]!.points.at(-1)).toEqual(plan.pathSections[index]!.points[0]);
    }
    expect(plan.walkPath[0]).toEqual({ x: 0, z: 22 });
    expect(plan.walkPath.at(-1)).toEqual({ x: 58, z: 34 });
    for (const id of ["dj-return-to-hub", "ek-return-to-hub", "fl-return-to-hub"]) {
      const end = plan.pathSections.find((section) => section.id === id)!.points.at(-1)!;
      expect(end.x).toBeGreaterThanOrEqual(plan.hub.minX);
      expect(end.x).toBeLessThanOrEqual(plan.hub.maxX);
      expect(end.z).toBeGreaterThanOrEqual(plan.hub.minZ);
      expect(end.z).toBeLessThanOrEqual(plan.hub.maxZ);
    }
  });

  it("keeps the full route in bounds, at least 2.4 m wide, and outside permanent rock", () => {
    expect(plan.pathSections.every((section) => section.width >= 2.4)).toBe(true);
    for (const sample of sampleProcessionPath(plan, 0.2)) {
      expect(sample.x).toBeGreaterThanOrEqual(plan.room.minX - EPSILON);
      expect(sample.x).toBeLessThanOrEqual(plan.room.maxX + EPSILON);
      expect(sample.z).toBeGreaterThanOrEqual(plan.room.minZ - EPSILON);
      expect(sample.z).toBeLessThanOrEqual(plan.room.maxZ + EPSILON);
      for (const mass of plan.basaltMasses) {
        expect(pointInProcessionPolygon(sample, mass.polygon), `${sample.x.toFixed(2)},${sample.z.toFixed(2)} enters ${mass.id}`).toBe(false);
      }
    }
  });

  it("keeps paths out of fire trenches and unrelated shrine courts", () => {
    for (const section of plan.pathSections) {
      for (const sample of sampleSection(section)) {
        for (const shrine of plan.shrines) {
          expect(distance(sample, shrine.centre), `${section.id} enters ${shrine.id} trench`).toBeGreaterThanOrEqual(shrine.trenchOuterRadius + section.width / 2 - EPSILON);
          if (section.shrineId !== shrine.id) {
            expect(pointInProcessionPolygon(sample, shrine.courtPolygon), `${section.id} enters unrelated ${shrine.id} court`).toBe(false);
          }
        }
      }
    }
    for (const shrine of plan.shrines) {
      expect(orbitOuterRadius(shrine)).toBeGreaterThan(shrine.trenchOuterRadius);
    }
  });

  it("provides four overlapping no-prompt zones around every complete orbit", () => {
    for (const shrine of plan.shrines) {
      expect(Math.abs(shrine.orbitSweepDegrees)).toBe(360);
      expect(shrine.activationZones).toHaveLength(4);
      for (let index = 1; index < shrine.activationZones.length; index++) {
        const previous = shrine.activationZones[index - 1]!;
        const current = shrine.activationZones[index]!;
        expect(Math.abs(previous.startDegrees + previous.sweepDegrees - current.startDegrees)).toBe(20);
      }
    }
  });

  it("uses permanent basalt to block every performer pair", () => {
    for (let first = 0; first < plan.shrines.length; first++) {
      for (let second = first + 1; second < plan.shrines.length; second++) {
        expect(isProcessionSightlineBlocked(plan.shrines[first]!.centre, plan.shrines[second]!.centre, plan.basaltMasses), `${plan.shrines[first]!.id} sees ${plan.shrines[second]!.id}`).toBe(true);
      }
    }
  });

  it("never exposes two performers at 0.2 m samples in either travel direction", () => {
    for (const direction of ["forward", "reverse"] as const) {
      const offenders = sampleProcessionPath(plan, 0.2, direction).flatMap((sample) => {
        const visible = plan.shrines.filter((shrine) => !isProcessionSightlineBlocked(sample, shrine.centre, plan.basaltMasses));
        return visible.length > 1 ? [`${direction} ${sample.x.toFixed(2)},${sample.z.toFixed(2)} sees ${visible.map((shrine) => shrine.id).join("+")}`] : [];
      });
      expect(offenders.slice(0, 16)).toEqual([]);
    }
  });

  it("keeps all fire guides non-colliding and the static budget at 126", () => {
    expect(plan.guidePaths.every((guide) => guide.collision === false)).toBe(true);
    expect(plan.torchBudget).toEqual({ fieldStems: 72, perimeterStemsPerShrine: 18, maximumDetailedShrines: 1 });
    expect(plan.torchBudget.fieldStems + plan.torchBudget.perimeterStemsPerShrine * plan.shrines.length).toBe(126);
  });

  it("uses extra compiled depth as symmetric rock margin without stretching geometry", () => {
    const deeper = buildFirstFireProcessionPlan({
      room: { minX: 0, maxX: 58, minZ: 0, maxZ: 44.5 },
      westDoor: { min: 20.25, max: 24.25 },
      eastDoor: { min: 32.25, max: 36.25 },
    });
    expect(deeper.hub.minZ - plan.hub.minZ).toBeCloseTo(0.25, 12);
    expect(deeper.hub.maxZ - plan.hub.maxZ).toBeCloseTo(0.25, 12);
    expect(deeper.hub.maxX - deeper.hub.minX).toBe(20);
    expect(deeper.hub.maxZ - deeper.hub.minZ).toBe(18);
    for (let index = 0; index < plan.shrines.length; index++) {
      expect(deeper.shrines[index]!.centre.x).toBe(plan.shrines[index]!.centre.x);
      expect(deeper.shrines[index]!.centre.z - plan.shrines[index]!.centre.z).toBeCloseTo(0.25, 12);
      expect(deeper.shrines[index]!.orbitRadius).toBeCloseTo(plan.shrines[index]!.orbitRadius, 12);
    }
  });
});

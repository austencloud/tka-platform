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

  it("preserves the DJ, EK and FL roster with three different court silhouettes", () => {
    expect(plan.shrines.map(({ id, performerId, sequenceId, silhouette, centre }) => ({ id, performerId, sequenceId, silhouette, centre }))).toEqual([
      { id: "dj", performerId: "cave-fire-automaton-dj", sequenceId: "cave-fire-seq-dj", silhouette: "canyon-slot", centre: { x: 6, z: 6.1 } },
      { id: "ek", performerId: "cave-fire-automaton-ek", sequenceId: "cave-fire-seq-ek", silhouette: "sunken-bowl", centre: { x: 18, z: 38 } },
      { id: "fl", performerId: "cave-fire-automaton-fl", sequenceId: "cave-fire-seq-fl", silhouette: "chimney-rotunda", centre: { x: 42, z: 10 } },
    ]);
    expect(new Set(plan.shrines.map((shrine) => shrine.silhouette)).size).toBe(3);
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

  it("provides four overlapping no-prompt zones scaled to each court's viewing sweep", () => {
    expect(Object.fromEntries(plan.shrines.map((shrine) => [shrine.id, shrine.orbitSweepDegrees]))).toEqual({
      dj: -50,
      ek: 360,
      fl: -360,
    });
    for (const shrine of plan.shrines) {
      expect(shrine.activationZones).toHaveLength(4);
      const overlap = (Math.abs(shrine.orbitSweepDegrees) * 20) / 360;
      for (let index = 1; index < shrine.activationZones.length; index++) {
        const previous = shrine.activationZones[index - 1]!;
        const current = shrine.activationZones[index]!;
        expect(Math.abs(previous.startDegrees + previous.sweepDegrees - current.startDegrees)).toBeCloseTo(overlap, 9);
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

  it("carries its clear widths in carved geometry, not just as declared numbers", () => {
    // Perpendicular ray-march from every route sample to the first rock hit.
    const MARCH_MAX = 3.5;
    const MARCH_STEP = 0.05;
    const insideRock = (point: { x: number; z: number }) =>
      plan.basaltMasses.some((mass) => pointInProcessionPolygon(point, mass.polygon));
    const march = (
      origin: { x: number; z: number },
      nx: number,
      nz: number
    ): { t: number; id: string } => {
      for (let t = MARCH_STEP; t <= MARCH_MAX; t += MARCH_STEP) {
        const point = { x: origin.x + nx * t, z: origin.z + nz * t };
        const hit = plan.basaltMasses.find((mass) =>
          pointInProcessionPolygon(point, mass.polygon)
        );
        if (hit) return { t, id: hit.id };
      }
      return { t: MARCH_MAX, id: "" };
    };
    const offenders: string[] = [];
    for (const section of plan.pathSections) {
      for (let index = 0; index < section.points.length - 1; index++) {
        const from = section.points[index]!;
        const to = section.points[index + 1]!;
        const length = Math.hypot(to.x - from.x, to.z - from.z) || 1;
        const nx = -(to.z - from.z) / length;
        const nz = (to.x - from.x) / length;
        const steps = Math.max(1, Math.ceil(length / 0.25));
        for (let step = 0; step <= steps; step++) {
          const t = step / steps;
          const sample = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
          const left = march(sample, nx, nz);
          const right = march(sample, -nx, -nz);
          if (
            Math.min(left.t, right.t) < 0.9 ||
            left.t + right.t < Math.min(section.width, 2.4)
          ) {
            offenders.push(
              `${section.id} ${sample.x.toFixed(2)},${sample.z.toFixed(2)} sides ${left.t.toFixed(2)}(${left.id})/${right.t.toFixed(2)}(${right.id})`
            );
          }
        }
      }
    }
    expect(offenders.slice(0, 12)).toEqual([]);
  });

  it("keeps every reachable floor cell within 2 m of the carved network", () => {
    // Flood-fill walkable floor from the Water door; assert no reachable
    // pocket strays far from corridors, hub, or courts — "nowhere else to
    // walk" as a proof instead of an enumeration.
    const CELL = 0.5;
    const cols = Math.round((plan.room.maxX - plan.room.minX) / CELL);
    const rows = Math.round((plan.room.maxZ - plan.room.minZ) / CELL);
    const cellPoint = (cx: number, cz: number) => ({
      x: plan.room.minX + (cx + 0.5) * CELL,
      z: plan.room.minZ + (cz + 0.5) * CELL,
    });
    const walkable: boolean[] = new Array(cols * rows);
    for (let cz = 0; cz < rows; cz++) {
      for (let cx = 0; cx < cols; cx++) {
        const point = cellPoint(cx, cz);
        walkable[cz * cols + cx] = !plan.basaltMasses.some((mass) =>
          pointInProcessionPolygon(point, mass.polygon)
        );
      }
    }
    const distToSegment = (
      point: { x: number; z: number },
      a: { x: number; z: number },
      b: { x: number; z: number }
    ) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lengthSq = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq));
      return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
    };
    const carvedDistance = (point: { x: number; z: number }) => {
      let best = Math.hypot(point.x - plan.hubCircle.centre.x, point.z - plan.hubCircle.centre.z) - plan.hubCircle.radius;
      for (const corridor of plan.carved.corridors) {
        for (let index = 0; index < corridor.points.length - 1; index++) {
          best = Math.min(
            best,
            distToSegment(point, corridor.points[index]!, corridor.points[index + 1]!) - corridor.width / 2
          );
        }
      }
      for (const shrine of plan.shrines) {
        if (pointInProcessionPolygon(point, shrine.courtPolygon)) return 0;
        for (let index = 0; index < shrine.courtPolygon.length; index++) {
          best = Math.min(
            best,
            distToSegment(
              point,
              shrine.courtPolygon[index]!,
              shrine.courtPolygon[(index + 1) % shrine.courtPolygon.length]!
            )
          );
        }
      }
      return Math.max(0, best);
    };
    const start = { cx: Math.floor(1 / CELL), cz: Math.floor(22 / CELL) };
    expect(walkable[start.cz * cols + start.cx]).toBe(true);
    const reached = new Set<number>([start.cz * cols + start.cx]);
    const queue = [start.cz * cols + start.cx];
    while (queue.length > 0) {
      const index = queue.pop()!;
      const cx = index % cols;
      const cz = Math.floor(index / cols);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nextX = cx + dx;
        const nextZ = cz + dz;
        if (nextX < 0 || nextX >= cols || nextZ < 0 || nextZ >= rows) continue;
        const next = nextZ * cols + nextX;
        if (reached.has(next) || !walkable[next]) continue;
        reached.add(next);
        queue.push(next);
      }
    }
    const offenders = [...reached]
      .map((index) => cellPoint(index % cols, Math.floor(index / cols)))
      .filter((point) => carvedDistance(point) > 2.0)
      .map((point) => `${point.x.toFixed(2)},${point.z.toFixed(2)}`);
    expect(offenders.slice(0, 12)).toEqual([]);
    // The courts must be reachable at all.
    for (const shrine of plan.shrines) {
      const cx = Math.floor((shrine.entry.x - plan.room.minX) / CELL);
      const cz = Math.floor((shrine.entry.z - plan.room.minZ) / CELL);
      expect(reached.has(cz * cols + cx), `${shrine.id} entry unreachable`).toBe(true);
    }
  });

  it("uses extra compiled depth as symmetric rock margin without stretching geometry", () => {
    const deeper = buildFirstFireProcessionPlan({
      room: { minX: 0, maxX: 58, minZ: 0, maxZ: 44.5 },
      westDoor: { min: 20.25, max: 24.25 },
      eastDoor: { min: 32.25, max: 36.25 },
    });
    expect(deeper.hub.minZ - plan.hub.minZ).toBeCloseTo(0.25, 12);
    expect(deeper.hub.maxZ - plan.hub.maxZ).toBeCloseTo(0.25, 12);
    expect(deeper.hub.maxX - deeper.hub.minX).toBe(13);
    expect(deeper.hub.maxZ - deeper.hub.minZ).toBe(13);
    for (let index = 0; index < plan.shrines.length; index++) {
      expect(deeper.shrines[index]!.centre.x).toBe(plan.shrines[index]!.centre.x);
      expect(deeper.shrines[index]!.centre.z - plan.shrines[index]!.centre.z).toBeCloseTo(0.25, 12);
      expect(deeper.shrines[index]!.orbitRadius).toBeCloseTo(plan.shrines[index]!.orbitRadius, 12);
    }
  });
});

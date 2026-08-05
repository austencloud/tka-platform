/**
 * The Air chimney's updraft prototype: geometry invariants plus a simulated
 * rise. The gate this file guards is not "does it compile" — it is "does a
 * player who never presses jump get from +4.6 to +8.4 in about four seconds",
 * which is measured here at the physics/UCC seam and again in the browser.
 */
import { describe, it, expect } from "vitest";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildAirChimneyLayout,
  createAirChimneyTerrain,
  AIR_FLOOR_Y,
  LANDING_B_Y,
  OVERLOOK_Y,
  UPDRAFT_CEILING_PLAYER_Y,
  UPDRAFT_SPEED,
} from "$lib/features/museum/data/air-chimney-layout";
import {
  MuseumPhysicsProvider,
  STANDING_Y,
} from "$lib/features/museum/services/museum-physics-provider";
import { bucketMuseumTilesByRoom } from "$lib/features/museum/services/museum-geometry-builder";
import { inRectClosed } from "$lib/features/museum/data/drowned-gallery-terrain";
import { SOLID_TYPES } from "$lib/features/museum/services/museum-physics-provider";
import { tileKey } from "$lib/features/museum/domain/museum-grid-types";

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const layout = buildAirChimneyLayout(grid)!;
const terrain = createAirChimneyTerrain(grid)!;

/** UCC's physics path, reduced to the vertical axis (see UnifiedCameraController). */
const UPDRAFT_RISE_EASE = 6;
const GRAVITY = 9.81 * 2.5;

/**
 * Runs the exact vertical integration the UCC does, through the real physics
 * provider, with NO jump input. Returns the sampled {t, y} trace.
 */
function simulateRise(
  startX: number,
  startZ: number,
  seconds: number,
  dt = 1 / 60
): { t: number; y: number }[] {
  const physics = new MuseumPhysicsProvider(grid, grid.tileScale, {
    x: startX,
    y: 0,
    z: startZ,
  });
  let verticalVelocity = 0;
  const trace: { t: number; y: number }[] = [
    { t: 0, y: physics.getPlayerPosition().y },
  ];
  const steps = Math.round(seconds / dt);
  for (let i = 1; i <= steps; i++) {
    const lift = physics.updraftSpeedAtPlayer();
    if (lift > 0) {
      verticalVelocity +=
        (lift - verticalVelocity) * Math.min(1, UPDRAFT_RISE_EASE * dt);
    } else if (!physics.isGrounded()) {
      verticalVelocity -= GRAVITY * dt;
    } else if (verticalVelocity < 0) {
      verticalVelocity = 0;
    }
    physics.movePlayer({ x: 0, y: verticalVelocity * dt, z: 0 }, dt);
    trace.push({ t: i * dt, y: physics.getPlayerPosition().y });
  }
  return trace;
}

describe("Air chimney layout", () => {
  it("puts the shaft base at +4.6 and the overlook lip at +8.4", () => {
    expect(terrain.elevationAt(layout.probes.column.x, layout.probes.column.z)).toBeCloseTo(
      LANDING_B_Y,
      6
    );
    expect(terrain.elevationAt(layout.probes.lip.x, layout.probes.lip.z)).toBeCloseTo(
      OVERLOOK_Y,
      6
    );
    expect(terrain.elevationAt(layout.probes.platform.x, layout.probes.platform.z)).toBeCloseTo(
      LANDING_B_Y,
      6
    );
  });

  it("ramps continuously from the datum to the shaft base", () => {
    expect(terrain.elevationAt(layout.probes.rampFoot.x, layout.probes.rampFoot.z)).toBeLessThan(
      0.6
    );
    expect(terrain.elevationAt(layout.probes.rampHead.x, layout.probes.rampHead.z)).toBeGreaterThan(
      LANDING_B_Y - 0.3
    );
    // No step on the ramp exceeds the museum's 0.6 m neighbour sweep.
    const steps = 200;
    let previous = terrain.elevationAt(layout.ramp.minX + 0.5, layout.ramp.minZ);
    for (let i = 1; i <= steps; i++) {
      const z = layout.ramp.minZ + ((layout.ramp.maxZ - layout.ramp.minZ) * i) / steps;
      const here = terrain.elevationAt(layout.ramp.minX + 0.5, z);
      expect(Math.abs(here - previous)).toBeLessThanOrEqual(0.6);
      previous = here;
    }
  });

  it("never throws or holes inside the bay — the datum is always the floor", () => {
    for (let x = layout.bayBounds.minX; x <= layout.bayBounds.maxX; x += 0.5) {
      for (let z = layout.bayBounds.minZ; z <= layout.bayBounds.maxZ; z += 0.5) {
        const y = terrain.elevationAt(x, z);
        expect(Number.isFinite(y)).toBe(true);
        expect(y).toBeGreaterThanOrEqual(AIR_FLOOR_Y);
      }
    }
  });

  it("rims the raised ledges so they cannot be walked up from below", () => {
    // Every approach to the +8.4 lip that is not the column is blocked rock.
    for (const rim of layout.rims) {
      const cx = (rim.rect.minX + rim.rect.maxX) / 2;
      const cz = (rim.rect.minZ + rim.rect.maxZ) / 2;
      expect(terrain.blockedAt(cx, cz)).toBe(true);
    }
    // The column↔platform and column↔lip seams stay open.
    expect(terrain.blockedAt(layout.column.minX + 0.1, layout.probes.column.z)).toBe(false);
    expect(terrain.blockedAt(layout.column.maxX - 0.1, layout.probes.column.z)).toBe(false);
  });

  it("keeps the north↔south walk through the bay on the datum", () => {
    const northDoorZ = layout.shell.minZ;
    const southDoorZ = layout.shell.maxZ;
    expect(terrain.elevationAt(layout.probes.entry.x, northDoorZ)).toBe(AIR_FLOOR_Y);
    expect(terrain.elevationAt(layout.probes.entry.x, southDoorZ)).toBe(AIR_FLOOR_Y);
    expect(terrain.blockedAt(layout.probes.floor.x, layout.probes.floor.z)).toBe(false);
  });

  it("keeps every walkable tile rendered when cave-air joins the suppressed set", () => {
    const buckets = bucketMuseumTilesByRoom(grid);
    const rendered = new Set<string>();
    const collect = (dry: {
      floorBuckets: Map<string, { positions: { x: number; z: number }[] }>;
    }) => {
      for (const bucket of dry.floorBuckets.values()) {
        for (const position of bucket.positions) {
          rendered.add(`${position.x.toFixed(3)},${position.z.toFixed(3)}`);
        }
      }
    };
    collect(buckets.corridorBucket);
    const suppressed = new Set(
      grid.wings
        .filter((w) => w.roomPresentation?.suppressTileGeometry)
        .map((w) => w.id)
    );
    for (const [wingId, dry] of buckets.roomBuckets) {
      if (!suppressed.has(wingId)) collect(dry);
    }

    const authored = [
      ...layout.floorRects.map((f) => f.rect),
      ...layout.corridor,
    ];
    // Only the spans cave-air ADDED can be this change's regression: a tile
    // inside a wing is routed by wing bounds regardless, and the pre-existing
    // water/fire/earth pairs are the other bays' tests to own.
    const air = grid.wings.find((w) => w.id === "cave-air")!.bounds;
    const newSpans = grid.wings
      .filter((w) => suppressed.has(w.id) && w.id !== "cave-air")
      .map((w) => ({
        x0: Math.min(w.bounds.x, air.x),
        y0: Math.min(w.bounds.y, air.y),
        x1: Math.max(w.bounds.x + w.bounds.width, air.x + air.width),
        y1: Math.max(w.bounds.y + w.bounds.height, air.y + air.height),
      }));
    const wingBounds = grid.wings.map((w) => w.bounds);
    const insideAnyWing = (tx: number, ty: number) =>
      wingBounds.some(
        (b) => tx >= b.x && tx < b.x + b.width && ty >= b.y && ty < b.y + b.height
      );
    const insideNewSpan = (tx: number, ty: number) =>
      newSpans.some((s) => tx >= s.x0 && tx < s.x1 && ty >= s.y0 && ty < s.y1);
    // Pairs that existed before cave-air joined: their coverage is the water and
    // fire bays' own tests to guard, not this one's.
    const others = grid.wings.filter(
      (w) => suppressed.has(w.id) && w.id !== "cave-air"
    );
    const oldSpans: { x0: number; y0: number; x1: number; y1: number }[] = [];
    for (let i = 0; i < others.length; i++) {
      for (let j = i + 1; j < others.length; j++) {
        const a = others[i]!.bounds;
        const b = others[j]!.bounds;
        oldSpans.push({
          x0: Math.min(a.x, b.x),
          y0: Math.min(a.y, b.y),
          x1: Math.max(a.x + a.width, b.x + b.width),
          y1: Math.max(a.y + a.height, b.y + b.height),
        });
      }
    }
    const insideOldSpan = (tx: number, ty: number) =>
      oldSpans.some((s) => tx >= s.x0 && tx < s.x1 && ty >= s.y0 && ty < s.y1);

    const holes: string[] = [];
    for (const [key, tile] of grid.tiles) {
      if (SOLID_TYPES.has(tile.type)) continue;
      const [txRaw, tyRaw] = key.split(",");
      const tx = Number(txRaw);
      const ty = Number(tyRaw);
      if (insideAnyWing(tx, ty)) continue;
      if (!insideNewSpan(tx, ty)) continue;
      if (insideOldSpan(tx, ty)) continue;
      const x = tx * grid.tileScale;
      const z = ty * grid.tileScale;
      if (rendered.has(`${x.toFixed(3)},${z.toFixed(3)}`)) continue;
      if (authored.some((rect) => inRectClosed(rect, x, z))) continue;
      holes.push(key);
    }
    expect({ holes: holes.slice(0, 10), count: holes.length }).toEqual({
      holes: [],
      count: 0,
    });
    expect(grid.tiles.get(tileKey(grid.spawn.x, grid.spawn.y))).toBeTruthy();
  });
});

describe("Air chimney updraft", () => {
  it("lifts only inside the column footprint and only below the lip", () => {
    const { columnCentre } = layout;
    const inside = terrain.updraftAt!(
      columnCentre.x,
      columnCentre.z,
      LANDING_B_Y + STANDING_Y
    );
    expect(inside).toBe(UPDRAFT_SPEED);
    expect(
      terrain.updraftAt!(columnCentre.x, columnCentre.z, UPDRAFT_CEILING_PLAYER_Y)
    ).toBe(0);
    expect(
      terrain.updraftAt!(layout.probes.platform.x, layout.probes.platform.z, LANDING_B_Y + STANDING_Y)
    ).toBe(0);
    expect(
      terrain.updraftAt!(layout.probes.lip.x, layout.probes.lip.z, LANDING_B_Y + STANDING_Y)
    ).toBe(0);
  });

  it("carries a player who never jumps from +4.6 to +8.4 in about four seconds", () => {
    const trace = simulateRise(layout.columnCentre.x, layout.columnCentre.z, 6);
    const startY = trace[0]!.y;
    expect(startY).toBeCloseTo(LANDING_B_Y + STANDING_Y, 6);

    const target = OVERLOOK_Y + STANDING_Y;
    const arrival = trace.find((s) => s.y >= target - 0.01);
    expect(arrival).toBeDefined();
    expect(arrival!.t).toBeGreaterThan(3.5);
    expect(arrival!.t).toBeLessThan(4.5);

    const peak = Math.max(...trace.map((s) => s.y));
    // It must not overshoot the lip into the void: residual momentum at 1 m/s
    // buys a few centimetres, not a storey.
    expect(peak - target).toBeLessThan(0.2);
  });

  it("eases in rather than launching — the first half second is the pickup", () => {
    const trace = simulateRise(layout.columnCentre.x, layout.columnCentre.z, 1);
    const at = (t: number) => trace.find((s) => Math.abs(s.t - t) < 1e-6)!.y;
    const startY = trace[0]!.y;
    const halfSecondGain = at(0.5) - startY;
    // A hard snap to 1 m/s would gain 0.5 m in that window; the ease costs ~0.17 m.
    expect(halfSecondGain).toBeGreaterThan(0.25);
    expect(halfSecondGain).toBeLessThan(0.42);
  });

  it("drops a player who steps out of the column back to the floor below", () => {
    // Standing on the datum floor beside the shaft: still air, no lift, and the
    // floor clamp holds them at standing height.
    const trace = simulateRise(layout.probes.floor.x, layout.probes.floor.z, 2);
    for (const sample of trace) {
      expect(sample.y).toBeCloseTo(AIR_FLOOR_Y + STANDING_Y, 6);
    }
  });
});

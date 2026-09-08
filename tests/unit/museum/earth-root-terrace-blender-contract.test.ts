import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCompiledEarthRootTerraceBlenderContract,
  buildCompiledEarthRootTerraceGrid,
  earthPlanPointToBlender,
} from "$lib/features/museum/data/earth-root-terrace-blender-contract";
import {
  BED_Y,
  DOOR_Y,
  TERRACE_Y,
  buildEarthRootTerraceLayout,
} from "$lib/features/museum/data/earth-root-terrace-terrain";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import { TILE_METRES } from "$lib/features/museum/data/drowned-gallery-terrain";
import { canonicalJSON } from "$lib/shared/foundation/utils/canonical-json";

const contract = buildCompiledEarthRootTerraceBlenderContract();
const layout = buildEarthRootTerraceLayout(buildCompiledEarthRootTerraceGrid())!;
const rehearsal = buildEarthRootTerraceLayout(buildVulcanCaveFloorPlan().grid)!;
const manifestPath = resolve(
  "docs/superpowers/specs/earth-root-terrace/earth-root-terrace-blender-plan.json"
);

describe("Earth Root Terrace Blender contract", () => {
  it("restates the compiled room about its plan centre", () => {
    expect(contract.room.width).toBe(34);
    expect(contract.room.depth).toBe(24);
    expect(contract.room.blenderBounds).toEqual({ minX: -17, maxX: 17, minY: -12, maxY: 12 });
    expect(contract.coordinateSystem.gltfRuntime.integrationStatus).toBe(
      "compiled-cave-earth-room"
    );
  });

  it("maps plan points to Blender with north up and elevation as z", () => {
    const c = contract.room.planCentre;
    expect(earthPlanPointToBlender({ x: c.x + 3, z: c.z - 2 }, c, 1.5)).toEqual({
      x: 3,
      y: 2,
      z: 1.5,
    });
    const g = layout.stations[0]!;
    expect(contract.stations[0]!.blender).toEqual(earthPlanPointToBlender(g.centre, c, BED_Y));
    expect(contract.stations.map((s) => s.letter)).toEqual(["G", "H", "I"]);
    expect(contract.stations.every((s) => s.facing === "north")).toBe(true);
  });

  it("carries every floor rect with the ramp ends swapped into Blender y", () => {
    const ids = contract.floors.map((f) => f.id);
    expect(ids).toEqual(layout.floorRects.map((f) => f.id));
    const ramp = contract.floors.find((f) => f.id === "ramp")!;
    expect(ramp.kind).toBe("ramp-x");
    expect(ramp.fromZ).toBe(DOOR_Y);
    expect(ramp.toZ).toBe(TERRACE_Y);
    const descentA = contract.floors.find((f) => f.id === "descent-a")!;
    // World +z is Blender −y: the terrace end (world minZ) is the box's maxY.
    expect(descentA.kind).toBe("ramp-y");
    expect(descentA.fromZ).toBe(1.2);
    expect(descentA.toZ).toBe(TERRACE_Y);
    for (const floor of contract.floors) {
      expect(floor.box.minX).toBeLessThan(floor.box.maxX);
      expect(floor.box.minY).toBeLessThan(floor.box.maxY);
      expect(floor.crown).toBeGreaterThan(Math.max(floor.fromZ, floor.toZ) + 2);
    }
  });

  it("reads the corridor from the museum the visitor walks, not the cave-only plan", () => {
    // Same interior in both plans; a different neighbour distance. The last
    // corridor rect is the tile row at the First Fire's east door.
    const walked = layout.corridor.at(-1)!;
    const rehearsed = rehearsal.corridor.at(-1)!;
    const along = (r: { maxZ: number }, l: typeof layout) => r.maxZ - l.earth.minZ;
    expect(along(walked, layout)).toBeGreaterThan(along(rehearsed, rehearsal) + 4 * TILE_METRES);
    expect(contract.approachCorridor.blenderRects.length).toBe(layout.corridor.length);
    const deepest = Math.min(
      ...contract.approachCorridor.blenderRects.map((r) => r.centre.y - r.sizeY / 2)
    );
    expect(deepest).toBeCloseTo(-(walked.maxZ - contract.room.planCentre.z), 3);
  });

  it("puts both doors on the room's edge and the aven over the middle case", () => {
    expect(contract.doors.west.centre.x).toBe(-17);
    expect(contract.doors.south.centre.y).toBe(-12);
    expect(contract.aven.centre).toEqual({
      x: contract.stations[1]!.blender.x,
      y: contract.stations[1]!.blender.y,
    });
    expect(contract.aven.top).toBeGreaterThan(contract.datums.bedCrown);
  });

  it("matches the hash-stamped manifest on disk", () => {
    expect(existsSync(manifestPath), `run pnpm exec tsx scripts/export-earth-root-terrace-blender-plan.ts`).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const digest = createHash("sha256").update(canonicalJSON(contract), "utf8").digest("hex");
    expect(manifest.sourceDigest).toBe(digest);
    expect(manifest.contract).toEqual(JSON.parse(JSON.stringify(contract)));
  });
});

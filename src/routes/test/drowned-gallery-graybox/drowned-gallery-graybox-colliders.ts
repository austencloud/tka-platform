/**
 * Collision scaffold for the standalone Drowned Gallery walk route.
 *
 * The GLB is visual only. Colliders rebuild from buildDrownedGalleryLayout —
 * the same call the Blender manifest serialises — translated to the GLB's
 * authoring origin (the water bay centre), so physics and the Blender geometry
 * cannot drift apart. Ramps become step stacks under the walker's auto-step.
 */
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildDrownedGalleryLayout,
  CAUSEWAY_Y,
  GALLERY_FLOOR_Y,
  GALLERY_ROOF_Y,
  type DrownedGalleryLayout,
  type WorldRect,
} from "$lib/features/museum/data/drowned-gallery-terrain";

export interface DrownedGalleryCollider {
  id: string;
  shape: "box";
  position: [number, number, number];
  size: [number, number, number];
}

const FLOOR_T = 0.5;
/** Rise per generated ramp step; must stay under the walker's 0.45 auto-step. */
const STEP_RISE = 0.35;
/** Water basins are fenced with an invisible barrier this far above the deck. */
const BARRIER_TOP = CAUSEWAY_Y + 1.1;

export interface DrownedGalleryWalkSetup {
  layout: DrownedGalleryLayout;
  origin: { x: number; z: number };
  colliders: DrownedGalleryCollider[];
  spawn: { x: number; y: number; z: number; yaw: number };
}

let cachedSetup: DrownedGalleryWalkSetup | null = null;

/** Human label for a runtime position — the review HUD's location line. */
export function drownedGalleryLocationLabel(position: {
  x: number;
  y: number;
  z: number;
}): string {
  const setup = buildDrownedGalleryWalkSetup();
  const { layout, origin } = setup;
  const world = { x: position.x + origin.x, z: position.z + origin.z };
  const inRect = (r: WorldRect) =>
    world.x >= r.minX && world.x <= r.maxX && world.z >= r.minZ && world.z <= r.maxZ;
  if (inRect(layout.buoyantShaft)) return "The buoyant shaft";
  for (const channel of layout.channels) {
    const letter = channel.id.toUpperCase();
    if (inRect(channel.bell.rect)) return `Air-bell ${letter}`;
    if (inRect(channel.stair) || channel.legs.some(inRect)) {
      return `Channel ${letter}`;
    }
  }
  if (inRect(layout.hub)) return "The drowned hub";
  if (inRect(layout.descentStair) || inRect(layout.returnLeg)) return "Descent";
  if (inRect(layout.shaftPassageLeg) || inRect(layout.shaftPassageJog)) {
    return "Drowned passage";
  }
  if (inRect(layout.approach)) return "Flooded approach";
  if (inRect(layout.grotto)) return "The grotto ring";
  return "The Drowned Gallery";
}

export function buildDrownedGalleryWalkSetup(): DrownedGalleryWalkSetup {
  if (cachedSetup) return cachedSetup;
  const plan = buildVulcanCaveFloorPlan();
  const layout = buildDrownedGalleryLayout(plan.grid);
  if (!layout) {
    throw new Error("Drowned gallery layout missing from the compiled cave grid");
  }

  const origin = {
    x: (layout.bayBounds.minX + layout.bayBounds.maxX) / 2,
    z: (layout.bayBounds.minZ + layout.bayBounds.maxZ) / 2,
  };

  const colliders: DrownedGalleryCollider[] = [];
  const box = (
    id: string,
    rect: WorldRect,
    baseY: number,
    topY: number
  ): void => {
    const w = rect.maxX - rect.minX;
    const d = rect.maxZ - rect.minZ;
    const h = topY - baseY;
    if (w <= 0.005 || d <= 0.005 || h <= 0.005) return;
    colliders.push({
      id,
      shape: "box",
      position: [
        (rect.minX + rect.maxX) / 2 - origin.x,
        baseY + h / 2,
        (rect.minZ + rect.maxZ) / 2 - origin.z,
      ],
      size: [w, h, d],
    });
  };

  for (const floor of layout.floorRects) {
    if (
      ["pool-bottom", "channel-bed", "shore-shelf"].includes(floor.id) ||
      floor.id.includes("-margin") ||
      floor.id.includes("-shelf")
    ) {
      continue; // basins, bell water margins and performer shelves are fenced below
    }
    if (floor.kind === "flat") {
      box(`floor-${floor.id}`, floor.rect, floor.fromY - FLOOR_T, floor.fromY);
      continue;
    }
    const alongZ = floor.kind === "ramp-z";
    const run = alongZ
      ? floor.rect.maxZ - floor.rect.minZ
      : floor.rect.maxX - floor.rect.minX;
    const rise = floor.toY - floor.fromY;
    const steps = Math.max(1, Math.ceil(Math.abs(rise) / STEP_RISE));
    for (let index = 0; index < steps; index += 1) {
      const t0 = index / steps;
      const t1 = (index + 1) / steps;
      const stepTop = floor.fromY + rise * (t0 + t1) / 2;
      const rect: WorldRect = alongZ
        ? {
            ...floor.rect,
            minZ: floor.rect.minZ + run * t0,
            maxZ: floor.rect.minZ + run * t1,
          }
        : {
            ...floor.rect,
            minX: floor.rect.minX + run * t0,
            maxX: floor.rect.minX + run * t1,
          };
      box(`floor-${floor.id}-step-${index}`, rect, stepTop - FLOOR_T, stepTop);
    }
  }

  for (const wall of layout.wallRects) {
    box(`wall-${wall.id}`, wall.rect, wall.baseY, wall.topY);
  }
  layout.rockFill.forEach((rect, index) => {
    box(`rock-${index}`, rect, GALLERY_FLOOR_Y - 0.5, GALLERY_ROOF_Y);
  });
  layout.thresholdJambs.forEach((rect, index) => {
    box(`jamb-${index}`, rect, CAUSEWAY_Y, CAUSEWAY_Y + 3.4);
  });
  layout.balustrades.forEach((rect, index) => {
    box(`rail-${index}`, rect, CAUSEWAY_Y, CAUSEWAY_Y + 0.9);
  });
  // Water basins, the ring shore, and each bell's margin + performer shelf
  // stay unwalkable, as in the museum.
  box("barrier-pool", layout.pool, -5.0, BARRIER_TOP);
  box("barrier-channel", layout.channel, -2.7, BARRIER_TOP);
  box("barrier-shore", layout.shore, -1.0, BARRIER_TOP);
  for (const channel of layout.channels) {
    box(`barrier-bell-${channel.id}-margin`, channel.bell.margin, -2.7, 0.4);
    box(`barrier-bell-${channel.id}-shelf`, channel.bell.shelf, -1.0, 0.4);
  }

  const approach = layout.approach;
  const spawn = {
    x: (approach.minX + approach.maxX) / 2 - origin.x,
    y: 0.95,
    z: approach.maxZ - 1.2 - origin.z,
    yaw: Math.PI,
  };

  cachedSetup = { layout, origin, colliders, spawn };
  return cachedSetup;
}

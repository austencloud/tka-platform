/**
 * Museum grounds layout calculator.
 *
 * Pure function - no Svelte, no Three.js, no side effects.
 * Given an exhibit count, returns the full spatial layout: pavilion positions,
 * wall geometry (from templates), and exhibit + performer slot positions.
 *
 * Coordinate system: Y-up, right-handed. Spawn is in the positive-Z direction.
 * Pavilions face spawn (their open side faces +Z). The clearing center is the
 * origin (0, 0) on the XZ plane.
 *
 * Pavilion selection:
 *   1–4   → 1 alcove
 *   5–10  → alcove + corridor
 *   11–20 → alcove + corridor + courtyard
 *   21+   → keeps adding quad/courtyard pavilions until capacity ≥ exhibitCount
 */

import type {
  ExhibitSlot,
  MuseumGroundsLayout,
  PavilionLayout,
  PavilionTemplate,
  WallSegment,
} from "./museum-types";
import { MUSEUM_DEFAULTS } from "./museum-types";
import { TEMPLATES } from "./pavilion-templates";

// Constants

/** Base clearing radius for a single pavilion. Scales with pavilion count. */
const BASE_CLEARING_RADIUS = 12;

/** Additional radius added per extra pavilion beyond the first. */
const RADIUS_PER_PAVILION = 6;

/**
 * Pavilion sequence for expanding capacity.
 * Index 0 = primary (always placed first), subsequent entries added as needed.
 */
const PAVILION_SEQUENCE: PavilionTemplate[] = [ // eslint-disable-line @typescript-eslint/no-unused-vars
  "alcove",
  "corridor",
  "courtyard",
  "quad",
];

// Public API

export function calculateMuseumLayout(exhibitCount: number): MuseumGroundsLayout {
  const pavilionTemplates = selectPavilionTemplates(exhibitCount);
  const clearingRadius = computeClearingRadius(pavilionTemplates.length);
  const clearingCenter = { x: 0, z: 0 };

  const pavilions = placePavilions(pavilionTemplates, clearingRadius, exhibitCount);

  return { clearingCenter, clearingRadius, pavilions };
}

// Pavilion selection

/**
 * Determines which pavilion types to include based on exhibit count.
 * The selection grows step-by-step, repeating quad/courtyard as needed.
 */
function selectPavilionTemplates(exhibitCount: number): PavilionTemplate[] {
  if (exhibitCount <= 4) return ["alcove"];
  if (exhibitCount <= 10) return ["alcove", "corridor"];
  if (exhibitCount <= 20) return ["alcove", "corridor", "courtyard"];

  // Beyond 20: keep adding pavilions from the sequence (cycling through
  // quad and courtyard after the initial trio) until we have enough capacity.
  const selected: PavilionTemplate[] = ["alcove", "corridor", "courtyard"];
  let capacity = totalCapacity(selected);

  // Cycle through quad → courtyard → quad → ... for additional pavilions.
  const extras: PavilionTemplate[] = ["quad", "courtyard"];
  let extraIndex = 0;

  while (capacity < exhibitCount) {
    const next = extras[extraIndex % extras.length]!;
    selected.push(next);
    extraIndex++;
    capacity = totalCapacity(selected);
  }

  return selected;
}

function totalCapacity(templates: PavilionTemplate[]): number {
  return templates.reduce((sum, t) => sum + TEMPLATES[t].maxSlots, 0);
}

// Clearing radius

function computeClearingRadius(pavilionCount: number): number {
  return BASE_CLEARING_RADIUS + (pavilionCount - 1) * RADIUS_PER_PAVILION;
}

// Pavilion placement (semicircle facing spawn / +Z)

/**
 * Places pavilions in a semicircle on the far side of the clearing (negative Z),
 * all facing toward spawn (+Z). The arc spans from -90° to +90° relative to the
 * -Z axis, i.e. from the west side around the back to the east side.
 *
 * For a single pavilion it sits directly behind the clearing at (0, 0, -r).
 */
function placePavilions(
  templates: PavilionTemplate[],
  clearingRadius: number,
  exhibitCount: number
): PavilionLayout[] {
  const count = templates.length;
  const placementRadius = clearingRadius * 0.85; // Slightly inside the clearing edge

  return templates.map((template, index) => {
    // Spread pavilions evenly across a 180° arc centered on -Z.
    // angle=0 → directly behind center (-Z axis). angle=±π/2 → sides.
    const angleStep = count === 1 ? 0 : Math.PI / (count - 1);
    const rawAngle = -Math.PI / 2 + index * angleStep;
    // Convert to world: positive angle = counterclockwise looking from above.
    // We want pavilion 0 at west (-X side), last at east (+X side), middle at -Z.
    const angle = rawAngle;

    const x = Math.sin(angle) * placementRadius;
    const z = -Math.cos(angle) * placementRadius; // Negative = behind clearing

    // Pavilion rotates to face spawn (+Z). Base orientation faces -Z (open side toward spawn),
    // so rotation is the same as the angle from -Z axis.
    const rotationY = angle;

    const pavId = `pavilion-${template}-${index}`;
    const def = TEMPLATES[template];

    // How many wall slots does this pavilion get? Distribute exhibits across pavilions
    // proportionally, then generate slots for that count (capped by template maxSlots).
    const desiredSlots = Math.min(exhibitCount, def.maxSlots);
    const slots = generateSlots(pavId, def.walls, rotationY, { x, z: z }, desiredSlots);

    return { id: pavId, template, position: { x, z: z }, rotationY, walls: def.walls, slots };
  });
}

// ---------------------------------------------------------------------------
// Slot generation
// ---------------------------------------------------------------------------

/**
 * Generates wall slots evenly spaced along each wall segment, then creates
 * a paired performer slot 2m in front of each wall slot (along the wall normal).
 *
 * @param pavId       Parent pavilion id
 * @param walls       Wall segments in local pavilion space
 * @param rotationY   Pavilion world rotation (radians)
 * @param origin      Pavilion world position (XZ)
 * @param maxSlots    Maximum wall slots to generate across all walls
 */
function generateSlots(
  pavId: string,
  walls: WallSegment[],
  rotationY: number,
  origin: { x: number; z: number },
  maxSlots: number
): ExhibitSlot[] {
  const slots: ExhibitSlot[] = [];
  const { slotHeight, slotSpacing: _slotSpacing, platformOffset } = MUSEUM_DEFAULTS;

  // Distribute slot budget across walls proportionally by wall length.
  const wallLengths = walls.map((w) => segmentLength(w));
  const totalLength = wallLengths.reduce((a, b) => a + b, 0);

  let slotsRemaining = maxSlots;
  let slotIndex = 0;

  for (let wi = 0; wi < walls.length && slotsRemaining > 0; wi++) {
    const wall = walls[wi]!;
    const length = wallLengths[wi]!;

    // How many slots fit on this wall? At least 1, up to remaining budget.
    const rawCount = Math.round((length / totalLength) * maxSlots);
    const wallSlotCount = Math.min(Math.max(rawCount, 1), slotsRemaining);

    // Evenly space slots along the wall, with half-spacing margin at each end.
    const spacing = length / (wallSlotCount + 1);

    // Wall direction unit vector (local space)
    const dx = wall.end.x - wall.start.x;
    const dz = wall.end.z - wall.start.z;
    const wallDir = normalize2D(dx, dz);

    // Wall normal (local space) - rotate wall direction 90° inward.
    // Convention: normal points toward the pavilion interior (+90° from wall dir).
    const localNormal = { x: -wallDir.z, z: wallDir.x };

    for (let si = 0; si < wallSlotCount && slotsRemaining > 0; si++, slotIndex++, slotsRemaining--) {
      const t = (si + 1) * spacing;

      // Local position along the wall
      const localX = wall.start.x + wallDir.x * t;
      const localZ = wall.start.z + wallDir.z * t;

      // Transform to world space: rotate by pavilion rotationY then translate.
      const worldPos = localToWorld({ x: localX, z: localZ }, rotationY, origin);
      const worldNormal = rotateDir2D(localNormal, rotationY);

      const wallSlotId = `${pavId}-wall-${slotIndex}`;
      const wallSlot: ExhibitSlot = {
        id: wallSlotId,
        pavilionId: pavId,
        position: { x: worldPos.x, y: slotHeight, z: worldPos.z },
        normal: { x: worldNormal.x, y: 0, z: worldNormal.z },
        rotationY: Math.atan2(worldNormal.x, worldNormal.z),
        type: "wall",
      };

      // Performer slot: 2m in front of the wall slot along the normal.
      const perfSlotId = `${pavId}-performer-${slotIndex}`;
      const performerSlot: ExhibitSlot = {
        id: perfSlotId,
        pavilionId: pavId,
        position: {
          x: worldPos.x + worldNormal.x * platformOffset,
          y: slotHeight,
          z: worldPos.z + worldNormal.z * platformOffset,
        },
        normal: { x: -worldNormal.x, y: 0, z: -worldNormal.z }, // Faces the wall
        rotationY: Math.atan2(-worldNormal.x, -worldNormal.z),
        type: "performer",
      };

      slots.push(wallSlot, performerSlot);
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Geometry utilities
// ---------------------------------------------------------------------------

function segmentLength(wall: WallSegment): number {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function normalize2D(x: number, z: number): { x: number; z: number } {
  const len = Math.sqrt(x * x + z * z);
  if (len < 1e-9) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

/**
 * Transforms a local XZ point to world space by applying a Y-axis rotation
 * then adding the pavilion world origin.
 */
function localToWorld(
  local: { x: number; z: number },
  rotationY: number,
  origin: { x: number; z: number }
): { x: number; z: number } {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: origin.x + local.x * cos - local.z * sin,
    z: origin.z + local.x * sin + local.z * cos,
  };
}

/**
 * Rotates a 2D direction vector by a Y-axis rotation angle.
 */
function rotateDir2D(
  dir: { x: number; z: number },
  rotationY: number
): { x: number; z: number } {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: dir.x * cos - dir.z * sin,
    z: dir.x * sin + dir.z * cos,
  };
}

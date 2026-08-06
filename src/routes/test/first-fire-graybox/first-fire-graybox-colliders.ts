import type { FirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";

export const FIRST_FIRE_GRAYBOX_SPAWN = {
  x: -28.4,
  y: 0.88,
  z: 0,
  yaw: Math.PI / 2,
} as const;

export type FirstFireGrayboxCollider =
  | {
      id: string;
      shape: "box";
      position: [number, number, number];
      size: [number, number, number];
    }
  | {
      id: string;
      shape: "cylinder";
      position: [number, number, number];
      radius: number;
      halfHeight: number;
    };

const WALL_THICKNESS = 0.6;
const WALL_HEIGHT = 8;
const FLOOR_THICKNESS = 0.5;
const TRENCH_COLLIDER_HEIGHT = 3;

function box(
  id: string,
  position: [number, number, number],
  size: [number, number, number]
): FirstFireGrayboxCollider {
  return { id, shape: "box", position, size };
}

function wallSegment(
  id: string,
  axis: "x" | "z",
  fixed: number,
  start: number,
  end: number
): FirstFireGrayboxCollider {
  const length = end - start;
  const centre = start + length / 2;
  return axis === "x"
    ? box(
        id,
        [centre, WALL_HEIGHT / 2, fixed],
        [length, WALL_HEIGHT, WALL_THICKNESS]
      )
    : box(
        id,
        [fixed, WALL_HEIGHT / 2, centre],
        [WALL_THICKNESS, WALL_HEIGHT, length]
      );
}

/**
 * Collision scaffold for the standalone walk route.
 *
 * The GLB is visual only. These colliders are rebuilt from the same measured
 * contract so the Water door, Earth door, sightline ribs, and shrine trenches
 * cannot drift away from the Blender geometry.
 */
export function buildFirstFireGrayboxColliders(
  contract: FirstFireBlenderContract
): FirstFireGrayboxCollider[] {
  const { minX, maxX, minY: minZ, maxY: maxZ } = contract.room.blenderBounds;
  const waterDoorMinZ =
    contract.doors.water.plan.z -
    contract.doors.water.clearWidth / 2 -
    contract.room.planCentre.z;
  const waterDoorMaxZ =
    contract.doors.water.plan.z +
    contract.doors.water.clearWidth / 2 -
    contract.room.planCentre.z;
  const earthDoorMinZ =
    contract.doors.earth.plan.z -
    contract.doors.earth.clearWidth / 2 -
    contract.room.planCentre.z;
  const earthDoorMaxZ =
    contract.doors.earth.plan.z +
    contract.doors.earth.clearWidth / 2 -
    contract.room.planCentre.z;

  const colliders: FirstFireGrayboxCollider[] = [
    box(
      "floor",
      [0, -FLOOR_THICKNESS / 2, 0],
      [contract.room.width, FLOOR_THICKNESS, contract.room.depth]
    ),
    wallSegment("north-wall", "x", minZ, minX, maxX),
    wallSegment("south-wall", "x", maxZ, minX, maxX),
    wallSegment("water-wall-north", "z", minX, minZ, waterDoorMinZ),
    wallSegment("water-wall-south", "z", minX, waterDoorMaxZ, maxZ),
    wallSegment("earth-wall-north", "z", maxX, minZ, earthDoorMinZ),
    wallSegment("earth-wall-south", "z", maxX, earthDoorMaxZ, maxZ),
    wallSegment(
      "water-door-stop",
      "z",
      minX - 1.6,
      waterDoorMinZ,
      waterDoorMaxZ
    ),
    wallSegment(
      "earth-door-stop",
      "z",
      maxX + 1.6,
      earthDoorMinZ,
      earthDoorMaxZ
    ),
  ];

  for (const occluder of contract.occluders) {
    const centreX = occluder.blenderFootprint.centre.x;
    const centreZ = -occluder.blenderFootprint.centre.y;
    colliders.push(
      box(
        occluder.id,
        [centreX, WALL_HEIGHT / 2, centreZ],
        [
          occluder.blenderFootprint.sizeX,
          WALL_HEIGHT,
          occluder.blenderFootprint.sizeY,
        ]
      )
    );
  }

  for (const shrine of contract.shrines) {
    colliders.push({
      id: `${shrine.id}-trench`,
      shape: "cylinder",
      position: [
        shrine.blenderCentre.x,
        TRENCH_COLLIDER_HEIGHT / 2,
        -shrine.blenderCentre.y,
      ],
      radius: shrine.trenchOuterRadius,
      halfHeight: TRENCH_COLLIDER_HEIGHT / 2,
    });
  }

  return colliders;
}

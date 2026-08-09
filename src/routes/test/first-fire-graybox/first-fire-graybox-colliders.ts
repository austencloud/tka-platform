import type { FirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";

export const FIRST_FIRE_GRAYBOX_SPAWN = {
  x: -27,
  y: 0.88,
  z: 0,
  yaw: Math.PI / 2,
} as const;

export interface FirstFireGrayboxCollider {
  id: string;
  source: "shell" | "basalt";
  shape: "box";
  position: [number, number, number];
  size: [number, number, number];
  rotation?: { x: number; y: number; z: number; w: number };
}

const WALL_THICKNESS = 0.6;
const BASALT_COLLIDER_THICKNESS = 0.34;
const WALL_HEIGHT = 8;
const FLOOR_THICKNESS = 0.5;

function box(
  id: string,
  source: FirstFireGrayboxCollider["source"],
  position: [number, number, number],
  size: [number, number, number],
  rotation?: FirstFireGrayboxCollider["rotation"]
): FirstFireGrayboxCollider {
  return {
    id,
    source,
    shape: "box",
    position,
    size,
    ...(rotation ? { rotation } : {}),
  };
}

function axisAlignedWall(
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
        "shell",
        [centre, WALL_HEIGHT / 2, fixed],
        [length, WALL_HEIGHT, WALL_THICKNESS]
      )
    : box(
        id,
        "shell",
        [fixed, WALL_HEIGHT / 2, centre],
        [WALL_THICKNESS, WALL_HEIGHT, length]
      );
}

function basaltEdge(
  massId: string,
  edgeIndex: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  height: number
): FirstFireGrayboxCollider {
  const startZ = -start.y;
  const endZ = -end.y;
  const dx = end.x - start.x;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  const yaw = -Math.atan2(dz, dx);
  return box(
    `${massId}-edge-${edgeIndex + 1}`,
    "basalt",
    [(start.x + end.x) / 2, height / 2, (startZ + endZ) / 2],
    [length + BASALT_COLLIDER_THICKNESS, height, BASALT_COLLIDER_THICKNESS],
    { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }
  );
}

/**
 * Collision for the isolated review shell comes from the measured contract.
 * Basalt keeps its authored polygon silhouette instead of turning into broad
 * bounding boxes, and every fire guide remains intentionally walk-through.
 */
export function buildFirstFireGrayboxColliders(
  contract: FirstFireBlenderContract
): FirstFireGrayboxCollider[] {
  const { minX, maxX, minY: minZ, maxY: maxZ } = contract.room.blenderBounds;
  const waterDoorMinZ = -(
    contract.doors.water.blender.y +
    contract.doors.water.clearWidth / 2
  );
  const waterDoorMaxZ = -(
    contract.doors.water.blender.y -
    contract.doors.water.clearWidth / 2
  );
  const earthDoorMinZ = -(
    contract.doors.earth.blender.y +
    contract.doors.earth.clearWidth / 2
  );
  const earthDoorMaxZ = -(
    contract.doors.earth.blender.y -
    contract.doors.earth.clearWidth / 2
  );

  const colliders: FirstFireGrayboxCollider[] = [
    box(
      "floor",
      "shell",
      [0, -FLOOR_THICKNESS / 2, 0],
      [contract.room.width, FLOOR_THICKNESS, contract.room.depth]
    ),
    axisAlignedWall("north-wall", "x", minZ, minX, maxX),
    axisAlignedWall("south-wall", "x", maxZ, minX, maxX),
    axisAlignedWall("water-wall-north", "z", minX, minZ, waterDoorMinZ),
    axisAlignedWall("water-wall-south", "z", minX, waterDoorMaxZ, maxZ),
    axisAlignedWall("earth-wall-north", "z", maxX, minZ, earthDoorMinZ),
    axisAlignedWall("earth-wall-south", "z", maxX, earthDoorMaxZ, maxZ),
    axisAlignedWall(
      "water-threshold-stop",
      "z",
      minX - 1.6,
      waterDoorMinZ,
      waterDoorMaxZ
    ),
    axisAlignedWall(
      "earth-threshold-stop",
      "z",
      maxX + 1.6,
      earthDoorMinZ,
      earthDoorMaxZ
    ),
  ];

  for (const mass of contract.basalt) {
    for (let index = 0; index < mass.blenderPolygon.length; index += 1) {
      const start = mass.blenderPolygon[index]!;
      const end =
        mass.blenderPolygon[(index + 1) % mass.blenderPolygon.length]!;
      colliders.push(
        basaltEdge(mass.id, index, start, end, mass.minimumHeight)
      );
    }
  }

  return colliders;
}

import type { RoomLight } from "./museum-geometry-builder";

export interface RoomLightSlot {
  x: number;
  z: number;
  color: string;
  intensity: number;
  distance: number;
}

const EMPTY_SLOT: RoomLightSlot = {
  x: 0,
  z: 0,
  color: "#000000",
  intensity: 0,
  distance: 1,
};

export const MAX_ROOM_LIGHTS = 16;
const ROOM_LIGHT_PROXIMITY = 15;

export function createEmptyPool(): RoomLightSlot[] {
  return Array.from({ length: MAX_ROOM_LIGHTS }, () => ({ ...EMPTY_SLOT }));
}

export function recomputeNearbyRoomLights(
  px: number,
  pz: number,
  roomLights: RoomLight[],
): RoomLightSlot[] {
  if (roomLights.length === 0) return createEmptyPool();

  const nearby: (RoomLightSlot & { distSq: number })[] = [];
  const proxSq = ROOM_LIGHT_PROXIMITY * ROOM_LIGHT_PROXIMITY;

  for (const light of roomLights) {
    for (const pos of light.positions) {
      const dx = pos.x - px;
      const dz = pos.z - pz;
      const distSq = dx * dx + dz * dz;
      if (distSq <= proxSq) {
        nearby.push({
          x: pos.x,
          z: pos.z,
          color: light.color,
          intensity: light.intensity,
          distance: light.distance,
          distSq,
        });
      }
    }
  }

  if (nearby.length > MAX_ROOM_LIGHTS) {
    nearby.sort((a, b) => a.distSq - b.distSq);
  }

  const pool: RoomLightSlot[] = [];
  for (let i = 0; i < MAX_ROOM_LIGHTS; i++) {
    if (i < nearby.length) {
      const n = nearby[i]!;
      pool.push({
        x: n.x,
        z: n.z,
        color: n.color,
        intensity: n.intensity,
        distance: n.distance,
      });
    } else {
      pool.push({ ...EMPTY_SLOT });
    }
  }
  return pool;
}

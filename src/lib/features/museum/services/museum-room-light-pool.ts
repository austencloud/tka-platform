import type { RoomLight } from "./museum-geometry-builder";

export interface RoomLightSlot {
  x: number;
  z: number;
  color: string;
  intensity: number;
  distance: number;
}

export interface AuthoredPointLight {
  x: number;
  y: number;
  z: number;
  color: string;
  intensity: number;
  distance: number;
  modulationHz?: number;
  modulationDepth?: number;
}

export interface AuthoredPointLightPlan {
  roomIds: readonly string[];
  lights: readonly AuthoredPointLight[];
}

export type AuthoredPointLightPlanChange = (
  sourceId: string,
  plan: AuthoredPointLightPlan | null
) => void;

export type AuthoredPointLightSlot = AuthoredPointLight;

const EMPTY_SLOT: RoomLightSlot = {
  x: 0,
  z: 0,
  color: "#000000",
  intensity: 0,
  distance: 1,
};

const EMPTY_AUTHORED_SLOT: AuthoredPointLightSlot = {
  x: 0,
  y: 2,
  z: 0,
  color: "#000000",
  intensity: 0,
  distance: 1,
};

export const MAX_ROOM_LIGHTS = 2;
export const MAX_AUTHORED_POINT_LIGHTS = 3;
const ROOM_LIGHT_PROXIMITY = 15;

export function createEmptyPool(): RoomLightSlot[] {
  return Array.from({ length: MAX_ROOM_LIGHTS }, () => ({ ...EMPTY_SLOT }));
}

export function createEmptyAuthoredPointLightPool(): AuthoredPointLightSlot[] {
  return Array.from({ length: MAX_AUTHORED_POINT_LIGHTS }, () => ({
    ...EMPTY_AUTHORED_SLOT,
  }));
}

export function recomputeNearbyRoomLights(
  px: number,
  pz: number,
  roomLights: RoomLight[]
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

/**
 * Chooses the few authored sources that can materially affect the visitor.
 * Grayboxes may describe every practical in-room fixture, but sending that
 * whole list to Three.js makes every wall shader grow with the room. The fixed
 * result length lets the fixtures retain their colour and placement while the
 * renderer sees the same three PointLights everywhere in the museum.
 */
export function selectAuthoredPointLights(
  roomId: string | null,
  px: number,
  pz: number,
  plans: Iterable<AuthoredPointLightPlan>,
  elapsedSeconds: number
): AuthoredPointLightSlot[] {
  if (!roomId) return createEmptyAuthoredPointLightPool();

  const candidates: Array<AuthoredPointLightSlot & { distanceSq: number }> = [];
  for (const plan of plans) {
    if (!plan.roomIds.includes(roomId)) continue;
    for (const light of plan.lights) {
      const dx = light.x - px;
      const dz = light.z - pz;
      const modulation =
        light.modulationHz && light.modulationDepth
          ? 1 +
            light.modulationDepth *
              Math.sin(elapsedSeconds * light.modulationHz * Math.PI * 2)
          : 1;
      candidates.push({
        ...light,
        intensity: Math.max(0, light.intensity * modulation),
        distanceSq: dx * dx + dz * dz,
      });
    }
  }

  candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  const selected: AuthoredPointLightSlot[] = [];
  for (let i = 0; i < MAX_AUTHORED_POINT_LIGHTS; i++) {
    const candidate = candidates[i];
    selected.push(
      candidate
        ? {
            x: candidate.x,
            y: candidate.y,
            z: candidate.z,
            color: candidate.color,
            intensity: candidate.intensity,
            distance: candidate.distance,
            modulationHz: candidate.modulationHz,
            modulationDepth: candidate.modulationDepth,
          }
        : { ...EMPTY_AUTHORED_SLOT }
    );
  }
  return selected;
}

function interpolateHexColor(from: string, to: string, amount: number): string {
  const parse = (value: string): number | null => {
    const normalized = value.startsWith("#") ? value.slice(1) : value;
    return /^[0-9a-fA-F]{6}$/.test(normalized)
      ? Number.parseInt(normalized, 16)
      : null;
  };
  const fromHex = parse(from);
  const toHex = parse(to);
  if (fromHex === null || toHex === null) return amount < 0.5 ? from : to;

  const channel = (shift: number): number => {
    const start = (fromHex >> shift) & 0xff;
    const end = (toHex >> shift) & 0xff;
    return Math.round(start + (end - start) * amount);
  };
  const rgb = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

function blendNumber(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function blendRoomLightPool(
  current: readonly RoomLightSlot[],
  target: readonly RoomLightSlot[],
  amount: number
): RoomLightSlot[] {
  const clamped = Math.max(0, Math.min(1, amount));
  return Array.from({ length: MAX_ROOM_LIGHTS }, (_, index) => {
    const from = current[index] ?? EMPTY_SLOT;
    const to = target[index] ?? EMPTY_SLOT;
    return {
      x: blendNumber(from.x, to.x, clamped),
      z: blendNumber(from.z, to.z, clamped),
      color: interpolateHexColor(from.color, to.color, clamped),
      intensity: blendNumber(from.intensity, to.intensity, clamped),
      distance: blendNumber(from.distance, to.distance, clamped),
    };
  });
}

export function blendAuthoredPointLightPool(
  current: readonly AuthoredPointLightSlot[],
  target: readonly AuthoredPointLightSlot[],
  amount: number
): AuthoredPointLightSlot[] {
  const clamped = Math.max(0, Math.min(1, amount));
  return Array.from({ length: MAX_AUTHORED_POINT_LIGHTS }, (_, index) => {
    const from = current[index] ?? EMPTY_AUTHORED_SLOT;
    const to = target[index] ?? EMPTY_AUTHORED_SLOT;
    return {
      x: blendNumber(from.x, to.x, clamped),
      y: blendNumber(from.y, to.y, clamped),
      z: blendNumber(from.z, to.z, clamped),
      color: interpolateHexColor(from.color, to.color, clamped),
      intensity: blendNumber(from.intensity, to.intensity, clamped),
      distance: blendNumber(from.distance, to.distance, clamped),
      modulationHz: to.modulationHz,
      modulationDepth: to.modulationDepth,
    };
  });
}

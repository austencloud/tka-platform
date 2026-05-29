import type { MuseumGrid } from "../domain/museum-grid-types";

export interface PortalLink {
  srcX: number;
  srcZ: number;
  destX: number;
  destZ: number;
  destYaw: number;
}

export interface PortalConfig {
  caveWing: MuseumGrid["wings"][0] | undefined;
  galleryWing: MuseumGrid["wings"][0] | undefined;
  bluePos: [number, number, number];
  orangePos: [number, number, number];
  blueRot: [number, number, number];
  orangeRot: [number, number, number];
  pairs: PortalLink[];
}

const PORTAL_RADIUS = 1.0;
const PORTAL_COOLDOWN_MS = 1500;
const ARRIVAL_OFFSET_TILES = 3;

export function createPortalConfig(grid: MuseumGrid, TILE_SIZE: number): PortalConfig {
  const caveWing = grid.wings.find((w) => w.theme === "cave");
  const galleryWing = grid.wings.find((w) => w.theme === "gallery");

  const bluePos: [number, number, number] = caveWing
    ? [
        caveWing.bounds.x * TILE_SIZE + TILE_SIZE / 2,
        1.5,
        (caveWing.bounds.y + caveWing.bounds.height / 2) * TILE_SIZE,
      ]
    : [0, 0, 0];
  const blueRot: [number, number, number] = [0, Math.PI / 2, 0];

  const orangePos: [number, number, number] = galleryWing
    ? [
        galleryWing.bounds.x * TILE_SIZE + TILE_SIZE / 2,
        1.5,
        (galleryWing.bounds.y + galleryWing.bounds.height / 2) * TILE_SIZE,
      ]
    : [0, 0, 0];
  const orangeRot: [number, number, number] = [0, Math.PI / 2, 0];

  const ARRIVAL_OFFSET = ARRIVAL_OFFSET_TILES * TILE_SIZE;
  const DEST_YAW = Math.PI / 2;

  const pairs: PortalLink[] =
    caveWing && galleryWing
      ? [
          {
            srcX: bluePos[0],
            srcZ: bluePos[2],
            destX: orangePos[0] + ARRIVAL_OFFSET,
            destZ: orangePos[2],
            destYaw: DEST_YAW,
          },
          {
            srcX: orangePos[0],
            srcZ: orangePos[2],
            destX: bluePos[0] + ARRIVAL_OFFSET,
            destZ: bluePos[2],
            destYaw: DEST_YAW,
          },
        ]
      : [];

  return { caveWing, galleryWing, bluePos, orangePos, blueRot, orangeRot, pairs };
}

export class PortalProximityChecker {
  private cooldownUntil = 0;
  constructor(private pairs: PortalLink[]) {}

  check(playerX: number, playerZ: number): PortalLink | null {
    if (this.pairs.length === 0) return null;

    const now = performance.now();
    if (now < this.cooldownUntil) return null;

    const r2 = PORTAL_RADIUS * PORTAL_RADIUS;
    for (const link of this.pairs) {
      const dx = playerX - link.srcX;
      const dz = playerZ - link.srcZ;
      if (dx * dx + dz * dz < r2) {
        this.cooldownUntil = now + PORTAL_COOLDOWN_MS;
        return link;
      }
    }
    return null;
  }
}

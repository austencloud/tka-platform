import {
  RingGeometry,
  MeshBasicMaterial,
  Mesh,
  DoubleSide,
  type Scene,
} from "three";
import type { MuseumGrid, WingTheme, Direction } from "../domain/museum-grid-types";
import { museum3dEditorState } from "../state/museum-3d-editor-state.svelte.ts";
import { savePlacement, removePlacement } from "./placement-persister";

export interface TorchSceneFns {
  add: (scene: Scene, x: number, z: number, woX: number, woZ: number, theme: WingTheme, id: string) => unknown;
  remove: (scene: Scene, id: string) => unknown;
}

interface PlacementEntry {
  placementId: string;
  roomId: string;
}

export class MuseumEditorPlacement {
  private history: PlacementEntry[] = [];

  constructor(
    private grid: MuseumGrid,
    private tileSize: number,
    private getScene: () => Scene | null,
    private torch: TorchSceneFns,
  ) {}

  place(worldX: number, worldZ: number, yaw: number, wallFacing: string | null): void {
    const def = museum3dEditorState.placementDef;
    if (!def) return;

    const tileX = Math.round(worldX / this.tileSize);
    const tileY = Math.round(worldZ / this.tileSize);
    const wing = this.grid.wings.find((w) => {
      const b = w.bounds;
      return (
        tileX >= b.x &&
        tileX < b.x + b.width &&
        tileY >= b.y &&
        tileY < b.y + b.height
      );
    });
    const roomId = wing?.id ?? "unknown";
    const placementId = `${roomId}-${def.id}-${Date.now()}`;

    const placement = {
      id: placementId,
      objectDefId: def.id,
      tileX,
      tileY,
      wallFacing: wallFacing as Direction | null,
      yaw,
    };

    savePlacement(roomId, placement);

    if (def.category === "fixture") {
      let wallOffsetX = 0;
      let wallOffsetZ = 0;
      if (wallFacing === "north") wallOffsetZ = -this.tileSize * 0.35;
      else if (wallFacing === "south") wallOffsetZ = this.tileSize * 0.35;
      else if (wallFacing === "west") wallOffsetX = -this.tileSize * 0.35;
      else if (wallFacing === "east") wallOffsetX = this.tileSize * 0.35;

      const scn = this.getScene();
      if (scn) {
        const wingTheme = (def.wingTheme ?? wing?.theme ?? "cave") as WingTheme;
        this.torch.add(
          scn,
          tileX * this.tileSize,
          tileY * this.tileSize,
          wallOffsetX,
          wallOffsetZ,
          wingTheme,
          placementId,
        );

        this.spawnPulse(
          scn,
          tileX * this.tileSize + wallOffsetX,
          tileY * this.tileSize + wallOffsetZ,
          wallFacing,
        );
      }

      this.history.push({ placementId, roomId });
    }
  }

  delete(placementId: string): void {
    const scn = this.getScene();
    if (scn) this.torch.remove(scn, placementId);

    const entry = this.history.find((h) => h.placementId === placementId);
    const roomId = entry?.roomId ?? "unknown";

    this.history = this.history.filter((h) => h.placementId !== placementId);
    removePlacement(roomId, placementId);
  }

  undo(): void {
    const entry = this.history.pop();
    if (!entry) return;

    const scn = this.getScene();
    if (scn) this.torch.remove(scn, entry.placementId);
    removePlacement(entry.roomId, entry.placementId);
  }

  private spawnPulse(
    scene: Scene,
    tx: number,
    tz: number,
    wallFacing: string | null,
  ): void {
    const fixtureY = 1.25;
    let normalX = 0,
      normalZ = 0;
    if (wallFacing === "north") normalZ = -1;
    else if (wallFacing === "south") normalZ = 1;
    else if (wallFacing === "west") normalX = -1;
    else if (wallFacing === "east") normalX = 1;

    const ring = new RingGeometry(0.05, 0.08, 32);
    const ringMat = new MeshBasicMaterial({
      color: 0xffcc44,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new Mesh(ring, ringMat);
    ringMesh.position.set(tx, fixtureY, tz);
    ringMesh.lookAt(tx + normalX, fixtureY, tz + normalZ);
    scene.add(ringMesh);

    const startTime = performance.now();
    const animatePulse = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / 400, 1);
      ringMesh.scale.setScalar(1 + t * 4);
      ringMat.opacity = 0.8 * (1 - t);
      if (t < 1) {
        requestAnimationFrame(animatePulse);
      } else {
        scene.remove(ringMesh);
        ring.dispose();
        ringMat.dispose();
      }
    };
    requestAnimationFrame(animatePulse);
  }
}

/**
 * Museum kit GLB loader + instancer.
 *
 * Loads the Blender-authored institutional wall-section module once, then
 * instances it along resolved wall runs via an InstancedMesh (one per room).
 * The 0.5m-wide section repeats per tile, giving modeled paneling + trim
 * instead of the procedural flat box. Geometry/material are cached and shared
 * across rooms, so disposeRoomChunk must NOT dispose them (flagged via
 * userData.sharedAssets).
 */

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { InstancedMesh, Matrix4, Euler, Quaternion, Vector3 } from "three";
import type { BufferGeometry, Material, Object3D } from "three";
import type { ResolvedWalls } from "../domain/museum-kit-types";

const KIT_BASE = "/models/museum/kit";

export interface KitAsset {
  geometry: BufferGeometry;
  material: Material;
}

const loader = typeof window !== "undefined" ? new GLTFLoader() : null;
const cache = new Map<string, KitAsset | null>();
const pending = new Map<string, Promise<KitAsset | null>>();

/** Load a themed wall-section GLB. Returns null if unavailable (caller falls back). */
export async function loadKitWallSection(theme: string): Promise<KitAsset | null> {
  if (!loader) return null;
  if (cache.has(theme)) return cache.get(theme)!;
  let p = pending.get(theme);
  if (!p) {
    p = fetchSection(theme);
    pending.set(theme, p);
  }
  const asset = await p;
  cache.set(theme, asset);
  pending.delete(theme);
  return asset;
}

async function fetchSection(theme: string): Promise<KitAsset | null> {
  try {
    const gltf = await loader!.loadAsync(`${KIT_BASE}/${theme}/wall-section.glb`);
    gltf.scene.updateMatrixWorld(true);
    let found: KitAsset | null = null;
    gltf.scene.traverse((obj) => {
      if (found) return;
      const mesh = obj as { isMesh?: boolean; geometry?: BufferGeometry; material?: Material; matrixWorld?: Matrix4 };
      if (mesh.isMesh && mesh.geometry && mesh.material) {
        // Bake the world transform into the geometry so instance matrices are clean.
        const geo = mesh.geometry.clone();
        if (mesh.matrixWorld) geo.applyMatrix4(mesh.matrixWorld);
        found = { geometry: geo, material: mesh.material };
      }
    });
    return found;
  } catch {
    return null;
  }
}

const _m = new Matrix4();
const _pos = new Vector3();
const _quat = new Quaternion();
const _euler = new Euler();
const _scale = new Vector3(1, 1, 1);

/**
 * Build one InstancedMesh placing the wall-section at every tile of every run.
 * x-axis runs face ±Z (no rotation); z-axis runs are rotated 90° about Y so the
 * section width runs along Z. Tile centers follow the builder convention
 * (center at tile*tileSize).
 */
export function buildGlbWalls(
  walls: ResolvedWalls,
  asset: KitAsset,
  tileSize: number,
): Object3D {
  const placements: { x: number; z: number; rotY: number }[] = [];
  for (const run of walls.runs) {
    for (let i = run.start; i <= run.end; i++) {
      if (run.axis === "x") {
        placements.push({ x: i * tileSize, z: run.fixed * tileSize, rotY: 0 });
      } else {
        placements.push({ x: run.fixed * tileSize, z: i * tileSize, rotY: Math.PI / 2 });
      }
    }
  }

  const inst = new InstancedMesh(asset.geometry, asset.material, placements.length);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!;
    _pos.set(p.x, 0, p.z);
    _euler.set(0, p.rotY, 0);
    _quat.setFromEuler(_euler);
    _m.compose(_pos, _quat, _scale);
    inst.setMatrixAt(i, _m);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  inst.receiveShadow = true;
  inst.userData.cameraCollider = true;
  // Geometry + material are shared/cached — disposeRoomChunk must skip them.
  inst.userData.sharedAssets = true;
  return inst;
}

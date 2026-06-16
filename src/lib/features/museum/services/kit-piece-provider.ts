import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from "three";
import type { Object3D } from "three";
import type { KitPieceProvider, ResolvedWalls, WallRun } from "../domain/museum-kit-types";
import type { WingTheme } from "../domain/museum-grid-types";

const ACCENT = "#9a8f7a";

function runDims(run: WallRun, tileSize: number) {
  const count = run.end - run.start + 1;
  const len = count * tileSize;
  // The museum builder places every tile box centered at tile*tileSize (no
  // half-tile offset). Match it exactly or the kit walls drift off the floor
  // edge and expose the floor-less perimeter row (see-through gaps).
  const centerAlong = ((run.start + run.end) / 2) * tileSize;
  const fixedWorld = run.fixed * tileSize;
  if (run.axis === "x") return { cx: centerAlong, cz: fixedWorld, lx: len, lz: tileSize };
  return { cx: fixedWorld, cz: centerAlong, lx: tileSize, lz: len };
}

export const proceduralKitProvider: KitPieceProvider = {
  buildWalls(
    walls: ResolvedWalls,
    _theme: WingTheme,
    tileSize: number,
    wallHeight: number,
    color: string,
  ): Object3D {
    const root = new Group();
    const wallMat = new MeshStandardMaterial({ color, roughness: 0.8 });
    const trimMat = new MeshStandardMaterial({ color: ACCENT, roughness: 0.6 });

    for (const run of walls.runs) {
      const { cx, cz, lx, lz } = runDims(run, tileSize);
      const wall = new Mesh(new BoxGeometry(lx, wallHeight, lz), wallMat);
      wall.position.set(cx, wallHeight / 2, cz);
      // Camera collision raycasts child meshes and reads userData.cameraCollider
      // on the hit object — so the flag goes on each wall mesh, not the Group.
      wall.userData.cameraCollider = true;
      wall.castShadow = true;
      wall.receiveShadow = true;
      root.add(wall);
      // baseboard + cornice trim (the "panel" read; replaced by GLB art in Phase 3)
      const base = new Mesh(new BoxGeometry(lx + 0.06, 0.6, lz + 0.06), trimMat);
      base.position.set(cx, 0.3, cz);
      root.add(base);
      const top = new Mesh(new BoxGeometry(lx + 0.06, 0.5, lz + 0.06), trimMat);
      top.position.set(cx, wallHeight - 0.25, cz);
      root.add(top);
    }
    return root;
  },
};

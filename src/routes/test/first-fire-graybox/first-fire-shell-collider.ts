/**
 * Collision built from the carved shell, so the room you see is the room you
 * walk.
 *
 * Until 2026-08-10 collision came entirely from `first-fire-graybox-colliders`:
 * the room's outer box, two threshold stops, and one upright box per edge of
 * every basalt mass's authored polygon. Those polygons are the outlines the
 * rock had BEFORE the courts and corridors were cut out of it - the build
 * reports `basaltMassesBuiltAsGeometry: 0`, because no basalt mesh is exported
 * at all. So the carve opened a chamber and its collider stayed sealed, and
 * Austen kept walking into a wall that had been removed from the model he was
 * looking at:
 *
 *   "if you're going to tear down the wall you should at least let me walk in
 *    that area instead of continually not allowing it"
 *
 * Deriving the collider from the shell mesh closes that gap by construction
 * rather than by maintenance. There is no second description of the room to
 * keep in step, so a carve that changes the walls changes where you can stand
 * in the same build.
 */
import { Mesh, Vector3, type Object3D } from "three";

/**
 * Node families that are structure rather than dressing.
 *
 * `FF_Shell_Rock` is the carved room - floors, walls and ceilings in one mesh.
 * The pads and the ember bridge are surfaces the route asks you to stand on.
 *
 * Everything else stays walk-through on purpose: fire guides, torch stems,
 * orbit rings, trenches, growth ribbons and the flame fields are placements and
 * markers, and a reviewer who has to walk around a torch to see the wall behind
 * it cannot judge the wall.
 */
const SOLID_NODE = /^FF_(Shell_Rock|PerformerPad_|Bridge_)/i;

export interface ShellTrimesh {
  /** Flat xyz triples in world space. */
  vertices: Float32Array;
  /** Triangle indices into `vertices`. */
  indices: Uint32Array;
  triangles: number;
  /** Which nodes contributed, so the collider can be verified from the page. */
  meshes: string[];
}

/**
 * Merge every structural mesh in the loaded GLB into one triangle soup.
 *
 * World space, not local: Threlte parents the GLB under its own group, and a
 * collider authored in the mesh's local frame lands wherever that group's
 * transform happens to put it. `updateWorldMatrix` first because the scene may
 * not have been rendered yet when the loader's ready callback runs.
 */
export function extractShellTrimesh(scene: Object3D): ShellTrimesh | null {
  scene.updateWorldMatrix(true, true);
  const positions: number[] = [];
  const indices: number[] = [];
  const meshes: string[] = [];
  const vertex = new Vector3();

  scene.traverse((object) => {
    if (!(object instanceof Mesh) || !SOLID_NODE.test(object.name)) return;
    const position = object.geometry.getAttribute("position");
    if (!position) return;

    const base = positions.length / 3;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      positions.push(vertex.x, vertex.y, vertex.z);
    }

    const geometryIndex = object.geometry.getIndex();
    if (geometryIndex) {
      for (let index = 0; index < geometryIndex.count; index += 1) {
        indices.push(base + geometryIndex.getX(index));
      }
    } else {
      // Non-indexed geometry is already one triangle per vertex triple.
      for (let index = 0; index < position.count; index += 1) {
        indices.push(base + index);
      }
    }
    meshes.push(object.name);
  });

  if (indices.length === 0) return null;
  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indices),
    triangles: indices.length / 3,
    meshes,
  };
}

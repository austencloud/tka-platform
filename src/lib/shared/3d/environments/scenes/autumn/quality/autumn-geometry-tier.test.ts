import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from "three";
import {
  applyAutumnGeometryTier,
  getAutumnRenderedTriangleCount,
  restoreAutumnGeometryTier,
} from "./autumn-geometry-tier";

function instanced(materialName: string, count: number): InstancedMesh {
  const material = new MeshStandardMaterial();
  material.name = materialName;
  return new InstancedMesh(new BoxGeometry(1, 1, 1), material, count);
}

function place(mesh: InstancedMesh, positions: readonly number[]): void {
  positions.forEach((x, index) => {
    mesh.setMatrixAt(index, new Matrix4().makeTranslation(x, 0, 0));
  });
  mesh.instanceMatrix.needsUpdate = true;
}

describe("Autumn geometry tiers", () => {
  it("keeps every authored placement at every quality tier", () => {
    const scene = new Group();
    const ferns = instanced("Autumn Fern PBR", 10);
    place(ferns, [0, 1, 2, 3, 4, 64, 65, 66, 67, 68]);
    scene.add(ferns);
    scene.add(instanced("Autumn Birch PBR", 12));
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));

    const high = applyAutumnGeometryTier(scene, "high");
    const medium = applyAutumnGeometryTier(scene, "medium");
    const low = applyAutumnGeometryTier(scene, "low");

    expect(high.visibleTriangles).toBe(high.authoredTriangles);
    expect(medium.visibleTriangles).toBe(high.visibleTriangles);
    expect(low.visibleTriangles).toBe(high.visibleTriangles);
    expect(low.trimmedInstances).toBe(0);
    expect(getAutumnRenderedTriangleCount(scene)).toBe(low.visibleTriangles);
  });

  it("partitions broad repeated families into exact spatial culling cells", () => {
    const scene = new Group();
    const ferns = instanced("Autumn Fern PBR", 10);
    place(ferns, [0, 1, 2, 3, 4, 64, 65, 66, 67, 68]);
    scene.add(ferns);

    const report = applyAutumnGeometryTier(scene, "low");
    const buckets = scene.children.filter(
      (child): child is InstancedMesh =>
        child instanceof InstancedMesh && child !== ferns
    );

    expect(report.spatialBatches).toBe(2);
    expect(scene.matrixAutoUpdate).toBe(true);
    expect(ferns.matrixAutoUpdate).toBe(false);
    expect(scene.children).not.toContain(ferns);
    expect(buckets.map((bucket) => bucket.count)).toEqual([5, 5]);
    expect(buckets.every((bucket) => bucket.geometry === ferns.geometry)).toBe(
      true
    );

    restoreAutumnGeometryTier(scene);
    expect(scene.children).toContain(ferns);
    expect(ferns.count).toBe(10);
    expect(ferns.matrixAutoUpdate).toBe(true);
  });

  it("leaves unknown instanced batches untouched", () => {
    const scene = new Group();
    const unknown = instanced("Unrelated Material", 27);
    scene.add(unknown);
    applyAutumnGeometryTier(scene, "low");
    expect(unknown.count).toBe(27);
  });
});

import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
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

describe("Autumn geometry tiers", () => {
  it("keeps high intact and makes medium and low materially cheaper", () => {
    const scene = new Group();
    scene.add(instanced("Autumn Fern PBR", 54));
    scene.add(instanced("Autumn Birch PBR", 12));
    scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()));

    const high = applyAutumnGeometryTier(scene, "high");
    const medium = applyAutumnGeometryTier(scene, "medium");
    const low = applyAutumnGeometryTier(scene, "low");

    expect(high.visibleTriangles).toBe(high.authoredTriangles);
    expect(medium.visibleTriangles).toBeLessThan(high.visibleTriangles * 0.8);
    expect(low.visibleTriangles).toBeLessThan(high.visibleTriangles * 0.5);
    expect(getAutumnRenderedTriangleCount(scene)).toBe(low.visibleTriangles);
  });

  it("restores the authored counts when the scene owner unmounts", () => {
    const scene = new Group();
    const ferns = instanced("Autumn Fern PBR", 54);
    scene.add(ferns);

    applyAutumnGeometryTier(scene, "low");
    expect(ferns.count).toBe(18);
    restoreAutumnGeometryTier(scene);
    expect(ferns.count).toBe(54);
  });

  it("leaves unknown instanced batches untouched", () => {
    const scene = new Group();
    const unknown = instanced("Unrelated Material", 27);
    scene.add(unknown);
    applyAutumnGeometryTier(scene, "low");
    expect(unknown.count).toBe(27);
  });
});

import { describe, expect, it } from "vitest";
import {
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import {
  extractFirstFireFlameAnchors,
  FirstFireFlameFieldRenderer,
} from "../../../src/routes/test/first-fire-graybox/first-fire-flame-field";

function flameGuide(
  materialName: string,
  placements: Array<{ position: Vector3; scale: Vector3 }>
): InstancedMesh {
  const material = new MeshBasicMaterial();
  material.name = materialName;
  const mesh = new InstancedMesh(
    new PlaneGeometry(1, 1),
    material,
    placements.length
  );
  const matrix = new Matrix4();
  for (const [index, placement] of placements.entries()) {
    matrix.makeScale(placement.scale.x, placement.scale.y, placement.scale.z);
    matrix.setPosition(placement.position);
    mesh.setMatrixAt(index, matrix);
  }
  return mesh;
}

describe("First Fire instanced flame field", () => {
  it("extracts world transforms from each Blender flame-guide batch", () => {
    const root = new Group();
    root.position.set(4, 0.5, -3);
    const dj = flameGuide("FF DJ Flame Guide", [
      { position: new Vector3(1, 2, 3), scale: new Vector3(0.2, 0.8, 0.2) },
      { position: new Vector3(5, 1, -2), scale: new Vector3(0.3, 0.9, 0.3) },
    ]);
    const ek = flameGuide("FF EK Flame Guide", [
      {
        position: new Vector3(-2, 2.5, 1),
        scale: new Vector3(0.25, 0.7, 0.25),
      },
    ]);
    const unrelated = flameGuide("FF Charred Torch Wood", [
      { position: new Vector3(0, 0, 0), scale: new Vector3(1, 1, 1) },
    ]);
    root.add(dj, ek, unrelated);

    const anchors = extractFirstFireFlameAnchors(root);

    expect(anchors).toHaveLength(3);
    expect(anchors.map((anchor) => anchor.palette)).toEqual([0, 0, 1]);
    expect(anchors[0]?.position).toEqual([5, 2.5, 0]);
    expect(anchors[0]?.scale[0]).toBeCloseTo(0.2, 6);
    expect(anchors[0]?.scale[1]).toBeCloseTo(0.8, 6);
    expect(anchors[0]?.scale[2]).toBeCloseTo(0.2, 6);
    expect(dj.visible).toBe(false);
    expect(ek.visible).toBe(false);
    expect(unrelated.visible).toBe(true);
  });

  it("renders every anchor in one billboard batch with pooled corridor lights", () => {
    const anchors = Array.from({ length: 126 }, (_, index) => ({
      position: [index * 0.4, 1.8, (index % 7) - 3] as [number, number, number],
      scale: [0.24, 0.8, 0.24] as [number, number, number],
      palette: (index % 3) as 0 | 1 | 2,
      seed: index / 126,
    }));
    const renderer = new FirstFireFlameFieldRenderer(anchors);

    expect(renderer.mesh.count).toBe(126);
    expect(renderer.mesh.geometry.getAttribute("aSeed").count).toBe(126);
    expect(renderer.mesh.geometry.getAttribute("aPalette").count).toBe(126);
    expect(renderer.lights).toHaveLength(6);

    renderer.update(1 / 60);
    expect(renderer.lights.every((light) => light.intensity > 0)).toBe(true);
    renderer.dispose();
  });
});

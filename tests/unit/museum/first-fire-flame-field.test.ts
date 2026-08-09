import { describe, expect, it } from "vitest";
import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import {
  extractFirstFireFlameAnchors,
  FirstFireFlameFieldRenderer,
} from "../../../src/routes/test/first-fire-graybox/first-fire-flame-field";

function instancedFlameGuide(
  name: string,
  placements: Array<{ position: Vector3; scale: Vector3 }>
): InstancedMesh {
  const mesh = new InstancedMesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial(),
    placements.length
  );
  mesh.name = name;
  const matrix = new Matrix4();
  for (const [index, placement] of placements.entries()) {
    matrix.makeScale(placement.scale.x, placement.scale.y, placement.scale.z);
    matrix.setPosition(placement.position);
    mesh.setMatrixAt(index, matrix);
  }
  return mesh;
}

describe("First Fire semantic flame field", () => {
  it("extracts individual and instanced Blender guides by the schema-v2 names", () => {
    const root = new Group();
    root.position.set(4, 0.5, -3);
    const field = instancedFlameGuide("FF_Field_Instanced", [
      { position: new Vector3(1, 2, 3), scale: new Vector3(0.2, 0.8, 0.2) },
      { position: new Vector3(5, 1, -2), scale: new Vector3(0.3, 0.9, 0.3) },
    ]);
    (field.material as MeshBasicMaterial).name = "FF Field Flame Guide";
    const ek = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial());
    ek.name = "FF_FlameGuide_ek_007";
    ek.position.set(-2, 2.5, 1);
    ek.scale.set(0.25, 0.7, 0.25);
    const unrelated = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial()
    );
    unrelated.name = "FF_TorchStem_Field_001";
    root.add(field, ek, unrelated);

    const anchors = extractFirstFireFlameAnchors(root);

    expect(anchors).toHaveLength(3);
    expect(anchors.map((anchor) => anchor.group)).toEqual([
      "field",
      "field",
      "ek",
    ]);
    expect(anchors.map((anchor) => anchor.palette)).toEqual([0, 0, 1]);
    expect(anchors[0]?.position).toEqual([5, 2.5, 0]);
    expect(anchors[0]?.scale[1]).toBeCloseTo(0.8, 6);
    expect(field.visible).toBe(false);
    expect(ek.visible).toBe(false);
    expect(unrelated.visible).toBe(true);
  });

  it("batches 126 flames, filters them by authored state, and pools shadow lights", () => {
    const anchors = Array.from({ length: 126 }, (_, index) => ({
      position: [index * 0.4, 1.8, (index % 7) - 3] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      palette: (index % 3) as 0 | 1 | 2,
      group: (["field", "dj", "ek", "fl"] as const)[index % 4]!,
      seed: index / 126,
    }));
    const renderer = new FirstFireFlameFieldRenderer(anchors);

    expect(renderer.mesh.count).toBe(126);
    expect(renderer.mesh.geometry.getAttribute("aSeed").count).toBe(126);
    expect(renderer.mesh.geometry.getAttribute("aPalette").count).toBe(126);
    expect(renderer.mesh.geometry.getAttribute("aVisibility").count).toBe(126);
    expect(renderer.lights).toHaveLength(6);
    expect(renderer.lights.every((light) => light.castShadow)).toBe(true);

    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    renderer.mesh.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);
    expect(scale.x).toBeCloseTo(0.48, 6);
    expect(scale.y).toBeCloseTo(0.88, 6);

    renderer.setVisibleGroups(new Set(["ek"]));
    const visibility = renderer.mesh.geometry.getAttribute("aVisibility");
    expect(visibility.getX(0)).toBe(0);
    expect(visibility.getX(2)).toBe(1);
    renderer.update(1 / 60);
    expect(renderer.lights.every((light) => light.intensity >= 0)).toBe(true);
    renderer.dispose();
  });

  it("assigns optimized field instances to their nearest authored fire state", () => {
    const root = new Group();
    const field = instancedFlameGuide("FF_Field_Instanced", [
      { position: new Vector3(0, 1, 0), scale: new Vector3(1, 1, 1) },
      { position: new Vector3(10, 1, 0), scale: new Vector3(1, 1, 1) },
    ]);
    (field.material as MeshBasicMaterial).name = "FF Field Flame Guide";
    root.add(field);

    const anchors = extractFirstFireFlameAnchors(root, [
      {
        kind: "torch-field",
        state: "always",
        blenderPoints: [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
        ],
      },
      {
        kind: "fire-wall",
        state: "dj",
        blenderPoints: [
          { x: 9, y: 0, z: 0 },
          { x: 11, y: 0, z: 0 },
        ],
      },
    ]);

    expect(anchors.map((anchor) => anchor.group)).toEqual(["field", "dj"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Texture,
  Vector3,
} from "three";
import {
  createForestRuntimeTreeInstances,
  disposeForestRuntimeEcology,
} from "$lib/shared/3d/environments/scenes/forest/forest-runtime-ecology";

describe("forest runtime ecology", () => {
  it("uses simplified geometry with the accepted near-tree material payload", () => {
    const placeholderMaterial = new MeshStandardMaterial({ color: "#ffffff" });
    placeholderMaterial.name = "tree-bark";
    const geometrySource = new Group();
    geometrySource.add(new Mesh(new BoxGeometry(1, 2, 1), placeholderMaterial));

    const acceptedTexture = new Texture();
    const acceptedMaterial = new MeshStandardMaterial({
      color: "#48623f",
      map: acceptedTexture,
    });
    acceptedMaterial.name = "tree-bark";
    const materialSource = new Group();
    materialSource.add(new Mesh(new BoxGeometry(1, 2, 1), acceptedMaterial));

    const runtime = createForestRuntimeTreeInstances(
      geometrySource,
      [
        {
          x: 4,
          y: 3,
          z: -6,
          rotation: Math.PI / 4,
          renderedHeightMeters: 10,
        },
      ],
      "test-tree",
      { materialSource, distanceTier: "far" }
    );
    const instances = runtime.children[0] as InstancedMesh;
    const runtimeMaterial = instances.material as MeshStandardMaterial;
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const scale = new Vector3();
    instances.getMatrixAt(0, matrix);
    matrix.decompose(position, rotation, scale);

    expect(instances.geometry).toBe(
      (geometrySource.children[0] as Mesh).geometry
    );
    expect(runtimeMaterial).not.toBe(acceptedMaterial);
    expect(runtimeMaterial.name).toBe("tree-bark");
    expect(runtimeMaterial.map).toBe(acceptedTexture);
    expect(runtimeMaterial.color.getHexString()).toBe("48623f");
    expect(instances.userData.forestDistanceTier).toBe("far");
    expect(scale.y).toBeCloseTo(5);
    expect(position).toMatchObject({ x: 4, y: 8, z: -6 });

    disposeForestRuntimeEcology(runtime);
    (geometrySource.children[0] as Mesh).geometry.dispose();
    placeholderMaterial.dispose();
    (materialSource.children[0] as Mesh).geometry.dispose();
    acceptedMaterial.dispose();
    acceptedTexture.dispose();
  });
});

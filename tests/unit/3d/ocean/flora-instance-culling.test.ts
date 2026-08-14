import { describe, expect, it } from "vitest";
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import { createAuthoredFloraCuller } from "$lib/shared/3d/environments/scenes/ocean/authored/flora-instance-culling";

function translations(mesh: InstancedMesh): number[] {
  const matrix = new Matrix4();
  const position = new Vector3();
  const values: number[] = [];
  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    values.push(position.x);
  }
  return values;
}

describe("authored ocean flora instance culling", () => {
  it("keeps one batch and compacts it to visible authored instances", () => {
    const root = new Group();
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new InstancedMesh(geometry, material, 3);
    const matrix = new Matrix4();
    const color = new Color();
    [-30, 0, 30].forEach((x, index) => {
      mesh.setMatrixAt(index, matrix.makeTranslation(x, 0, 0));
      mesh.setColorAt(index, color.setRGB(index / 3, 0.5, 1));
    });
    root.add(mesh);
    root.updateMatrixWorld(true);

    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const culler = createAuthoredFloraCuller(root, {
      minRenderedVerticesPerBatch: 1,
      boundsPadding: 0,
    });
    const stats = culler.update(camera);

    expect(root.children).toEqual([mesh]);
    expect(stats).toMatchObject({
      sourceBatches: 1,
      culledBatches: 1,
      instances: 3,
      visibleInstances: 1,
    });
    expect(mesh.count).toBe(1);
    expect(translations(mesh)).toEqual([0]);
    expect(mesh.instanceColor).not.toBeNull();
    expect(mesh.frustumCulled).toBe(false);

    // An unchanged camera reuses the prior visibility sample, while a moved
    // camera recomputes and restores the newly visible authored instance.
    expect(culler.update(camera)).toBe(stats);
    camera.position.set(30, 0, 10);
    camera.lookAt(30, 0, 0);
    camera.updateMatrixWorld(true);
    expect(culler.update(camera).visibleInstances).toBe(1);
    expect(translations(mesh)).toEqual([30]);

    culler.restore();
    expect(mesh.count).toBe(3);
    expect(translations(mesh)).toEqual([-30, 0, 30]);
    expect(mesh.frustumCulled).toBe(true);
  });

  it("leaves cheap batches untouched", () => {
    const root = new Group();
    const mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial(),
      2
    );
    root.add(mesh);

    const culler = createAuthoredFloraCuller(root, {
      minRenderedVerticesPerBatch: 1_000,
    });

    expect(culler.stats.culledBatches).toBe(0);
    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.count).toBe(2);
  });
});

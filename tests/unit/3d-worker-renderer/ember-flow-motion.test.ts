import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Box3, Matrix4, Vector3, type InstancedMesh, type Mesh } from "three";
import {
  measureFlowPath,
  sampleFlowPath,
} from "$lib/shared/3d/environments/worlds/ember/ember-flow-motion";
import { createMidflankLava } from "$lib/shared/3d/environments/worlds/ember/ember-midflank-finish";

describe("Ember drifting crust", () => {
  it("travels by distance through uneven samples and wraps without reversing", () => {
    const path = measureFlowPath([
      new Vector3(0, 5, 10),
      new Vector3(0, 5, 9),
      new Vector3(0, 5, 0),
    ]);
    const position = new Vector3(),
      tangent = new Vector3();
    sampleFlowPath(path, 4, position, tangent);
    expect(position.toArray()).toEqual([0, 5, 6]);
    expect(tangent.toArray()).toEqual([0, 0, -1]);
    sampleFlowPath(path, 14, position, tangent);
    expect(position.z).toBe(6);
    sampleFlowPath(path, -1, position, tangent);
    expect(position.z).toBe(1);
  });

  it("keeps degenerate paths finite", () => {
    const point = new Vector3(1, 2, 3),
      output = new Vector3(),
      tangent = new Vector3();
    sampleFlowPath(measureFlowPath([point, point]), 100, output, tangent);
    expect(output.toArray()).toEqual([1, 2, 3]);
  });

  it("preserves shader coordinates and metre-sized moving rafts after GLB optimization", async () => {
    const bytes = readFileSync(
      "static/models/ember/ember-production-slice.glb"
    );
    const data = new Uint8Array(bytes.length);
    data.set(bytes);
    const gltf = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(data.buffer, "");
    gltf.scene.position.y = -1.5;
    gltf.scene.updateMatrixWorld(true);
    const deposit = gltf.scene.getObjectByName(
      "EMBER_LavaSimulatorDeposit"
    ) as Mesh;
    expect(deposit.geometry.getAttribute("uv").count).toBeGreaterThan(20_000);
    expect(deposit.geometry.getAttribute("color").count).toBe(
      deposit.geometry.getAttribute("position").count
    );
    const bank = deposit.geometry.getAttribute("color");
    let minimum = Infinity,
      maximum = -Infinity;
    for (let index = 0; index < bank.count; index++) {
      minimum = Math.min(minimum, bank.getX(index));
      maximum = Math.max(maximum, bank.getX(index));
    }
    expect(minimum).toBe(0);
    expect(maximum).toBe(1);
    expect(deposit.userData.ember_flow_paths_space).toBe(
      "world-relative-to-groundY"
    );
    expect(
      gltf.scene.getObjectByName("EMBER_BakedLavaClinker")
    ).toBeUndefined();
    const runtime = createMidflankLava(gltf.scene, -1.5);
    const rafts = runtime.object.getObjectByName(
      "EmberDriftingCrust"
    ) as InstancedMesh;
    const bounds = new Box3().setFromBufferAttribute(
      rafts.geometry.getAttribute("position")
    );
    const size = bounds.getSize(new Vector3());
    expect(size.x).toBeGreaterThan(0.7);
    expect(size.x).toBeLessThan(1.2);
    expect(size.y).toBeLessThan(0.08);
    const before = new Matrix4(),
      after = new Matrix4();
    rafts.getMatrixAt(30, before);
    for (let frame = 0; frame < 60; frame++) runtime.update(1 / 60, frame / 60);
    rafts.getMatrixAt(30, after);
    const a = new Vector3().setFromMatrixPosition(before),
      b = new Vector3().setFromMatrixPosition(after);
    expect(b.z).toBeLessThan(a.z);
    expect(a.distanceTo(b)).toBeGreaterThan(0.5);
    expect(a.distanceTo(b)).toBeLessThan(0.9);
    const frozen = rafts.instanceMatrix.array.slice();
    runtime.update(0, 99);
    expect(rafts.instanceMatrix.array).toEqual(frozen);
    runtime.setGroundY(2);
    expect(runtime.object.position.y).toBe(2);
    const dispose = vi.spyOn(rafts.geometry, "dispose");
    runtime.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from "vitest";
import { PerspectiveCamera, PointLight, Points, ShaderMaterial } from "three";
import { makeRng } from "$lib/shared/foundation/utils/seeded-rng";
import { createRainbowEnvironmentWorld } from "$lib/shared/3d/environments/worlds/rainbow/rainbow-environment-world";
import { createRainbowPrototypeWorld } from "$lib/shared/3d/worker-renderer/worlds/rainbow-prototype-world";

describe("Rainbow environment world", () => {
  it("builds the production scene graph without Svelte or DOM ownership", () => {
    const world = createRainbowEnvironmentWorld({
      groundY: -1.5,
      stageRadius: 3,
      random: makeRng("rainbow-parity"),
    });

    const names = new Set<string>();
    const fields: Points[] = [];
    const lights: PointLight[] = [];
    world.root.traverse((object) => {
      if (object.name) names.add(object.name);
      if (object instanceof Points) fields.push(object);
      if (object instanceof PointLight) lights.push(object);
    });

    for (const name of [
      "rainbow-environment-world",
      "rainbow-sky-gradient",
      "rainbow-aurora-curtains",
      "rainbow-caustic-ground",
      "rainbow-accent-ring",
    ]) {
      expect(names.has(name)).toBe(true);
    }
    expect(fields).toHaveLength(4);
    expect(
      fields.map((field) => field.geometry.getAttribute("position").count)
    ).toEqual([80, 60, 180, 100]);
    expect(lights).toHaveLength(18);
    expect(world.fog.color.getHexString()).toBe("08001a");

    world.dispose();
    expect(world.root.children).toHaveLength(0);
  });

  it("advances the exact world animation and keeps its sky on the camera", () => {
    const world = createRainbowEnvironmentWorld({
      groundY: -1.5,
      random: makeRng("rainbow-animation"),
    });
    const camera = new PerspectiveCamera();
    camera.position.set(2, 4, 17);
    const sky = world.root.getObjectByName("rainbow-sky-gradient")!;
    const aurora = world.root.getObjectByName("rainbow-aurora-curtains") as {
      material: ShaderMaterial;
    };

    world.update(1 / 60, 2.5, camera);

    expect(sky.position.toArray()).toEqual([2, 4, 17]);
    expect(aurora.material.uniforms.uTime?.value).toBeCloseTo(1 / 60);
    world.dispose();
  });

  it("is the scene graph used by the worker adapter", async () => {
    const progress = vi.fn();
    const camera = new PerspectiveCamera();
    const world = await createRainbowPrototypeWorld({
      renderer: {} as never,
      camera,
      requestId: 4,
      reportProgress: progress,
    });

    expect(
      world.scene.getObjectByName("rainbow-environment-world")
    ).toBeTruthy();
    expect(progress).toHaveBeenLastCalledWith("construct", 1);
    world.update(1 / 60, 1);
    world.dispose();
    expect(world.scene.children).toHaveLength(0);
  });
});

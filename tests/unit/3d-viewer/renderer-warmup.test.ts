import { describe, expect, it, vi } from "vitest";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
} from "three";
import { warmupRenderer } from "$lib/shared/3d/scene-boot/renderer-warmup";

describe("warmupRenderer", () => {
  it("compiles hidden effect materials and restores their live visibility", async () => {
    const scene = new Scene();
    const hiddenGroup = new Group();
    hiddenGroup.visible = false;
    const hiddenEffect = new Mesh(undefined, new MeshBasicMaterial());
    hiddenEffect.visible = false;
    hiddenGroup.add(hiddenEffect);
    scene.add(hiddenGroup);
    const compileAsync = vi.fn(async (object: Scene) => {
      expect(object).toBe(scene);
      expect(hiddenGroup.visible).toBe(true);
      expect(hiddenEffect.visible).toBe(true);
    });

    await warmupRenderer({
      renderer: { compileAsync } as never,
      scene,
      camera: new PerspectiveCamera(),
    });

    expect(compileAsync).toHaveBeenCalledWith(
      scene,
      expect.any(PerspectiveCamera),
      scene
    );
    expect(compileAsync).toHaveBeenCalledTimes(1);
    expect(hiddenGroup.visible).toBe(false);
    expect(hiddenEffect.visible).toBe(false);
  });
});

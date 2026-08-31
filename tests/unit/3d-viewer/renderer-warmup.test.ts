import { describe, expect, it, vi } from "vitest";
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from "three";
import { warmupRenderer } from "$lib/shared/3d/scene-boot/renderer-warmup";

describe("warmupRenderer", () => {
  it("compiles hidden effect materials and restores their live visibility", async () => {
    const scene = new Scene();
    const hiddenEffect = new Mesh(undefined, new MeshBasicMaterial());
    hiddenEffect.visible = false;
    scene.add(hiddenEffect);
    const compileAsync = vi.fn(async (object: Mesh) => {
      expect(object.visible).toBe(true);
    });

    await warmupRenderer({
      renderer: { compileAsync } as never,
      scene,
      camera: new PerspectiveCamera(),
    });

    expect(compileAsync).toHaveBeenCalledWith(
      hiddenEffect,
      expect.any(PerspectiveCamera),
      scene
    );
    expect(hiddenEffect.visible).toBe(false);
  });
});

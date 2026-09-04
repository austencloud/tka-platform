import { beforeEach, describe, expect, it, vi } from "vitest";
import { FogExp2, Group, PerspectiveCamera, type WebGLRenderer } from "three";

const factory = vi.hoisted(() => vi.fn());

vi.mock(
  "$lib/shared/3d/environments/worlds/cosmic/cosmic-environment-world",
  () => ({ createCosmicEnvironmentWorld: factory })
);

import {
  COSMIC_PROTOTYPE_CAMERA,
  createCosmicPrototypeWorld,
} from "$lib/shared/3d/worker-renderer/worlds/cosmic-prototype-world";

describe("createCosmicPrototypeWorld", () => {
  beforeEach(() => {
    factory.mockReset();
  });

  it("keeps worker concerns outside the shared production world", async () => {
    const root = new Group();
    const fog = new FogExp2("#080818", 0.008);
    const update = vi.fn();
    const setGroundY = vi.fn();
    const dispose = vi.fn();
    factory.mockImplementation(async (options) => {
      options.onAssetProgress(0.6);
      return {
        root,
        fog,
        audienceReady: Promise.resolve(),
        update,
        setGroundY,
        dispose,
      };
    });
    const reportProgress = vi.fn();
    const camera = new PerspectiveCamera();
    const renderer = {} as WebGLRenderer;
    const world = await createCosmicPrototypeWorld({
      renderer,
      camera,
      requestId: 3,
      performers: [
        {
          id: "performer-1",
          characterId: "x-bot",
          propType: "staff",
          groundY: -1.25,
          stageAnchorY: 0,
          position: [0, 0, 0],
          facingRadians: 0,
          scale: 1,
          leftProp: null,
          rightProp: null,
          upperBodyStance: null,
        },
      ],
      reportProgress,
    });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ renderer, groundY: -1.25, stageRadius: 3 })
    );
    expect(world.environment).toBe("cosmic");
    expect(world.useViewerBaseLighting).toBe(false);
    expect(world.scene.children).toContain(root);
    expect(world.scene.fog).toBe(fog);
    expect(reportProgress).toHaveBeenCalledWith("assets", 0.6);
    expect(reportProgress).toHaveBeenLastCalledWith("construct", 1);

    world.update(0.25, 2);
    expect(update).toHaveBeenCalledWith(0.25, 2, camera);
    world.setPerformers?.([{ groundY: 1.5 } as never]);
    expect(setGroundY).toHaveBeenCalledWith(1.5);

    world.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(world.scene.children).not.toContain(root);
    expect(world.scene.fog).toBeNull();
  });

  it("pins the same initial framing used by the production viewer", () => {
    expect(COSMIC_PROTOTYPE_CAMERA).toEqual({
      position: [0, 4.2, 17],
      target: [0, 1.1, -1],
      fov: 48,
    });
  });
});

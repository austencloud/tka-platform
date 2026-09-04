import { describe, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Texture,
} from "three";

import { createDefaultCelestialConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
import { CLOUDBREAK_LAYOUT } from "$lib/shared/3d/environments/scenes/celestial/cloudbreak-layout";
import {
  CELESTIAL_AUTHORED_RESOURCE_URLS,
  createCelestialEnvironmentWorld,
  type CelestialEnvironmentAssets,
} from "$lib/shared/3d/environments/worlds/celestial/celestial-environment-world";
import { CELESTIAL_AUTHORED_RESOURCE_COUNT } from "$lib/shared/3d/environments/worlds/celestial/celestial-cloudbreak-world";

function assetScene(name: string): Group {
  const root = new Group();
  root.name = name;
  const mesh = new Mesh(
    new BoxGeometry(1, 2, 1),
    new MeshStandardMaterial({ color: "#ffffff" })
  );
  root.add(mesh);
  return root;
}

function assets(): CelestialEnvironmentAssets {
  const shell = new Group();
  const landmass = new Mesh(
    new BoxGeometry(4, 1, 6),
    new MeshStandardMaterial({ color: "#ffffff" })
  );
  landmass.userData.tka_role = "cloudbreak-landmass";
  shell.add(landmass);
  const placeholder = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: "#ffffff" })
  );
  placeholder.userData.tka_role = "cloudbreak-olive-trunk";
  shell.add(placeholder);
  return {
    panorama: new Texture(),
    shell,
    placements: new Map([
      ["olive-west-ancient", assetScene("west-olive")],
      ["olive-east-windswept", assetScene("east-olive")],
      ["coast-rocks-05", assetScene("coast-rocks")],
      ["sand-rocks-small-01", assetScene("sand-rocks")],
    ]),
  };
}

describe("Celestial renderer-neutral world", () => {
  it("declares the exact six Revision 6 authored resources", () => {
    expect(CELESTIAL_AUTHORED_RESOURCE_COUNT).toBe(6);
    expect(CELESTIAL_AUTHORED_RESOURCE_URLS).toHaveLength(6);
    expect(CELESTIAL_AUTHORED_RESOURCE_URLS).toEqual([
      expect.stringContaining("olive-cloudbreak-panorama-r1.webp"),
      expect.stringContaining("olive-cloudbreak-production-slice.glb"),
      "/models/celestial/cloudbreak/source/olive-west-ancient.glb",
      "/models/celestial/cloudbreak/source/olive-east-windswept.glb",
      "/models/celestial/cloudbreak/rocks/coast-rocks-05.glb",
      "/models/celestial/cloudbreak/rocks/sand-rocks-small-01.glb",
    ]);
    expect(
      CELESTIAL_AUTHORED_RESOURCE_URLS.some((url) =>
        url.includes("integrated-sanctuaries")
      )
    ).toBe(false);
  });

  it("builds the complete production graph, stage, lighting, and globals", () => {
    const world = createCelestialEnvironmentWorld(
      {
        groundY: -1.5,
        worldYOffset: 1.275,
        stageRadius: 3,
        stageRadiusGrowth: 0,
      },
      assets()
    );
    const names: string[] = [];
    world.root.traverse((object) => names.push(object.name));

    expect(names).toContain("celestial-sky-gradient");
    expect(names).toContain("celestial-cloud-panorama");
    expect(names).toContain("celestial-sun");
    expect(names).toContain("celestial-cloudbreak-world");
    expect(names).toContain("cloudbreak-shell-mirror");
    expect(names).toContain("cloudbreak-spatial-study");
    expect(names).toContain("cloudbreak-lagoon-edge");
    expect(
      names.filter((name) => name === "cloudbreak-waterfall")
    ).toHaveLength(4);
    expect(
      names.filter((name) => name.startsWith("cloudbreak-placement:"))
    ).toHaveLength(4);
    expect(names).toContain("celestial-lighting");
    expect(names).toContain("celestial-sun-light");
    expect(names).toContain("celestial-cold-fill");
    expect(world.fog.color.getHexString()).toBe("b7c9d7");
    expect(world.fog.density).toBe(0.009);
    expect(world.background.getHexString()).toBe("6797cf");
    expect(world.reflector.name).toBe("cloudbreak-reflective-lagoon");
    expect(world.reflector.position.y).toBeCloseTo(-0.05, 6);
    expect(world.reflector.rotation.x).toBeCloseTo(-Math.PI / 2, 6);

    const mirror = world.root.getObjectByName("cloudbreak-shell-mirror")!;
    expect(mirror.scale.toArray()).toEqual([-1, 1, -1]);
    const hiddenPlaceholder = mirror.children[0]!.children[1]!;
    expect(hiddenPlaceholder.visible).toBe(false);
    world.dispose();
  });

  it("animates camera-centred sky, sun, water, and interaction pulse", () => {
    const world = createCelestialEnvironmentWorld(
      { groundY: -1.5, motionScale: 1 },
      assets()
    );
    const camera = new PerspectiveCamera();
    camera.position.set(3, 7, 11);
    const panorama = world.root.getObjectByName("celestial-cloud-panorama")!;
    const sun = world.root.getObjectByName("celestial-sun")!;
    const halo = world.root.getObjectByName("celestial-sun-halo") as Mesh;
    const beforeOpacity = (halo as unknown as { material: { opacity: number } })
      .material.opacity;

    world.update(0.25, 0.25, camera);
    expect(panorama.position.toArray()).toEqual([3, 7, 11]);
    expect(sun.children[0]!.position.distanceTo(camera.position)).toBeCloseTo(
      145,
      5
    );
    world.pulse();
    world.update(0.01, 0.26, camera);
    const afterOpacity = (halo as unknown as { material: { opacity: number } })
      .material.opacity;
    expect(afterOpacity).toBeGreaterThan(beforeOpacity);
    world.dispose();
  });

  it("updates performer grounding, retained visibility, and disposes once", () => {
    const bundle = assets();
    const panoramaDispose = vi.spyOn(bundle.panorama, "dispose");
    const world = createCelestialEnvironmentWorld(
      { groundY: -1.5, worldYOffset: 0.25 },
      bundle
    );
    world.setGroundY(-2);
    expect(
      world.root.getObjectByName("celestial-cloudbreak-world")!.position.y
    ).toBe(-1.75);
    expect(world.reflector.position.y).toBeCloseTo(
      -2 + 0.25 + CLOUDBREAK_LAYOUT.lagoon.surfaceY + 0.035,
      6
    );
    world.setActive(false);
    expect(world.root.visible).toBe(false);
    expect(world.reflector.visible).toBe(false);
    world.setActive(true);
    expect(world.root.visible).toBe(true);
    expect(world.reflector.visible).toBe(true);

    world.dispose();
    world.dispose();
    expect(panoramaDispose).toHaveBeenCalledTimes(1);
  });

  it("keeps disabled optional atmosphere out of the default graph", () => {
    const config = createDefaultCelestialConfig();
    const world = createCelestialEnvironmentWorld(
      { config, groundY: -1.5 },
      assets()
    );
    expect(
      world.root.getObjectByName("celestial-cloud-sky-dome")
    ).toBeUndefined();
    expect(world.root.getObjectByName("celestial-god-rays")).toBeUndefined();
    world.dispose();
  });
});

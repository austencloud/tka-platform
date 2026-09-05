import { describe, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Texture,
  type WebGLRenderer,
} from "three";

import { createDefaultBlossomConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
import { createBlossomRuntimeConfig } from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-runtime";
import { createBlossomAtmosphere } from "$lib/shared/3d/environments/worlds/blossom/blossom-atmosphere";
import {
  BLOSSOM_AUTHORED_RESOURCE_URLS,
  createBlossomEnvironmentWorld,
  type BlossomEnvironmentAssets,
} from "$lib/shared/3d/environments/worlds/blossom/blossom-environment-world";

function mesh(name: string, materialName = ""): Mesh {
  const material = new MeshStandardMaterial({ color: "#ffffff" });
  material.name = materialName;
  const value = new Mesh(new BoxGeometry(1, 1, 1), material);
  value.name = name;
  return value;
}

function assets(): BlossomEnvironmentAssets {
  const environmentRoot = new Group();
  environmentRoot.add(
    mesh("Garden Ground", "Blossom Living Garden Ground"),
    mesh("Stage_Base"),
    mesh("River_Water"),
    mesh("Sakura Hero"),
    mesh("Blossom_Grass_Base_Living"),
    mesh("Blossom_Grass_High_Damp")
  );
  return {
    environmentRoot,
    moonTexture: new Texture(),
    detailMaps: {
      red: new Texture(),
      green: new Texture(),
      blue: new Texture(),
      fourth: new Texture(),
    },
    familyMask: new Texture(),
  };
}

const renderer = {} as WebGLRenderer;

describe("Blossom renderer-neutral world", () => {
  it("declares the exact authored GLB and six production support textures", () => {
    expect(BLOSSOM_AUTHORED_RESOURCE_URLS).toEqual([
      "/models/blossom/blossom_environment.glb",
      "/textures/moon.png",
      "/textures/forest-floor/forest-ground-detail-neutral.jpg",
      "/textures/forest-floor/forest-ground-detail-meadow.jpg",
      "/textures/forest-floor/forest-ground-detail-litter.jpg",
      "/textures/forest-floor/forest-ground-detail-damp.jpg",
      "/textures/blossom-floor/blossom-ground-family-mask.png",
    ]);
  });

  it("builds the complete authored world, exact stage, river, lighting, and globals", () => {
    const bundle = assets();
    const world = createBlossomEnvironmentWorld(
      {
        renderer,
        groundY: -1.5,
        stageWidth: 6,
        stageDepth: 6,
        stageZOffset: 1.25,
        showDirectionCues: true,
        qualityTier: "high",
      },
      bundle
    );
    const names: string[] = [];
    world.root.traverse((object) => names.push(object.name));

    expect(names).toContain("BlossomEnvironment");
    expect(names).toContain("blossom-sky-gradient");
    expect(names).toContain("blossom-starfield");
    expect(names).toContain("blossom-performance-stage");
    expect(names).toContain("blossom-stage-downstage-marker");
    expect(names).toContain("blossom-stage-torch-light-0");
    expect(names).toContain("blossom-lighting");
    expect(names).toContain("blossom-moon-key");
    expect(names).toContain("blossom-lantern-light-2");
    expect(world.reflector?.name).toBe("blossom-reflective-river");
    expect(world.fog.color.getHexString()).toBe("2d172d");
    expect(world.fog.density).toBe(0.01);
    expect(world.background.getHexString()).toBe("07081d");
    expect(world.maxPixelRatio).toBe(2);

    const authored = world.root.getObjectByName("BlossomEnvironment")!;
    expect(authored.position.toArray()).toEqual([0, -1.5, 1.25]);
    expect(authored.rotation.y).toBeCloseTo(Math.PI, 6);
    expect(bundle.environmentRoot.getObjectByName("Stage_Base")!.visible).toBe(
      false
    );
    expect(bundle.environmentRoot.getObjectByName("River_Water")!.visible).toBe(
      false
    );
    expect(
      bundle.environmentRoot.getObjectByName("Blossom_Grass_High_Damp")!.visible
    ).toBe(true);
    world.dispose();
  });

  it("tracks the camera and performer ground while animating grass and water", () => {
    const bundle = assets();
    const world = createBlossomEnvironmentWorld(
      { renderer, groundY: -1.5, qualityTier: "high" },
      bundle
    );
    const camera = new PerspectiveCamera();
    camera.position.set(3, 7, 11);
    const sky = world.root.getObjectByName("blossom-sky-gradient")!;
    const riverMaterial = world.reflector!.material as unknown as {
      uniforms: { uTime: { value: number } };
    };
    const before = riverMaterial.uniforms.uTime.value;

    world.update(0.25, camera);
    expect(sky.position.toArray()).toEqual([3, 7, 11]);
    expect(riverMaterial.uniforms.uTime.value).toBeCloseTo(
      before + 0.25 * 0.28,
      6
    );
    world.setGroundY(-2);
    expect(world.root.getObjectByName("BlossomEnvironment")!.position.y).toBe(
      -2
    );
    expect(
      world.root.getObjectByName("blossom-performance-stage")!.position.y
    ).toBe(-2);
    expect(world.reflector!.position.y).toBeCloseTo(-2.138, 6);
    world.setActive(false);
    expect(world.root.visible).toBe(false);
    expect(world.reflector!.visible).toBe(false);
    world.dispose();
  });

  it("maps the low renderer tier to the authored base grass layer", () => {
    const bundle = assets();
    const world = createBlossomEnvironmentWorld(
      { renderer, groundY: -1.5, qualityTier: "low" },
      bundle
    );
    expect(
      bundle.environmentRoot.getObjectByName("Blossom_Grass_Base_Living")!
        .visible
    ).toBe(true);
    expect(
      bundle.environmentRoot.getObjectByName("Blossom_Grass_High_Damp")!.visible
    ).toBe(false);
    world.dispose();
  });

  it("keeps the dormant production atmosphere exact when its phase is enabled", () => {
    const config = createDefaultBlossomConfig();
    const runtime = createBlossomRuntimeConfig({
      tier: "high",
      prefersReducedMotion: false,
      stageWidth: 6,
      stageDepth: 6,
      stageZOffset: 0,
      groundY: -1.5,
      particleCounts: {
        petals: config.petals.count,
        distantPetals: config.distantPetals!.count,
        fireflies: config.fireflies!.count,
      },
      lightIntensities: { hemisphere: 0.68, key: 2.25 },
    });
    const atmosphere = createBlossomAtmosphere({
      config,
      runtime,
      moonTexture: new Texture(),
      decorativeAtmosphereEnabled: true,
      motionScale: 1,
      random: () => 0.5,
    });
    expect(atmosphere.object.getObjectByName("blossom-petals")).toBeDefined();
    expect(
      atmosphere.object.getObjectByName("blossom-distant-petals")
    ).toBeDefined();
    expect(
      atmosphere.object.getObjectByName("blossom-fireflies")
    ).toBeDefined();
    atmosphere.dispose();
  });

  it("disposes owned textures once even when disposal is repeated", () => {
    const bundle = assets();
    const textureDisposals = [
      bundle.moonTexture,
      ...Object.values(bundle.detailMaps),
      bundle.familyMask,
    ].map((texture) => vi.spyOn(texture, "dispose"));
    const world = createBlossomEnvironmentWorld(
      { renderer, groundY: -1.5, qualityTier: "medium" },
      bundle
    );
    world.dispose();
    world.dispose();
    for (const dispose of textureDisposals) {
      expect(dispose).toHaveBeenCalledTimes(1);
    }
  });
});

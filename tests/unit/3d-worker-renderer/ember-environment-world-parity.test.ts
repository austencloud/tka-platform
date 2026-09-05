import { describe, expect, it, vi } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Texture,
  Raycaster,
  Vector3,
  ShaderLib,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";

import { QualityTier } from "$lib/shared/3d/effects/types";
import { createDefaultEmberConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
import {
  EMBER_AUTHORED_RESOURCE_URLS,
  type EmberEnvironmentAssets,
} from "$lib/shared/3d/environments/worlds/ember/ember-environment-assets";
import {
  createEmberEnvironmentWorld,
  type EmberEnvironmentWorld,
} from "$lib/shared/3d/environments/worlds/ember/ember-environment-world";

function model(name: string): Group {
  const root = new Group();
  root.name = name;
  root.add(
    new Mesh(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: "#ffffff" })
    )
  );
  return root;
}

function assets(): EmberEnvironmentAssets {
  const productionSlice = new Group();
  const basinMaterial = new MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.5,
    metalness: 0.5,
  });
  basinMaterial.name = "Ember Living Basin";
  const basin = new Mesh(new PlaneGeometry(40, 40, 4, 4), basinMaterial);
  basin.name = "Ember_Volcanic_Basin_living_caldera";
  basin.userData.tka_role = "volcanic-basin";
  basin.rotation.x = -Math.PI / 2;
  const fissure = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshStandardMaterial({ color: "#ffffff" })
  );
  fissure.name = "Ember_Buried_Fissure";
  fissure.userData.tka_role = "live-fissure";
  productionSlice.add(basin, fissure);
  return {
    productionSlice,
    largeLog: model("large-log"),
    smallLog: model("small-log"),
    campfire: model("campfire"),
    skyMoonTexture: new Texture(),
    detailMaps: {
      youngLava: new Texture(),
      ironContact: new Texture(),
      fracturedBasalt: new Texture(),
      shelteredAsh: new Texture(),
    },
    surfaceMaps: { height: new Texture() },
    familyMask: new Texture(),
  };
}

function createWorld(bundle = assets()): {
  world: EmberEnvironmentWorld;
  bundle: EmberEnvironmentAssets;
} {
  return {
    bundle,
    world: createEmberEnvironmentWorld(
      {
        renderer: {} as WebGLRenderer,
        groundY: -1.5,
        qualityTier: QualityTier.HIGH,
        random: () => 0.5,
      },
      bundle
    ),
  };
}

describe("Ember renderer-neutral production world", () => {
  it("delivers the approved datum and slope without adding a second river or stage", async () => {
    const path = "static/models/ember/ember-production-slice.glb";
    const bytes = readFileSync(path);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const data = new Uint8Array(bytes.length);
    data.set(bytes);
    const gltf = await loader.parseAsync(data.buffer, "");
    const bundle = assets();
    bundle.productionSlice = gltf.scene;
    const source = gltf.scene.getObjectByName("EMBER_Terrain") as Mesh;
    const positions = source.geometry.getAttribute("position").array.slice();
    const world = createEmberEnvironmentWorld(
      {
        renderer: {} as WebGLRenderer,
        groundY: -1.5,
        stageRadiusGrowth: 8,
        reducedMotion: true,
        random: () => 0.5,
      },
      bundle
    );
    world.root.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 200, 0), new Vector3(0, -1, 0));
    expect(ray.intersectObject(source, true)[0].point.y).toBeCloseTo(-1, 1);
    expect(source.geometry.getAttribute("position").array).toEqual(positions);
    expect(world.config.platform.enabled).toBe(false);
    expect(world.root.getObjectByName("EmberLavaRivers")).toBeUndefined();
    expect(world.root.getObjectByName("ember-surface-ecology")).toBeUndefined();
    expect(world.root.getObjectByName("EMBER_PerformerProxy")).toBeUndefined();
    expect(statSync(path).size).toBeLessThan(7_000_000);
    const surface = world.root.getObjectByName(
      "EMBER_LavaSimulatorDeposit"
    ) as Mesh;
    const material = surface.material as MeshStandardMaterial;
    const shader = {
      uniforms: {},
      vertexShader: ShaderLib.standard.vertexShader,
      fragmentShader: ShaderLib.standard.fragmentShader,
    } as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as WebGLRenderer);
    const time = shader.uniforms.uMidflankTime;
    world.update(1, 10, new PerspectiveCamera());
    expect(time.value).toBe(0);
    const dispose = vi.spyOn(material, "dispose");
    world.dispose();
    world.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("keeps the R5 material color instead of whitening untextured basalt", () => {
    const bundle = assets();
    const terrain = bundle.productionSlice.children[0] as Mesh;
    terrain.name = "EMBER_Terrain";
    const material = terrain.material as MeshStandardMaterial;
    material.name = "Ember_Midflank_R5_basalt";
    material.color.setRGB(0.075, 0.082, 0.083);
    const color = material.color.clone();
    const { world } = createWorld(bundle);
    expect(material.color).toEqual(color);
    world.dispose();
  });
  it("declares every authored GLB and support texture used by production", () => {
    expect(EMBER_AUTHORED_RESOURCE_URLS).toEqual([
      "/models/ember/ember-production-slice.glb",
      "/models/camping/tree-log.glb",
      "/models/camping/tree-log-small.glb",
      "/models/camping/campfire-pit.glb",
      "/textures/moon.png",
      "/textures/ember-surface-r9/young-lava.png",
      "/textures/ember-surface-r9/iron-contact.png",
      "/textures/ember-midflank-r5/rock-ground-color.jpg",
      "/textures/ember-surface-r9/sheltered-ash.png",
      "/textures/ember-surface-r11/rock-ground-height.jpg",
      "/textures/ember-midflank-r5/family-mask.png",
    ]);
  });

  it("builds the authored terrain, lava, atmosphere, lights, and globals", () => {
    const { world, bundle } = createWorld();
    const names: string[] = [];
    world.root.traverse((object) => names.push(object.name));

    expect(world.root.name).toBe("ember-environment-world");
    expect(world.root.children).toContain(bundle.productionSlice);
    for (const name of [
      "EmberSkyGradient",
      "ember-surface-ecology",
      "EmberLavaRivers",
      "EmberParticles",
      "EmberAsh",
      "EmberSmoke",
      "EmberVolcanicHaze",
      "EmberPlumes",
      "EmberCalderaLight",
      "EmberHemisphereLight",
      "EmberSkyLight",
    ]) {
      expect(names, name).toContain(name);
    }
    expect(world.fog.color.getHexString()).toBe("3f2018");
    expect(world.fog.density).toBe(0.0042);
    expect(world.background.getHexString()).toBe("3f2018");
    expect(world.config.atmosphere.id).toBe("blackglass-inferno");
    expect(
      bundle.productionSlice.getObjectByName("Ember_Buried_Fissure")!.visible
    ).toBe(false);
    const basin = bundle.productionSlice.getObjectByName(
      "Ember_Volcanic_Basin_living_caldera"
    ) as Mesh;
    expect(basin.castShadow).toBe(false);
    expect(basin.receiveShadow).toBe(true);
    expect(bundle.productionSlice.userData.emberAtmosphereLook).toBe(
      "blackglass-inferno"
    );
    world.dispose();
  });

  it("updates camera-following sky and haze and tracks performer ground", () => {
    const { world, bundle } = createWorld();
    const camera = new PerspectiveCamera();
    camera.position.set(4, 8, 12);
    world.update(0.25, 0.25, camera);
    expect(
      world.root.getObjectByName("EmberSkyGradient")!.position.toArray()
    ).toEqual([4, 8, 12]);
    expect(
      world.root.getObjectByName("EmberVolcanicHaze")!.position.toArray()
    ).toEqual([4, 8, 12]);

    world.setGroundY(-2.25);
    expect(bundle.productionSlice.position.y).toBe(-2.25);
    expect(world.root.getObjectByName("ember-horizon-apron")!.position.y).toBe(
      -2.25
    );
    world.setActive(false);
    expect(world.root.visible).toBe(false);
    world.dispose();
  });

  it("retains exact optional fire, pool, cracks, pillars, fountain, and platform paths", () => {
    const config = createDefaultEmberConfig();
    config.lavaCracks.enabled = true;
    config.lavaPool.enabled = true;
    config.obsidianPillars.enabled = true;
    config.fireWisps!.enabled = true;
    config.emberFountains!.enabled = true;
    config.fireVent = {
      enabled: true,
      position: { x: 2, z: 3 },
      modelScale: 1,
      fireScale: 1.2,
      fireHeight: 2,
      primaryLight: {
        color: "#ff4400",
        intensity: 20,
        distance: 10,
        decay: 2,
        heightOffset: 2,
      },
      fillLight: {
        color: "#ffaa00",
        intensity: 8,
        distance: 7,
        decay: 2,
        heightOffset: 1,
      },
      smokeColors: ["#221111"],
      smokeCount: 8,
    };
    config.platform.enabled = true;
    const bundle = assets();
    const world = createEmberEnvironmentWorld(
      {
        renderer: {} as WebGLRenderer,
        groundY: -1.5,
        config,
        qualityTier: QualityTier.HIGH,
        random: () => 0.5,
      },
      bundle
    );
    const names: string[] = [];
    world.root.traverse((object) => names.push(object.name));
    for (const name of [
      "EmberLavaCracks",
      "EmberLavaPool",
      "EmberObsidianPillars",
      "EmberFireVent",
      "SharedVolumetricFire",
      "EmberFireWisps",
      "EmberFountains",
      "EmberObsidianPlatform",
    ]) {
      expect(names, name).toContain(name);
    }
    expect(names.filter((name) => name.startsWith("EmberLog_"))).toHaveLength(
      6
    );
    world.dispose();
  });

  it("disposes its loaded textures once and ignores repeated disposal", () => {
    const bundle = assets();
    const spies = [
      bundle.skyMoonTexture,
      ...Object.values(bundle.detailMaps),
      ...Object.values(bundle.surfaceMaps),
      bundle.familyMask,
    ].map((texture) => vi.spyOn(texture, "dispose"));
    const world = createWorld(bundle).world;
    world.dispose();
    world.dispose();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});

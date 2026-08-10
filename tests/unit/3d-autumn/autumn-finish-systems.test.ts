import { describe, expect, it } from "vitest";
import { MeshStandardMaterial, Texture, Vector2 } from "three";

import { patchRootedWindMaterial } from "$lib/shared/3d/environments/primitives/rooted-wind-material";
import { sampleAutumnLanternFlicker } from "$lib/shared/3d/environments/scenes/autumn/runtime/lighting/autumn-lantern-flicker";
import { patchAutumnGroundDetailMaterial } from "$lib/shared/3d/environments/scenes/autumn/runtime/ground/autumn-ground-detail";
import {
  calculateAutumnDepthFogFactor,
  getAutumnDepthCohesionProfile,
  patchAutumnDepthCohesionMaterial,
} from "$lib/shared/3d/environments/scenes/autumn/runtime/atmosphere/autumn-depth-cohesion";

describe("Autumn finish systems", () => {
  it("keeps the lantern flicker restrained and deterministic", () => {
    const samples = Array.from({ length: 240 }, (_, index) =>
      sampleAutumnLanternFlicker(index / 30)
    );

    expect(samples.every((sample) => sample >= 0.93 && sample <= 1.07)).toBe(
      true
    );
    expect(
      new Set(samples.map((sample) => sample.toFixed(4))).size
    ).toBeGreaterThan(120);
    expect(sampleAutumnLanternFlicker(3.25)).toBe(
      sampleAutumnLanternFlicker(3.25)
    );
  });

  it("injects GPU-side spatial variation into the rooted wind owner", () => {
    const material = new MeshStandardMaterial();
    const uniforms = patchRootedWindMaterial(material, {
      direction: new Vector2(0.86, 0.5).normalize(),
      strength: 0.14,
      spatialVariation: 0.16,
      cacheKey: "autumn-finish-test",
      storageKey: "autumnFinishTestUniforms",
    });
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "",
    };

    material.onBeforeCompile(shader as never, {} as never);

    expect(uniforms.spatialVariation.value).toBe(0.16);
    expect(material.forceSinglePass).toBe(true);
    expect(shader.vertexShader).toContain("uRootedWindSpatialVariation");
    expect(shader.vertexShader).toContain("rootedWindZoneStrength");
  });

  it("combines leaf-scale colour with the authored ground atlas", () => {
    const material = new MeshStandardMaterial();
    material.name = "Autumn Living Forest Floor";
    const detailMap = new Texture();
    const patch = patchAutumnGroundDetailMaterial(
      material,
      detailMap,
      0.72
    );
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <uv_vertex>",
      fragmentShader: "#include <common>\n#include <map_fragment>",
    };

    material.onBeforeCompile(shader as never, {} as never);

    expect(shader.uniforms.uAutumnGroundDetailMap.value).toBe(detailMap);
    expect(shader.uniforms.uAutumnGroundDetailStrength.value).toBe(0.72);
    expect(shader.vertexShader).toContain("vAutumnGroundDetailUv = uv");
    expect(shader.fragmentShader).toContain("autumnGroundModulation");
    expect(shader.fragmentShader).toContain("vec3(1.10, 0.80, 0.62)");
    expect(material.customProgramCacheKey()).toContain(
      "autumn-ground-detail-v3"
    );
    expect(shader.fragmentShader).toContain("autumnCabinLane");
    expect(shader.fragmentShader).toContain("autumnGroundRouteMask");
    expect(shader.fragmentShader).toContain("vec3(1.12, 0.62, 0.34)");

    patch.dispose();
    expect(material.userData.autumnGroundDetailPatch).toBeUndefined();
  });

  it("retains seasonal colour after fog on imported depth families", () => {
    const material = new MeshStandardMaterial();
    material.name = "Autumn Larch PBR";
    const patch = patchAutumnDepthCohesionMaterial(material);
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>",
      fragmentShader: "#include <common>\n#include <fog_fragment>",
    };

    material.onBeforeCompile(shader as never, {} as never);

    expect(patch?.profileId).toBe("larch-gold");
    expect(shader.fragmentShader).toContain("uAutumnDepthCohesionGrade");
    expect(shader.fragmentShader).not.toContain("#include <fog_fragment>");
    expect(shader.fragmentShader).toContain("uAutumnDepthFogDensityScale");
    expect(shader.fragmentShader).toContain("autumnDepthSourceLuminance");
    expect(patch?.uniforms.fogDensityScale.value).toBe(0.8);
    expect(patch?.uniforms.luminanceScale.value).toBe(0.9);
    expect(material.customProgramCacheKey()).toContain(
      "autumn-depth-cohesion-larch-gold-v3"
    );
    expect(getAutumnDepthCohesionProfile("Autumn Hero A PBR")).toBeNull();
    expect(getAutumnDepthCohesionProfile("Autumn Hero B PBR")).toBeNull();

    patch?.dispose();
    expect(material.userData.autumnDepthCohesionPatch).toBeUndefined();
  });

  it("keeps adjacent hero and depth trees inside one fog-value range", () => {
    const globalDensity = 0.016;
    const heroFog = calculateAutumnDepthFogFactor(41, globalDensity, 1);
    const importedFog = calculateAutumnDepthFogFactor(
      62,
      globalDensity,
      0.8
    );

    expect(heroFog).toBeCloseTo(0.35, 2);
    expect(importedFog).toBeCloseTo(0.47, 2);
    expect(importedFog - heroFog).toBeLessThan(0.13);
  });
});

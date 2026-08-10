import { describe, expect, it } from "vitest";
import { MeshStandardMaterial, Vector2 } from "three";

import { patchRootedWindMaterial } from "$lib/shared/3d/environments/primitives/rooted-wind-material";
import { sampleAutumnLanternFlicker } from "$lib/shared/3d/environments/scenes/autumn/runtime/lighting/autumn-lantern-flicker";

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
});

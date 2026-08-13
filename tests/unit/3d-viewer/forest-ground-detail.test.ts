import { describe, expect, it } from "vitest";
import {
  MeshStandardMaterial,
  Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  isForestGroundMaterial,
  getForestGroundDetailFamily,
  inheritForestGroundDetailPatch,
  patchForestGroundDetailMaterial,
} from "$lib/shared/3d/environments/scenes/forest/forest-ground-detail";

describe("Forest ground detail", () => {
  it("targets only authored Forest terrain families", () => {
    const terrain = new MeshStandardMaterial({ name: "Shade Moss" });
    const tree = new MeshStandardMaterial({ name: "polyhaven-oak-bark" });

    expect(isForestGroundMaterial(terrain)).toBe(true);
    expect(isForestGroundMaterial(tree)).toBe(false);
    expect(getForestGroundDetailFamily(terrain)).toBe("litter");
    expect(getForestGroundDetailFamily(tree)).toBeNull();
  });

  it("patches world-space micro detail and restores the material", () => {
    const material = new MeshStandardMaterial({
      name: "Leaf Duff",
      color: "#59754a",
    });
    const detailMap = new Texture();
    const detailMaps = {
      neutral: detailMap,
      meadow: new Texture(),
      litter: new Texture(),
      damp: new Texture(),
    };
    const familyMask = new Texture();
    const shader = {
      uniforms: {},
      vertexShader:
        "#include <common>\n#include <uv_vertex>\n#include <begin_vertex>",
      fragmentShader:
        "#include <common>\n#include <map_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>",
    } as WebGLProgramParametersWithUniforms;

    const patch = patchForestGroundDetailMaterial(
      material,
      detailMaps,
      familyMask,
      0.9,
      {
        preserveColor: material.color,
        normalResponse: 0.14,
        roughnessFloor: 0.96,
      }
    );
    expect(material.color.getHexString()).toBe("ffffff");
    material.onBeforeCompile(shader, {} as never);

    expect(shader.uniforms.uForestGroundNeutralMap.value).toBe(detailMap);
    expect(shader.uniforms.uForestGroundFamilyMask.value).toBe(familyMask);
    expect(shader.uniforms.uForestGroundDetailStrength.value).toBe(0.9);
    expect(shader.uniforms.uForestGroundNormalResponse.value).toBe(0.14);
    expect(shader.uniforms.uForestGroundRoughnessFloor.value).toBe(0.96);
    expect(shader.vertexShader).toContain("vForestGroundWorldPosition");
    expect(shader.fragmentShader).toContain("forestGroundPoint / 2.8");
    expect(shader.fragmentShader).toContain("secondaryUv");
    expect(shader.fragmentShader).toContain("forestSurfaceGradient");
    expect(shader.fragmentShader).toContain(
      "0.34 * uForestGroundDetailStrength"
    );
    expect(shader.fragmentShader).toContain(
      "roughnessFactor,\n            uForestGroundRoughnessFloor"
    );

    const clone = material.clone();
    inheritForestGroundDetailPatch(material, clone);
    expect(clone.customProgramCacheKey()).toContain("forest-ground-detail-v5");
    expect(clone.userData.forestGroundDetailPatch).toBeDefined();

    patch.dispose();
    expect(material.color.getHexString()).not.toBe("ffffff");
    expect(material.userData.forestGroundDetailPatch).toBeUndefined();
  });
});

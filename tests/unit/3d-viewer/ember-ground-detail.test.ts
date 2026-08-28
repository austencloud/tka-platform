import { describe, expect, it } from "vitest";
import {
  MeshStandardMaterial,
  Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  EMBER_GROUND_DETAIL_MASK,
  EMBER_GROUND_DETAIL_TEXTURES,
  inheritEmberGroundDetailPatch,
  isEmberGroundDetailSurface,
  patchEmberGroundDetailMaterial,
} from "$lib/shared/3d/environments/scenes/ember/ember-ground-detail";

describe("Ember Fresh Rift ground detail", () => {
  it("publishes the four approved ecology families and world mask", () => {
    expect(EMBER_GROUND_DETAIL_TEXTURES).toEqual({
      youngLava: "/textures/ember-surface-r9/young-lava.png",
      ironContact: "/textures/ember-surface-r9/iron-contact.png",
      fracturedBasalt: "/textures/ember-surface-r9/fractured-basalt.png",
      shelteredAsh: "/textures/ember-surface-r9/sheltered-ash.png",
    });
    expect(EMBER_GROUND_DETAIL_MASK).toBe(
      "/textures/ember-surface-r9/fresh-rift-family-mask.png"
    );
  });

  it("targets production ground roles without touching hero formations", () => {
    const r9 = new MeshStandardMaterial({
      name: "Ember_R9_fresh-rift-synthesis_roped-pahoehoe",
    });
    const legacy = new MeshStandardMaterial({
      name: "Ember_Ground_Blackglass_PBR",
    });

    expect(isEmberGroundDetailSurface("volcanic-basin", r9)).toBe(true);
    expect(isEmberGroundDetailSurface("playable-shelf", r9)).toBe(true);
    expect(isEmberGroundDetailSurface("meshy-hero-geology", r9)).toBe(false);
    expect(isEmberGroundDetailSurface("volcanic-basin", legacy)).toBe(false);
  });

  it("composes the shared world-space material owner and restores cleanly", () => {
    const material = new MeshStandardMaterial({
      name: "Ember_R9_fresh-rift-synthesis_Blended_Terrain",
      color: "#354149",
    });
    const detailMaps = {
      youngLava: new Texture(),
      ironContact: new Texture(),
      fracturedBasalt: new Texture(),
      shelteredAsh: new Texture(),
    };
    const familyMask = new Texture();
    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader:
        "#include <common>\n#include <map_fragment>\n#include <normal_fragment_maps>\n#include <roughnessmap_fragment>",
    } as WebGLProgramParametersWithUniforms;

    const patch = patchEmberGroundDetailMaterial(
      material,
      detailMaps,
      familyMask,
      0.92,
      { preserveColor: material.color }
    );
    expect(material.color.getHexString()).toBe("ffffff");
    material.onBeforeCompile(shader, {} as never);

    expect(shader.uniforms.uMaskedGroundRedMap.value).toBe(
      detailMaps.youngLava
    );
    expect(shader.uniforms.uMaskedGroundGreenMap.value).toBe(
      detailMaps.ironContact
    );
    expect(shader.uniforms.uMaskedGroundBlueMap.value).toBe(
      detailMaps.fracturedBasalt
    );
    expect(shader.uniforms.uMaskedGroundFourthMap.value).toBe(
      detailMaps.shelteredAsh
    );
    expect(shader.uniforms.uMaskedGroundFamilyMask.value).toBe(familyMask);
    expect(shader.uniforms.uMaskedGroundMaskOrigin.value.toArray()).toEqual([
      -190, -145,
    ]);
    expect(shader.uniforms.uMaskedGroundMaskSize.value.toArray()).toEqual([
      380, 335,
    ]);
    expect(shader.uniforms.uMaskedGroundWorldAxisSign.value.toArray()).toEqual([
      1, 1,
    ]);
    expect(shader.uniforms.uMaskedGroundAbsoluteColorStrength.value).toBe(0.72);
    expect(shader.uniforms.uMaskedGroundRoughnessFloor.value).toBe(0.76);
    expect(shader.fragmentShader).toContain("uMaskedGroundFamilyMask");
    expect(shader.fragmentShader).toContain("maskedGroundSurfaceGradient");

    const clone = material.clone();
    inheritEmberGroundDetailPatch(material, clone);
    expect(clone.customProgramCacheKey()).toContain(
      "ember-ground-detail-r9-fresh-rift-v1"
    );
    expect(clone.userData.emberGroundDetailPatch).toBeDefined();

    patch.dispose();
    expect(material.color.getHexString()).toBe("354149");
    expect(material.userData.emberGroundDetailPatch).toBeUndefined();
  });
});

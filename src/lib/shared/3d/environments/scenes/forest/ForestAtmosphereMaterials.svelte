<script lang="ts">
  import {
    Color,
    MeshStandardMaterial,
    type Material,
    type Mesh,
    type Object3D,
  } from "three";
  import { onMount } from "svelte";
  import { inheritForestGroundDetailPatch } from "./forest-ground-detail";
  import {
    FOREST_FOLIAGE_GREEN_SIGNAL_END,
    FOREST_FOLIAGE_GREEN_SIGNAL_START,
    FOREST_CANOPY_LOD_DISTANCE_END,
    FOREST_CANOPY_LOD_DISTANCE_START,
    FOREST_CANOPY_LOD_ALPHA_COVERAGE_POWER,
    FOREST_SEMANTIC_CANOPY_DISTANCE_END,
    FOREST_SEMANTIC_CANOPY_DISTANCE_START,
    FOREST_SEMANTIC_CANOPY_MAX_COVERAGE,
    FOREST_FOLIAGE_SKY_EXPOSURE_END,
    FOREST_FOLIAGE_SKY_EXPOSURE_START,
    resolveForestFoliageGradeCoverage,
    resolveForestFoliageGreenSignalFloor,
    resolveForestFoliageAlphaTreatment,
    resolveForestFoliageIndirectDepth,
    resolveForestFoliageLuminanceScale,
  } from "./forest-foliage-grade";
  import { inheritRootedWindPatch } from "../../primitives/rooted-wind-material";
  import type { ForestMaterialResponseConfig } from "../../domain/models/scene-configs/forest-scene-config";

  type MaterialScope = "environment" | "near-frame" | "stage" | "camp";
  type MaterialCategory =
    | "terrainTint"
    | "forestFloorTint"
    | "foliageTint"
    | "woodyTint"
    | "groundLifeTint"
    | "stageTint"
    | "campTint";

  interface FoliageGradeUniforms {
    tint: { value: Color };
    strength: { value: number };
    coverage: { value: number };
    greenSignalFloor: { value: number };
    luminanceScale: { value: number };
    indirectDepth: { value: number };
  }

  interface Props {
    scene: Object3D;
    response: ForestMaterialResponseConfig;
    scope: MaterialScope;
  }

  interface WorkingMaterial {
    material: MeshStandardMaterial;
    baseColor: Color;
    baseEmissiveIntensity: number;
    category: MaterialCategory;
    foliageGrade: FoliageGradeUniforms | null;
  }

  interface OriginalAssignment {
    mesh: Mesh;
    material: Material | Material[];
  }

  let { scene, response, scope }: Props = $props();
  let workingMaterials: WorkingMaterial[] = [];
  let workingRevision = $state(0);
  let originalAssignments: OriginalAssignment[] = [];
  let clonedMaterials: MeshStandardMaterial[] = [];

  const TERRAIN_MATERIALS = new Set([
    "Packed Performance Clearing",
    "Path Soil",
    "Leaf Duff",
    "Shade Moss",
    "Damp Hollow",
    "Quiet Distant Ground",
  ]);

  function classify(
    materialName: string,
    materialScope: MaterialScope
  ): MaterialCategory {
    if (
      materialScope === "stage" &&
      materialName === "ForestStage_ForestContact"
    ) {
      return "terrainTint";
    }
    if (materialScope === "stage") return "stageTint";
    if (materialScope === "camp") return "campTint";
    if (
      materialName === "Packed Performance Clearing" ||
      materialName === "Path Soil"
    ) {
      return "terrainTint";
    }
    if (TERRAIN_MATERIALS.has(materialName)) return "forestFloorTint";
    if (
      materialName.startsWith("PaletteMaterial") ||
      materialName.startsWith("Forest Clearing Grass") ||
      materialName.startsWith("Forest Ecosystem Living Grass") ||
      materialName.includes("grass_bermuda_01") ||
      materialName.includes("grass_medium_02") ||
      materialName.includes("fern_02") ||
      materialName.includes("weed_plant_02") ||
      materialName.includes("nettle_plant") ||
      materialName.includes("periwinkle_plant") ||
      materialName.includes("dandelion_01") ||
      materialName.includes("moss_01")
    ) {
      return "groundLifeTint";
    }
    if (materialName.startsWith("Material_")) return "foliageTint";
    const normalizedName = materialName.toLowerCase();
    if (/leaves|twig|foliage/.test(normalizedName)) return "foliageTint";
    if (
      /trunk|bark|branches|jacaranda_tree|tree_small|island_tree|fir_tree|fir_sapling/.test(
        normalizedName
      )
    ) {
      return "woodyTint";
    }
    return "groundLifeTint";
  }

  function addFoliageHighlightGrade(
    material: MeshStandardMaterial,
    category: MaterialCategory,
    materialScope: MaterialScope
  ): FoliageGradeUniforms | null {
    if (category !== "foliageTint") return null;
    const isCanopyLod = /_canopy_lod/i.test(material.name);
    const isSemanticCanopyLod = /ForestSemanticCanopy_.*_canopy_lod/i.test(
      material.name
    );
    const canopyDistanceStart = isSemanticCanopyLod
      ? FOREST_SEMANTIC_CANOPY_DISTANCE_START
      : FOREST_CANOPY_LOD_DISTANCE_START;
    const canopyDistanceEnd = isSemanticCanopyLod
      ? FOREST_SEMANTIC_CANOPY_DISTANCE_END
      : FOREST_CANOPY_LOD_DISTANCE_END;

    const uniforms: FoliageGradeUniforms = {
      tint: { value: new Color("#3d7e34") },
      strength: { value: 0 },
      coverage: { value: resolveForestFoliageGradeCoverage(material.name) },
      greenSignalFloor: {
        value: resolveForestFoliageGreenSignalFloor(material.name),
      },
      luminanceScale: {
        value: resolveForestFoliageLuminanceScale(material.name),
      },
      indirectDepth: {
        value: resolveForestFoliageIndirectDepth(materialScope),
      },
    };
    const previousCompile = material.onBeforeCompile.bind(material);
    const previousCacheKey = material.customProgramCacheKey.bind(material);

    material.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer);
      if (isSemanticCanopyLod) {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
varying vec3 vForestSemanticCanopyPosition;`
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
vForestSemanticCanopyPosition = transformed;`
          );
      }
      shader.uniforms.uForestFoliageHighlightTint = uniforms.tint;
      shader.uniforms.uForestFoliageHighlightStrength = uniforms.strength;
      shader.uniforms.uForestFoliageGradeCoverage = uniforms.coverage;
      shader.uniforms.uForestFoliageGreenSignalFloor =
        uniforms.greenSignalFloor;
      shader.uniforms.uForestFoliageLuminanceScale = uniforms.luminanceScale;
      shader.uniforms.uForestFoliageIndirectDepth = uniforms.indirectDepth;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "uniform vec3 diffuse;",
          `uniform vec3 diffuse;
uniform vec3 uForestFoliageHighlightTint;
uniform float uForestFoliageHighlightStrength;
uniform float uForestFoliageGradeCoverage;
uniform float uForestFoliageGreenSignalFloor;
uniform float uForestFoliageLuminanceScale;
uniform float uForestFoliageIndirectDepth;
${isSemanticCanopyLod ? "varying vec3 vForestSemanticCanopyPosition;" : ""}`
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
${
  isCanopyLod
    ? `diffuseColor.a = 1.0 - pow(
    1.0 - clamp(diffuseColor.a, 0.0, 1.0),
    ${FOREST_CANOPY_LOD_ALPHA_COVERAGE_POWER.toFixed(1)}
  );
  diffuseColor.a *= smoothstep(
  ${canopyDistanceStart.toFixed(1)},
  ${canopyDistanceEnd.toFixed(1)},
  length(vViewPosition)
);${
        isSemanticCanopyLod
          ? `
  diffuseColor.a *= ${FOREST_SEMANTIC_CANOPY_MAX_COVERAGE.toFixed(2)};`
          : ""
      }${
        isSemanticCanopyLod
          ? `
float forestCanopyBreakup = clamp(
  0.48
  + 0.24 * sin(dot(vForestSemanticCanopyPosition, vec3(1.7, 1.1, 2.3)))
  + 0.16 * sin(dot(vForestSemanticCanopyPosition, vec3(-2.9, 2.1, 1.4))),
  0.0,
  1.0
);
diffuseColor.a *= smoothstep(0.24, 0.66, forestCanopyBreakup);
diffuseColor.rgb *= mix(0.34, 0.62, forestCanopyBreakup);`
          : ""
      }`
    : ""
}
float forestLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
float forestGreenSignal = smoothstep(
  ${FOREST_FOLIAGE_GREEN_SIGNAL_START.toFixed(2)},
  ${FOREST_FOLIAGE_GREEN_SIGNAL_END.toFixed(2)},
  diffuseColor.g - max(diffuseColor.r, diffuseColor.b)
);
forestGreenSignal = max(
  forestGreenSignal,
  uForestFoliageGreenSignalFloor
);
float forestTintLuminance = max(
  dot(uForestFoliageHighlightTint, vec3(0.2126, 0.7152, 0.0722)),
  0.001
);
vec3 forestLeafColor = uForestFoliageHighlightTint
  * (
    forestLuminance
    * uForestFoliageLuminanceScale
    / forestTintLuminance
  );
float forestLeafGradeWeight = uForestFoliageHighlightStrength
  * uForestFoliageGradeCoverage
  * forestGreenSignal;
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  forestLeafColor,
  clamp(forestLeafGradeWeight, 0.0, 1.0)
);`
        )
        .replace(
          "#include <lights_fragment_end>",
          `#include <lights_fragment_end>
vec3 forestWorldUpInView = normalize(
  (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz
);
float forestSkyExposure = smoothstep(
  ${FOREST_FOLIAGE_SKY_EXPOSURE_START.toFixed(2)},
  ${FOREST_FOLIAGE_SKY_EXPOSURE_END.toFixed(2)},
  dot(normal, forestWorldUpInView)
);
float forestIndirectRetention = mix(
  1.0 - uForestFoliageIndirectDepth,
  1.0,
  forestSkyExposure
);
reflectedLight.indirectDiffuse *= forestIndirectRetention;`
        );
    };
    material.customProgramCacheKey = () =>
      `${previousCacheKey()}|forest-foliage-highlight-grade-v17|${isCanopyLod ? `canopy-lod-${canopyDistanceStart}-${canopyDistanceEnd}-${FOREST_CANOPY_LOD_ALPHA_COVERAGE_POWER}-${isSemanticCanopyLod ? FOREST_SEMANTIC_CANOPY_MAX_COVERAGE : 1}` : "source"}`;
    return uniforms;
  }

  function cloneMaterial(
    original: Material,
    materialScope: MaterialScope,
    clones: Map<Material, Material>
  ): Material {
    const existing = clones.get(original);
    if (existing) return existing;
    if (!(original instanceof MeshStandardMaterial)) return original;

    const clone = original.clone();
    clone.name = original.name;
    inheritForestGroundDetailPatch(original, clone);
    inheritRootedWindPatch(original, clone);
    const category = classify(original.name, materialScope);
    if (category === "foliageTint") {
      const alphaTreatment = resolveForestFoliageAlphaTreatment(
        original.name,
        original.alphaTest
      );
      clone.alphaHash = alphaTreatment.alphaHash;
      clone.alphaTest = alphaTreatment.alphaTest;
    }
    clones.set(original, clone);
    clonedMaterials.push(clone);
    workingMaterials.push({
      material: clone,
      baseColor: original.color.clone(),
      baseEmissiveIntensity: original.emissiveIntensity,
      category,
      foliageGrade: addFoliageHighlightGrade(clone, category, materialScope),
    });
    return clone;
  }

  function restoreMaterials(): void {
    for (const assignment of originalAssignments) {
      assignment.mesh.material = assignment.material;
    }
    for (const material of clonedMaterials) material.dispose();
    originalAssignments = [];
    clonedMaterials = [];
    workingMaterials = [];
  }

  onMount(() => {
    const root = scene;
    const materialScope = scope;
    const clones = new Map<Material, Material>();

    root.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const original = mesh.material;
      originalAssignments.push({ mesh, material: original });
      mesh.material = Array.isArray(original)
        ? original.map((material) =>
            cloneMaterial(material, materialScope, clones)
          )
        : cloneMaterial(original, materialScope, clones);
    });
    workingRevision += 1;

    return restoreMaterials;
  });

  $effect(() => {
    workingRevision;
    const activeResponse = response;
    for (const working of workingMaterials) {
      working.material.color
        .copy(working.baseColor)
        .multiply(new Color(activeResponse[working.category]));
      working.material.emissiveIntensity =
        working.baseEmissiveIntensity * activeResponse.emissiveScale;
      if (working.foliageGrade) {
        working.foliageGrade.tint.value.set(
          activeResponse.foliageHighlightTint
        );
        working.foliageGrade.strength.value =
          activeResponse.foliageHighlightStrength;
      }
      working.material.needsUpdate = true;
    }
  });
</script>

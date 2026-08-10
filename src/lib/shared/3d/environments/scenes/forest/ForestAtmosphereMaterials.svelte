<script lang="ts">
  import {
    Color,
    MeshStandardMaterial,
    type Material,
    type Mesh,
    type Object3D,
  } from "three";
  import { onMount } from "svelte";
  import type { ForestMaterialResponseConfig } from "../../domain/models/scene-configs/forest-scene-config";

  type MaterialScope = "environment" | "near-frame" | "stage" | "camp";
  type MaterialCategory =
    | "terrainTint"
    | "foliageTint"
    | "groundLifeTint"
    | "stageTint"
    | "campTint";

  interface FoliageGradeUniforms {
    tint: { value: Color };
    strength: { value: number };
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
    if (materialScope === "stage") return "stageTint";
    if (materialScope === "camp") return "campTint";
    if (TERRAIN_MATERIALS.has(materialName)) return "terrainTint";
    if (materialName.startsWith("PaletteMaterial")) return "groundLifeTint";
    if (materialName.startsWith("Material_")) return "foliageTint";
    return "groundLifeTint";
  }

  function addFoliageHighlightGrade(
    material: MeshStandardMaterial,
    category: MaterialCategory
  ): FoliageGradeUniforms | null {
    if (category !== "foliageTint") return null;

    const uniforms: FoliageGradeUniforms = {
      tint: { value: new Color("#3d7e34") },
      strength: { value: 0 },
    };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uForestFoliageHighlightTint = uniforms.tint;
      shader.uniforms.uForestFoliageHighlightStrength = uniforms.strength;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "uniform vec3 diffuse;",
          `uniform vec3 diffuse;
uniform vec3 uForestFoliageHighlightTint;
uniform float uForestFoliageHighlightStrength;`
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
float forestLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
float forestGreenSignal = smoothstep(
  0.005,
  0.12,
  diffuseColor.g - max(diffuseColor.r, diffuseColor.b)
);
float forestTintLuminance = max(
  dot(uForestFoliageHighlightTint, vec3(0.2126, 0.7152, 0.0722)),
  0.001
);
vec3 forestLeafColor = uForestFoliageHighlightTint
  * (forestLuminance / forestTintLuminance);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  forestLeafColor,
  clamp(forestGreenSignal * uForestFoliageHighlightStrength, 0.0, 1.0)
);`
        );
    };
    material.customProgramCacheKey = () => "forest-foliage-highlight-grade-v3";
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
    const category = classify(original.name, materialScope);
    clones.set(original, clone);
    clonedMaterials.push(clone);
    workingMaterials.push({
      material: clone,
      baseColor: original.color.clone(),
      baseEmissiveIntensity: original.emissiveIntensity,
      category,
      foliageGrade: addFoliageHighlightGrade(clone, category),
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

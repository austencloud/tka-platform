<script lang="ts">
  import { useTask } from "@threlte/core";
  import {
    DoubleSide,
    MeshStandardMaterial,
    Vector2,
    type Mesh,
    type Object3D,
    type WebGLProgramParametersWithUniforms,
  } from "three";
  import type { AutumnQualityTier } from "../../quality/autumn-quality";
  import {
    getAutumnGrassTierFromName,
    isAutumnGrassTierVisible,
  } from "./autumn-grass-tier";
  import { prefersReducedMotion } from "../../../../primitives/motion-preference";

  interface Props {
    scene: Object3D | null;
    tier: AutumnQualityTier;
  }

  interface WindUniforms {
    time: { value: number };
    strength: { value: number };
    direction: { value: Vector2 };
  }

  let { scene, tier }: Props = $props();

  const windDirection = new Vector2(0.86, 0.5).normalize();
  const activeUniforms = new Set<WindUniforms>();

  // Peak horizontal offset the wind shader can apply: strength 0.14 times the
  // primary+flutter envelope (1.24) times the maximum gust (1.0), rounded up.
  const WIND_BOUNDS_MARGIN = 0.25;

  function expandBoundsForWind(mesh: Mesh): void {
    const geometry = mesh.geometry;
    if (!geometry) return;
    if (geometry.userData.autumnWindBoundsExpanded) return;

    geometry.computeBoundingSphere();
    if (geometry.boundingSphere) {
      geometry.boundingSphere.radius += WIND_BOUNDS_MARGIN;
    }
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      geometry.boundingBox.expandByScalar(WIND_BOUNDS_MARGIN);
    }
    geometry.userData.autumnWindBoundsExpanded = true;
  }

  function patchWindMaterial(material: MeshStandardMaterial): WindUniforms {
    const existing = material.userData.autumnWindUniforms as
      | WindUniforms
      | undefined;
    if (existing) return existing;

    const uniforms: WindUniforms = {
      time: { value: 0 },
      strength: { value: 0.14 },
      direction: { value: windDirection.clone() },
    };
    const previousCompile = material.onBeforeCompile.bind(material);
    const previousCacheKey = material.customProgramCacheKey.bind(material);

    material.onBeforeCompile = (
      shader: WebGLProgramParametersWithUniforms,
      renderer
    ) => {
      previousCompile(shader, renderer);
      shader.uniforms.uAutumnWindTime = uniforms.time;
      shader.uniforms.uAutumnWindStrength = uniforms.strength;
      shader.uniforms.uAutumnWindDirection = uniforms.direction;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform float uAutumnWindTime;
          uniform float uAutumnWindStrength;
          uniform vec2 uAutumnWindDirection;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
          {
            vec3 autumnWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            float autumnRootWeight = smoothstep(0.02, 0.96, uv.y);
            autumnRootWeight *= autumnRootWeight;
            float autumnPhase = dot(autumnWorldPos.xz, uAutumnWindDirection);
            float autumnPrimary = sin(uAutumnWindTime * 0.72 + autumnPhase * 0.44);
            float autumnFlutter = sin(uAutumnWindTime * 2.05 + autumnPhase * 1.17) * 0.24;
            float autumnGust = 0.72 + 0.28 * sin(uAutumnWindTime * 0.19 + autumnPhase * 0.08);
            float autumnSway = (autumnPrimary + autumnFlutter) * autumnGust
              * autumnRootWeight * uAutumnWindStrength;
            vec3 autumnWorldOffset = vec3(
              uAutumnWindDirection.x * autumnSway,
              abs(autumnSway) * 0.045,
              uAutumnWindDirection.y * autumnSway
            );
            mat3 autumnBasis = mat3(modelMatrix);
            vec3 autumnInvSq = vec3(
              1.0 / max(dot(autumnBasis[0], autumnBasis[0]), 1e-6),
              1.0 / max(dot(autumnBasis[1], autumnBasis[1]), 1e-6),
              1.0 / max(dot(autumnBasis[2], autumnBasis[2]), 1e-6)
            );
            transformed += (transpose(autumnBasis) * autumnWorldOffset) * autumnInvSq;
          }`
      );
    };
    material.customProgramCacheKey = () =>
      `${previousCacheKey()}|autumn-rooted-wind-v1`;
    material.userData.autumnWindUniforms = uniforms;
    material.side = DoubleSide;
    material.needsUpdate = true;
    return uniforms;
  }

  $effect(() => {
    const loadedScene = scene;
    const activeTier = tier;
    if (!loadedScene) return;

    activeUniforms.clear();
    loadedScene.traverse((child) => {
      const grassTier = getAutumnGrassTierFromName(child.name);
      if (!grassTier) return;

      child.visible = isAutumnGrassTierVisible(child.name, activeTier);
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      // Culling used to be disabled outright, which submitted all three grass
      // meshes (28,519 triangles) every frame regardless of where the camera
      // looked. The real reason was the wind shader pushing tips outside the
      // authored bounds, so the bounds are grown by the shader's maximum
      // displacement instead and culling is left on.
      expandBoundsForWind(mesh);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          activeUniforms.add(patchWindMaterial(material));
        }
      }
    });
  });

  const reducedMotion = $derived(prefersReducedMotion());

  useTask((delta) => {
    for (const uniforms of activeUniforms) {
      uniforms.strength.value = reducedMotion ? 0 : 0.14;
      uniforms.time.value += delta;
    }
  });
</script>

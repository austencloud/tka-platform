<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { useDraco, useKtx2, useMeshopt } from "@threlte/extras";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import {
    Mesh,
    MeshStandardMaterial,
    Vector2,
    type Object3D,
    type Material,
    type WebGLProgramParametersWithUniforms,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import { R2_CDN } from "$lib/shared/3d/constants/r2-cdn";

  // The flora scene GLB (~36 MB, geometry-heavy) exceeds Cloudflare Pages' 25 MiB
  // per-file limit and is stripped from the deploy by trim-deploy-assets.js, so in
  // production it must come from R2 (same large-asset pattern as the forest scene).
  // Dev serves it from static/ directly — no R2 round-trip while iterating.
  const FLORA_GLB_URL = import.meta.env.DEV
    ? "/models/ocean/ocean_flora_scene.glb"
    : `${R2_CDN}/models/ocean/ocean_flora_scene.glb`;

  interface Props {
    quality: OceanQualityConfig;
    onProgress?: (fraction: number) => void;
    onReady?: () => void;
  }

  let { quality, onProgress, onReady }: Props = $props();

  // Shared decoder instances (cached per-path by the threlte hooks); detectSupport
  // for KTX2 is wired automatically against the active renderer by useKtx2.
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(useDraco("/draco/"));
  gltfLoader.setMeshoptDecoder(useMeshopt());
  gltfLoader.setKTX2Loader(useKtx2("/basis/"));

  // ── Procedural vertex sway (current-driven) ──────────────────────────
  // The flora GLB is one baked mesh set with opaque names and no per-vertex
  // sway mask, so the rooted-base / swaying-tip look is recovered procedurally:
  // a world-height mask (above the seabed) gates a two-octave directional
  // current displacement injected into each plant material's vertex shader.
  // groundY is the canonical seabed surface (shared with godrays/particles/fish).
  //
  // Tunables (the live knob is uSwayStrength — gentle current, not a gale):
  //   uTallRef    height above the floor at which a plant reaches full sway.
  //               Kelp/seagrass are the tall things; ~3 world units to their tips.
  //   uSwayStrength  master amplitude of the horizontal sway in world units.
  const SWAY_STRENGTH = 0.18;
  const TALL_REF = 3.0;
  // Primary current heading on the XZ plane (normalized): a slow diagonal drift.
  const CURRENT_DIR = new Vector2(0.8, 0.6).normalize();

  const swayUniforms = {
    uTime: { value: 0 },
    uGroundY: { value: userProportionsState.groundY },
    uTallRef: { value: TALL_REF },
    uSwayStrength: { value: SWAY_STRENGTH },
    uCurrentDir: { value: CURRENT_DIR },
  };

  // Rocks/sand must stay rooted — never patch their materials.
  const NO_SWAY_NAME = /rock|sand_rocks/i;

  function patchSwayMaterial(mat: MeshStandardMaterial): void {
    if (mat.userData.swayPatched) return;
    mat.userData.swayPatched = true;

    mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = swayUniforms.uTime;
      shader.uniforms.uGroundY = swayUniforms.uGroundY;
      shader.uniforms.uTallRef = swayUniforms.uTallRef;
      shader.uniforms.uSwayStrength = swayUniforms.uSwayStrength;
      shader.uniforms.uCurrentDir = swayUniforms.uCurrentDir;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        /* glsl */ `#include <common>
          uniform float uTime;
          uniform float uGroundY;
          uniform float uTallRef;
          uniform float uSwayStrength;
          uniform vec2 uCurrentDir;`,
      );

      // Displace in world space after the model transform but before view/projection.
      // begin_vertex sets `transformed`; we recompute its world position, mask + sway
      // it, then push the world delta back into object space so the displacement reads
      // correctly regardless of the mesh's baked rotation/scale.
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* glsl */ `#include <begin_vertex>
          {
            vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;

            // Rooted base, swaying tip: 0 near the seabed, 1 at the tall tips.
            float w = smoothstep(uGroundY, uGroundY + uTallRef, worldPos.y);

            // Phase keyed off world XZ so neighbouring plants desync.
            float phase = dot(worldPos.xz, uCurrentDir);

            // Two octaves: a slow primary current + a faster low-amplitude flutter.
            float primary = sin(uTime * 0.6 + phase * 0.35);
            float flutter = sin(uTime * 1.9 + phase * 0.9) * 0.25;
            float swayAmt = (primary + flutter) * w * uSwayStrength;

            // Mostly horizontal along the current, with a small vertical bob.
            vec3 worldOffset = vec3(
              uCurrentDir.x * swayAmt,
              abs(swayAmt) * 0.12,
              uCurrentDir.y * swayAmt
            );

            // World delta -> object space. For a rotation+scale basis, the inverse
            // map of a direction is transpose(M) / colLength^2 per axis — version-safe
            // (no GLSL inverse()) and correct for the baked flora transform.
            mat3 m3 = mat3(modelMatrix);
            vec3 invSq = vec3(
              1.0 / max(dot(m3[0], m3[0]), 1e-6),
              1.0 / max(dot(m3[1], m3[1]), 1e-6),
              1.0 / max(dot(m3[2], m3[2]), 1e-6)
            );
            vec3 objOffset = (transpose(m3) * worldOffset) * invSq;
            transformed += objOffset;
          }`,
      );
    };

    // Force a recompile so the patched program is picked up.
    mat.needsUpdate = true;
  }

  function enhanceMaterials(scene: Object3D): void {
    scene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;
      const isRooted = NO_SWAY_NAME.test(m.name);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          mat.envMapIntensity = 0.3;
          if (!isRooted) patchSwayMaterial(mat);
        }
      }
    });
  }

  let floraScene = $state<Object3D | null>(null);

  $effect(() => {
    let cancelled = false;

    gltfLoader.load(
      FLORA_GLB_URL,
      (gltf) => {
        if (cancelled) return;
        enhanceMaterials(gltf.scene);
        floraScene = gltf.scene;
        onProgress?.(1.0);
        onReady?.();
      },
      (progress) => {
        if (cancelled || !progress.total) return;
        onProgress?.(progress.loaded / progress.total);
      },
      (err) => {
        if (cancelled) return;
        console.error("[FloraInstances] Failed to load ocean flora scene:", err);
        onReady?.();
      }
    );

    return () => {
      cancelled = true;
      if (floraScene) {
        floraScene.traverse((child) => {
          const m = child as Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mat: Material) => mat.dispose());
          }
        });
        floraScene = null;
      }
    };
  });

  // Keep the sway mask anchored to the live seabed height.
  $effect(() => {
    swayUniforms.uGroundY.value = userProportionsState.groundY;
  });

  // Advance the shared sway clock; all patched plant materials read uTime.
  useTask((delta) => {
    swayUniforms.uTime.value += delta;
  });
</script>

<!-- No Y offset: flora shares the exact Blender world transform as the seabed
     (ocean-environment.glb, rendered at identity in OceanScene). Offsetting only
     the flora by groundY sank every object below the sand. -->
{#if floraScene}
  <T is={floraScene} />
{/if}

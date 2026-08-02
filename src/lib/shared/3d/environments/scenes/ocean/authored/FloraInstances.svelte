<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { useDraco, useKtx2, useMeshopt } from "@threlte/extras";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import {
    Box3,
    Mesh,
    MeshStandardMaterial,
    Vector2,
    Vector3,
    type InstancedMesh,
    type Object3D,
    type Material,
    type WebGLProgramParametersWithUniforms,
  } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import { oceanDebugToggles } from "../quality/ocean-debug-toggles.svelte";
  import { patchCausticsMaterial } from "../runtime/atmosphere/seabed-caustics";
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
  // The flora GLB is one baked mesh set with opaque names (Mesh_0.067, …) and no
  // per-vertex sway mask, so we recover the rooted-base / swaying-tip look two ways:
  //
  //  1. WHICH meshes sway is decided per-mesh by world-AABB SHAPE, not by name.
  //     A mesh inspection (scripts/inspect-flora-meshes.cjs) measured every node's
  //     world-space bounding box and its height-to-footprint aspect (dy / max(dx,dz)).
  //     The scene splits cleanly: only two upright, slender plant meshes have
  //     aspect ≥ 1.4 (Mesh_0.067 ≈ 2.13, Mesh_0.005 ≈ 1.59). EVERYTHING bulky —
  //     coral arches/towers/bommies/columns, photoscanned rocks, the wide flora-
  //     atlas coral clumps (footprint ~2.0, aspect ≤ 0.85), fish-palette blobs and
  //     the seabed — sits at aspect ≤ 1.18, the highest of which (Coral_Arch ≈ 1.18)
  //     is a named structure. The 1.18→1.59 gap is wide and lands on a structure,
  //     so SWAY_ASPECT_MIN = 1.4 isolates the slender plants with margin.
  //
  //  2. Within a swaying plant, a world-height mask (above the seabed) gates a
  //     two-octave directional current so the base stays planted and only the tip
  //     moves. groundY is the canonical seabed surface (shared with godrays/fish).
  //
  // Tunables (the live knob is uSwayStrength — gentle current, not a gale):
  //   uTallRef    height above the floor at which a plant reaches full sway.
  //               Kelp/seagrass are the tall things; ~3 world units to their tips.
  //   uSwayStrength  master amplitude of the horizontal sway in world units.
  const SWAY_STRENGTH = 0.18;
  const TALL_REF = 3.0;

  // Height-to-footprint aspect above which a mesh counts as a slender plant.
  // Measured by scripts/inspect-flora-meshes.cjs: plants ≥ 1.59, next mesh
  // (Coral_Arch, a structure) = 1.18. 1.4 sits squarely in the gap.
  const SWAY_ASPECT_MIN = 1.4;
  // Primary current heading on the XZ plane (normalized): a slow diagonal drift.
  const CURRENT_DIR = new Vector2(0.8, 0.6).normalize();

  const swayUniforms = {
    uTime: { value: 0 },
    uGroundY: { value: userProportionsState.groundY },
    uTallRef: { value: TALL_REF },
    uSwayStrength: { value: SWAY_STRENGTH },
    uCurrentDir: { value: CURRENT_DIR },
  };

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
          uniform vec2 uCurrentDir;`
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
          }`
      );
    };

    // Force a recompile so the patched program is picked up.
    mat.needsUpdate = true;
  }

  // A mesh sways only if its world-space bounding box is taller than it is wide
  // by SWAY_ASPECT_MIN — i.e. it's a slender upright plant, not a bulky rock,
  // coral, arch, tower, or structure. Shape is the only reliable signal: the GLB
  // names are opaque and the one bulky rock isn't enough to gate on.
  const _box = new Box3();
  const _size = new Vector3();

  function meshAspect(m: Mesh): number {
    _box.setFromObject(m);
    if (_box.isEmpty()) return 0;
    _box.getSize(_size);
    const footprint = Math.max(_size.x, _size.z);
    return footprint > 1e-6 ? _size.y / footprint : Number.POSITIVE_INFINITY;
  }

  function enhanceMaterials(scene: Object3D): void {
    // World matrices must be current before measuring world-space AABBs.
    scene.updateWorldMatrix(true, true);

    const swayed: string[] = [];
    const skipped: string[] = [];

    scene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;

      const aspect = meshAspect(m);
      const isPlant = aspect >= SWAY_ASPECT_MIN;
      (isPlant ? swayed : skipped).push(
        `${m.name || "(unnamed)"}=${aspect.toFixed(2)}`
      );

      // The baked scene expands to roughly 54M rendered vertices because its
      // decor uses EXT_mesh_gpu_instancing. Keep those instances out of the
      // directional shadow pass; the 18 static hero rocks/arches/towers cast,
      // while every mesh receives their shadows. The duplicate seabed receives
      // only, matching the dedicated floor GLB in OceanScene.
      const isInstanced = (m as InstancedMesh).isInstancedMesh === true;
      m.castShadow = !isInstanced && m.name !== "Seabed";
      m.receiveShadow = true;

      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          // OceanScene owns the common environment intensity. Keep materials
          // neutral so the seabed and authored reef cannot drift apart again.
          mat.envMapIntensity = 1;
          // Sway FIRST (plants only), then caustics — patchCausticsMaterial chains
          // the prior onBeforeCompile, so a reed carries both; a structure carries
          // caustics alone. Caustics fade by height, so the tall reeds barely take
          // any while the seabed-level coral/rocks catch the full dapple.
          if (isPlant) patchSwayMaterial(mat);
          patchCausticsMaterial(mat);
        }
      }
    });

    if (import.meta.env.DEV) {
      console.debug(
        `[FloraInstances] sway aspect≥${SWAY_ASPECT_MIN} → ${swayed.length} swaying, ${skipped.length} rooted`,
        { swaying: swayed, rooted: skipped }
      );
    }
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
        console.error(
          "[FloraInstances] Failed to load ocean flora scene:",
          err
        );
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

  // Dev A/B toggle: zero the amplitude when sway is off (no shader recompile —
  // the patched program stays, it just displaces by 0).
  $effect(() => {
    swayUniforms.uSwayStrength.value = oceanDebugToggles.sway
      ? SWAY_STRENGTH
      : 0;
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

<script lang="ts">
  import { T } from "@threlte/core";
  import { useDraco, useKtx2, useMeshopt } from "@threlte/extras";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import {
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    type Material,
  } from "three";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import { R2_CDN } from "$lib/shared/3d/constants/r2-cdn";

  // The flora scene GLBs (~36-39 MB, geometry-heavy) exceed Cloudflare Pages' 25 MiB
  // per-file limit and are stripped from the deploy by trim-deploy-assets.js, so in
  // production they must come from R2 (same large-asset pattern as the forest scene).
  // Dev serves them from static/ directly — no R2 round-trip while iterating.
  // "hi" = 1024-baseColor build (ultra/desktop tier); "base" = 512 build.
  function floraUrl(variant: "hi" | "base"): string {
    const file =
      variant === "hi"
        ? "ocean_flora_scene_hi.glb"
        : "ocean_flora_scene.glb";
    return import.meta.env.DEV
      ? `/models/ocean/${file}`
      : `${R2_CDN}/models/ocean/${file}`;
  }

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

  function enhanceMaterials(scene: Object3D): void {
    scene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          mat.envMapIntensity = 0.3;
        }
      }
    });
  }

  let floraScene = $state<Object3D | null>(null);

  $effect(() => {
    let cancelled = false;
    // Read the reactive variant so a runtime tier change re-runs this effect.
    const baseUrl = floraUrl("base");
    const url = floraUrl(quality.floraVariant);

    function load(target: string, allowFallback: boolean) {
      gltfLoader.load(
        target,
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
          // hi build missing (404 / not yet on R2 / deploy lag) → fall back to
          // the base build once so an ultra user never gets an empty scene.
          if (allowFallback && target !== baseUrl) {
            console.warn(
              `[FloraInstances] ${target} failed; falling back to base build.`,
              err,
            );
            load(baseUrl, false);
            return;
          }
          console.error("[FloraInstances] Failed to load ocean flora scene:", err);
          onReady?.();
        }
      );
    }

    load(url, true);

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
</script>

<!-- No Y offset: flora shares the exact Blender world transform as the seabed
     (ocean-environment.glb, rendered at identity in OceanScene). Offsetting only
     the flora by groundY sank every object below the sand. -->
{#if floraScene}
  <T is={floraScene} />
{/if}

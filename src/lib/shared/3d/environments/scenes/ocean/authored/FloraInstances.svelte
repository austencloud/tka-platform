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
</script>

<!-- No Y offset: flora shares the exact Blender world transform as the seabed
     (ocean-environment.glb, rendered at identity in OceanScene). Offsetting only
     the flora by groundY sank every object below the sand. -->
{#if floraScene}
  <T is={floraScene} />
{/if}

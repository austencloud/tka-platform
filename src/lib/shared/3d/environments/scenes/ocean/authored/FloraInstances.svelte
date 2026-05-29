<script lang="ts">
  import { T } from "@threlte/core";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
  import {
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    type Material,
  } from "three";
  import type { OceanQualityConfig } from "../quality/ocean-quality";

  interface Props {
    quality: OceanQualityConfig;
    onProgress?: (fraction: number) => void;
    onReady?: () => void;
  }

  let { quality, onProgress, onReady }: Props = $props();

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);

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
      "/models/ocean/ocean_flora_scene.glb",
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

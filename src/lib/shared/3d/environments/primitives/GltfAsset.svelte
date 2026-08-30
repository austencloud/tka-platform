<script lang="ts">
  import { T } from "@threlte/core";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import {
    Mesh,
    MeshStandardMaterial,
    type Object3D,
    type Material,
  } from "three";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import {
    attachGltfDecoders,
    attachKtx2Decoder,
  } from "../../scene-boot/gltf-decoders";

  const gltfLoader = new GLTFLoader();
  attachGltfDecoders(gltfLoader);
  attachKtx2Decoder(gltfLoader);

  interface Props {
    /** Path to the optimized GLB (served from static/, e.g. /models/ocean/stage.glb). */
    url: string;
    position?: [number, number, number];
    rotation?: [number, number, number];
    scale?: number | [number, number, number];
    /** When set, load progress/readiness is reported to the scene-feature context under this key. */
    progressFeatureKey?: string;
    /** Multiplies emissive intensity on standard materials — used to rescue a glow that imports dark. */
    emissiveBoost?: number;
    onReady?: (scene: Object3D) => void;
    onProgress?: (fraction: number) => void;
  }

  let {
    url,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    progressFeatureKey,
    emissiveBoost,
    onReady,
    onProgress,
  }: Props = $props();

  const sceneFeatures = getSceneFeatureContext();

  let loaded = $state<Object3D | null>(null);

  function applyEmissiveBoost(scene: Object3D, boost: number): void {
    scene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof MeshStandardMaterial) {
          mat.emissiveIntensity = (mat.emissiveIntensity || 1) * boost;
        }
      }
    });
  }

  function disposeScene(scene: Object3D): void {
    scene.traverse((child) => {
      const m = child as Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat: Material) => mat.dispose());
    });
  }

  $effect(() => {
    // Re-run whenever the url changes; the cleanup disposes the prior asset.
    const currentUrl = url;
    const key = progressFeatureKey;
    let cancelled = false;

    gltfLoader.load(
      currentUrl,
      (gltf) => {
        if (cancelled) return;
        if (emissiveBoost != null) applyEmissiveBoost(gltf.scene, emissiveBoost);
        loaded = gltf.scene;
        onProgress?.(1);
        if (key) sceneFeatures?.reportProgress(key, 1);
        if (key) sceneFeatures?.reportReady(key);
        onReady?.(gltf.scene);
      },
      (progress) => {
        if (cancelled || !progress.total) return;
        const fraction = progress.loaded / progress.total;
        onProgress?.(fraction);
        if (key) sceneFeatures?.reportProgress(key, fraction);
      },
      (err) => {
        if (cancelled) return;
        // Soft failure: never hang the loading curtain — mark ready and render
        // nothing. The scene stays usable without this asset.
        console.error(`[GltfAsset] Failed to load ${currentUrl}:`, err);
        if (key) sceneFeatures?.reportReady(key);
      },
    );

    return () => {
      cancelled = true;
      if (loaded) {
        disposeScene(loaded);
        loaded = null;
      }
    };
  });
</script>

{#if loaded}
  <T.Group {position} {rotation} scale={Array.isArray(scale) ? scale : [scale, scale, scale]}>
    <T is={loaded} />
  </T.Group>
{/if}

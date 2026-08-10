<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { useKtx2 } from "@threlte/extras";
  import { onMount } from "svelte";
  import {
    RepeatWrapping,
    SRGBColorSpace,
    type Mesh,
    type MeshStandardMaterial,
    type Object3D,
    type Texture,
  } from "three";
  import {
    isAutumnGroundMaterial,
    patchAutumnGroundDetailMaterial,
    type AutumnGroundDetailPatch,
  } from "./autumn-ground-detail";

  interface Props {
    scene?: Object3D | null;
    strength?: number;
  }

  let { scene = null, strength = 0.9 }: Props = $props();

  const { renderer } = useThrelte();
  const ktx2 = useKtx2("/basis/");
  let detailMap = $state<Texture | null>(null);

  onMount(() => {
    let cancelled = false;
    ktx2.load(
      "/textures/autumn-floor/ground-detail-modulation.ktx2",
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.anisotropy = Math.min(
          8,
          renderer.capabilities.getMaxAnisotropy()
        );
        texture.needsUpdate = true;
        detailMap = texture;
      },
      undefined,
      (error) => {
        // The macro atlas still contains the paths and ecological zones. A
        // failed detail texture should leave that usable floor visible rather
        // than taking the entire Autumn environment down.
        console.warn("[AutumnGroundDetail] detail texture failed to load", error);
      }
    );

    return () => {
      cancelled = true;
      detailMap?.dispose();
      detailMap = null;
    };
  });

  $effect(() => {
    const loadedScene = scene;
    const texture = detailMap;
    if (!loadedScene || !texture) return;

    const patches = new Set<AutumnGroundDetailPatch>();
    loadedScene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const candidate of materials) {
        const material = candidate as MeshStandardMaterial;
        if (!material.isMeshStandardMaterial) continue;
        if (!isAutumnGroundMaterial(material)) continue;
        patches.add(
          patchAutumnGroundDetailMaterial(material, texture, strength)
        );
      }
    });

    return () => {
      for (const patch of patches) patch.dispose();
    };
  });
</script>

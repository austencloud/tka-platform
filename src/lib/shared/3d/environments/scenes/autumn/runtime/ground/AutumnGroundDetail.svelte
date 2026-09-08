<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { useKtx2 } from "@threlte/extras";
  import { untrack } from "svelte";
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
  import type { AutumnBootStatus } from "../autumn-boot-state";

  interface Props {
    scene?: Object3D | null;
    strength?: number;
    retryRequest?: number;
    onStatus?: (status: AutumnBootStatus) => void;
  }

  let {
    scene = null,
    strength = 0.9,
    retryRequest = 0,
    onStatus,
  }: Props = $props();

  const { renderer } = useThrelte();
  const ktx2 = useKtx2("/basis/");
  let detailMap = $state<Texture | null>(null);

  function reportStatus(status: AutumnBootStatus): void {
    untrack(() => onStatus?.(status));
  }

  $effect(() => {
    const retry = retryRequest;
    let cancelled = false;
    reportStatus("pending");
    ktx2.load(
      `/textures/autumn-floor/ground-detail-modulation.ktx2${retry > 0 ? `?retry=${retry}` : ""}`,
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
        reportStatus("ready");
      },
      undefined,
      (error) => {
        // The macro atlas still contains the paths and ecological zones. A
        // failed detail texture should leave that usable floor visible rather
        // than taking the entire Autumn environment down.
        console.warn(
          "[AutumnGroundDetail] detail texture failed to load",
          error
        );
        if (!cancelled) reportStatus("failed");
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

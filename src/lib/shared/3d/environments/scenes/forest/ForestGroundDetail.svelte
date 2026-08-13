<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import {
    RepeatWrapping,
    NoColorSpace,
    SRGBColorSpace,
    TextureLoader,
    type Mesh,
    type MeshStandardMaterial,
    type Object3D,
    type Texture,
  } from "three";
  import {
    isForestGroundMaterial,
    FOREST_GROUND_DETAIL_TEXTURES,
    getForestGroundDetailFamily,
    patchForestGroundDetailMaterial,
    type ForestGroundDetailFamily,
    type ForestGroundDetailPatch,
  } from "./forest-ground-detail";

  interface Props {
    scene?: Object3D | null;
    strength?: number;
    normalResponse?: number;
    roughnessFloor?: number;
  }

  let {
    scene = null,
    strength = 0.9,
    normalResponse = 0.72,
    roughnessFloor = 0.82,
  }: Props = $props();
  const { renderer } = useThrelte();
  let detailMaps = $state<Partial<Record<ForestGroundDetailFamily, Texture>>>(
    {}
  );
  let familyMask = $state<Texture | null>(null);

  onMount(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    const loadedTextures: Partial<Record<ForestGroundDetailFamily, Texture>> =
      {};
    for (const [family, path] of Object.entries(
      FOREST_GROUND_DETAIL_TEXTURES
    ) as [ForestGroundDetailFamily, string][]) {
      loader.load(
        path,
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
          loadedTextures[family] = texture;
          detailMaps = { ...loadedTextures };
        },
        undefined,
        (error) => {
          console.warn(
            `[ForestGroundDetail] ${family} detail texture failed to load`,
            error
          );
        }
      );
    }
    loader.load(
      "/textures/forest-floor/forest-floor-family-mask.png",
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.colorSpace = NoColorSpace;
        texture.needsUpdate = true;
        familyMask = texture;
      },
      undefined,
      (error) => {
        console.warn("[ForestGroundDetail] family mask failed to load", error);
      }
    );

    return () => {
      cancelled = true;
      for (const texture of Object.values(loadedTextures)) texture?.dispose();
      familyMask?.dispose();
      detailMaps = {};
      familyMask = null;
    };
  });

  $effect(() => {
    const loadedScene = scene;
    const textures = detailMaps;
    const mask = familyMask;
    if (!loadedScene || !mask || Object.keys(textures).length < 4) return;

    const patches = new Set<ForestGroundDetailPatch>();
    loadedScene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const candidate of materials) {
        const material = candidate as MeshStandardMaterial;
        if (!material.isMeshStandardMaterial) continue;
        if (!isForestGroundMaterial(material)) continue;
        if (!getForestGroundDetailFamily(material)) continue;
        patches.add(
          patchForestGroundDetailMaterial(
            material,
            textures as Record<ForestGroundDetailFamily, Texture>,
            mask,
            strength,
            {
              preserveColor: material.color,
              normalResponse,
              roughnessFloor,
            }
          )
        );
      }
    });
    return () => {
      for (const patch of patches) patch.dispose();
    };
  });
</script>

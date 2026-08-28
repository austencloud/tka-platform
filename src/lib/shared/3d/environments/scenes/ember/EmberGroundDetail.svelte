<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import {
    NoColorSpace,
    RepeatWrapping,
    SRGBColorSpace,
    TextureLoader,
    type Mesh,
    type MeshStandardMaterial,
    type Object3D,
    type Texture,
  } from "three";
  import {
    EMBER_GROUND_DETAIL_MASK,
    EMBER_GROUND_DETAIL_TEXTURES,
    isEmberGroundDetailSurface,
    patchEmberGroundDetailMaterial,
    type EmberGroundDetailFamily,
    type EmberGroundDetailPatch,
  } from "./ember-ground-detail";

  interface Props {
    scene?: Object3D | null;
    strength?: number;
  }

  let { scene = null, strength = 0.92 }: Props = $props();
  const { renderer } = useThrelte();
  let detailMaps = $state<Partial<Record<EmberGroundDetailFamily, Texture>>>(
    {}
  );
  let familyMask = $state<Texture | null>(null);

  onMount(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    const loadedTextures: Partial<Record<EmberGroundDetailFamily, Texture>> =
      {};

    for (const [family, path] of Object.entries(
      EMBER_GROUND_DETAIL_TEXTURES
    ) as [EmberGroundDetailFamily, string][]) {
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
            `[EmberGroundDetail] ${family} detail texture failed to load`,
            error
          );
        }
      );
    }

    loader.load(
      EMBER_GROUND_DETAIL_MASK,
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
        console.warn("[EmberGroundDetail] family mask failed to load", error);
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

    const patches = new Set<EmberGroundDetailPatch>();
    loadedScene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const role = child.userData.tka_role as string | undefined;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const candidate of materials) {
        const material = candidate as MeshStandardMaterial;
        if (!material.isMeshStandardMaterial) continue;
        if (!isEmberGroundDetailSurface(role, material)) continue;
        patches.add(
          patchEmberGroundDetailMaterial(
            material,
            textures as Record<EmberGroundDetailFamily, Texture>,
            mask,
            strength,
            { preserveColor: material.color }
          )
        );
      }
    });

    return () => {
      for (const patch of patches) patch.dispose();
    };
  });
</script>

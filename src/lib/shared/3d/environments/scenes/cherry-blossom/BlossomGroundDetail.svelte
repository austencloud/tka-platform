<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { onMount } from "svelte";
  import {
    Color,
    NoColorSpace,
    RepeatWrapping,
    SRGBColorSpace,
    TextureLoader,
    Vector2,
    type Mesh,
    type MeshStandardMaterial,
    type Object3D,
    type Texture,
    type WebGLRenderer,
  } from "three";
  import {
    patchMaskedGroundDetailMaterial,
    type MaskedGroundDetailPatch,
    type MaskedGroundDetailMaps,
  } from "../../primitives/masked-ground-detail-material";
  import {
    getBlossomGroundMaskBounds,
    getBlossomStageContact,
  } from "./blossom-ground";

  interface Props {
    scene?: Object3D | null;
    stageWidth: number;
    stageDepth: number;
    stageZOffset: number;
  }

  let { scene = null, stageWidth, stageDepth, stageZOffset }: Props = $props();
  const { renderer } = useThrelte();
  const webglRenderer = (
    "current" in renderer && renderer.current
      ? renderer.current
      : (renderer as unknown)
  ) as WebGLRenderer;
  const texturePaths: Record<keyof MaskedGroundDetailMaps, string> = {
    red: "/textures/forest-floor/forest-ground-detail-neutral.jpg",
    green: "/textures/forest-floor/forest-ground-detail-meadow.jpg",
    blue: "/textures/forest-floor/forest-ground-detail-litter.jpg",
    fourth: "/textures/forest-floor/forest-ground-detail-damp.jpg",
  };
  let detailMaps = $state<Partial<MaskedGroundDetailMaps>>({});
  let familyMask = $state<Texture | null>(null);

  onMount(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    const loadedMaps: Partial<MaskedGroundDetailMaps> = {};

    for (const [family, path] of Object.entries(texturePaths) as [
      keyof MaskedGroundDetailMaps,
      string,
    ][]) {
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
            webglRenderer.capabilities.getMaxAnisotropy()
          );
          texture.needsUpdate = true;
          loadedMaps[family] = texture;
          detailMaps = { ...loadedMaps };
        },
        undefined,
        (error) => {
          console.warn(
            `[BlossomGroundDetail] ${family} texture failed to load`,
            error
          );
        }
      );
    }

    loader.load(
      "/textures/blossom-floor/blossom-ground-family-mask.png",
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
        console.warn(
          "[BlossomGroundDetail] habitat mask failed to load",
          error
        );
      }
    );

    return () => {
      cancelled = true;
      for (const texture of Object.values(loadedMaps)) texture?.dispose();
      familyMask?.dispose();
      detailMaps = {};
      familyMask = null;
    };
  });

  $effect(() => {
    const loadedScene = scene;
    const textures = detailMaps;
    const mask = familyMask;
    const width = stageWidth;
    const depth = stageDepth;
    const depthOffset = stageZOffset;
    if (!loadedScene || !mask || Object.keys(textures).length < 4) return;

    const bounds = getBlossomGroundMaskBounds();
    const contact = getBlossomStageContact();
    const patches = new Set<MaskedGroundDetailPatch>();

    loadedScene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const candidate of materials) {
        const material = candidate as MeshStandardMaterial;
        if (
          !material.isMeshStandardMaterial ||
          material.name !== "Blossom Living Garden Ground"
        ) {
          continue;
        }
        patches.add(
          patchMaskedGroundDetailMaterial(
            material,
            textures as MaskedGroundDetailMaps,
            mask,
            0.92,
            {
              storageKey: "blossomGroundDetailPatch",
              cacheKey: "blossom-ground-detail-r2.1",
              preserveColor: material.color,
              normalResponse: 0.27,
              roughnessFloor: 0.98,
              absoluteColorStrength: 0.76,
              primaryScale: 2.45,
              secondaryScale: 6.8,
              maskOrigin: new Vector2(
                bounds.min[0],
                bounds.min[1] + depthOffset
              ),
              maskSize: new Vector2(bounds.size[0], bounds.size[1]),
              worldAxisSign: new Vector2(1, 1),
              /**
               * Compacted, meadow, litter, damp — in mask channel order.
               *
               * The compacted family is the ground under and beside every walk,
               * and it was authored at a dark olive that sat below the meadow
               * beside it in every channel. Crushed stone under a moon is the
               * brightest thing on a garden floor, not the darkest, so the walks
               * rendered as dark stains and the wear beside them widened the
               * stain rather than explaining it. This is a pale warm grey that
               * reads as stone the moment it catches any light.
               */
              familyBaselines: [
                new Color(0.58, 0.56, 0.49),
                new Color(0.44, 0.62, 0.29),
                new Color(0.36, 0.44, 0.25),
                new Color(0.27, 0.31, 0.23),
              ],
              macroDark: new Color(0.86, 0.9, 0.84),
              macroLight: new Color(1.07, 1.03, 0.96),
              contactZone: {
                center: new Vector2(0, depthOffset),
                halfSize: new Vector2(
                  width * 0.5 + contact.edgeInset,
                  depth * 0.5 + contact.edgeInset
                ),
                feather: contact.feather,
                noise: contact.noise,
                strength: contact.strength,
              },
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

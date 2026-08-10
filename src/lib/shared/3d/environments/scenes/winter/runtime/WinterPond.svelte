<script lang="ts">
  import { T } from "@threlte/core";
  import { untrack } from "svelte";
  import {
    Color,
    MeshPhysicalMaterial,
    NoColorSpace,
    RepeatWrapping,
    ShapeGeometry,
    SRGBColorSpace,
    TextureLoader,
    Vector2,
  } from "three";
  import { createOrganicPondShape } from "../../../primitives/organic-pond-shape";
  import type { WinterSceneConfig } from "../../../domain/models/scene-configs";
  import { WINTER_POND_LAYOUT } from "../authored/winter-layout";

  interface Props {
    pond: NonNullable<WinterSceneConfig["pond"]>;
    groundY: number;
    surfaceDetail: "full" | "reduced";
  }

  let { pond, groundY, surfaceDetail }: Props = $props();

  const pondY = $derived(groundY + WINTER_POND_LAYOUT.waterLevelOffset);
  let geometry = $state<ShapeGeometry | null>(null);
  let bodyMaterial = $state<MeshPhysicalMaterial | null>(null);
  let clearMaterial = $state<MeshPhysicalMaterial | null>(null);

  $effect(() => {
    const loader = new TextureLoader();
    const colorMap = loader.load("/textures/winter/ice-surface.webp");
    const roughnessMap = loader.load("/textures/winter/ice-roughness.webp");
    const bodyNormal = loader.load("/textures/water/Water_1_M_Normal.jpg");
    const coatNormal = loader.load("/textures/water/Water_2_M_Normal.jpg");

    colorMap.colorSpace = SRGBColorSpace;
    roughnessMap.colorSpace = NoColorSpace;
    bodyNormal.colorSpace = NoColorSpace;
    coatNormal.colorSpace = NoColorSpace;

    for (const texture of [colorMap, roughnessMap, bodyNormal, coatNormal]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.anisotropy = surfaceDetail === "full" ? 8 : 4;
    }
    colorMap.repeat.set(0.12, 0.12);
    roughnessMap.repeat.copy(colorMap.repeat);
    bodyNormal.repeat.set(0.42, 0.38);
    coatNormal.repeat.set(0.68, 0.62);
    coatNormal.rotation = 0.38;
    coatNormal.center.set(0.5, 0.5);

    const nextGeometry = new ShapeGeometry(
      createOrganicPondShape({
        radiusX: WINTER_POND_LAYOUT.radiusX,
        radiusZ: WINTER_POND_LAYOUT.radiusZ,
        seed: WINTER_POND_LAYOUT.seed,
        pointCount: 48,
      }),
      48
    );
    const tint = new Color(pond.color).lerp(new Color("#8fa7b8"), 0.18);
    const nextBodyMaterial = new MeshPhysicalMaterial({
      color: tint,
      map: colorMap,
      roughnessMap,
      roughness: Math.max(0.56, pond.roughness),
      metalness: 0.015,
      normalMap: bodyNormal,
      normalScale:
        surfaceDetail === "full"
          ? new Vector2(0.3, 0.28)
          : new Vector2(0.16, 0.14),
      clearcoat: 0.26,
      clearcoatRoughness: 0.42,
      clearcoatNormalMap: coatNormal,
      clearcoatNormalScale: new Vector2(0.07, 0.07),
      ior: 1.31,
      envMapIntensity: 0.48,
    });
    const nextClearMaterial = new MeshPhysicalMaterial({
      color: new Color("#9fb8c9"),
      roughness: 0.48,
      metalness: 0,
      transparent: true,
      opacity: surfaceDetail === "full" ? 0.045 : 0.025,
      depthWrite: false,
      clearcoat: 0.18,
      clearcoatRoughness: 0.5,
      normalMap: coatNormal,
      normalScale: new Vector2(0.05, 0.05),
      envMapIntensity: 0.38,
    });

    untrack(() => {
      geometry = nextGeometry;
      bodyMaterial = nextBodyMaterial;
      clearMaterial = nextClearMaterial;
    });

    return () => {
      nextGeometry.dispose();
      nextBodyMaterial.dispose();
      nextClearMaterial.dispose();
      colorMap.dispose();
      roughnessMap.dispose();
      bodyNormal.dispose();
      coatNormal.dispose();
    };
  });
</script>

{#if geometry && bodyMaterial && clearMaterial}
  <T.Group
    position.x={WINTER_POND_LAYOUT.centerX}
    position.y={pondY}
    position.z={WINTER_POND_LAYOUT.centerZ}
  >
    <T.Mesh
      {geometry}
      material={bodyMaterial}
      rotation.x={-Math.PI / 2}
      receiveShadow
      renderOrder={70}
    />
    <T.Mesh
      {geometry}
      material={clearMaterial}
      rotation.x={-Math.PI / 2}
      position.y={0.018}
      renderOrder={71}
    />
  </T.Group>
{/if}

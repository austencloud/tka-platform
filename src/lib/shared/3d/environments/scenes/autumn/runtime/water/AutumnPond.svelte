<script lang="ts">
  /**
   * AutumnPond
   *
   * An elliptical, organic pond matching the Blender-authored basin. The
   * production surface uses the project's existing water normal maps on two
   * independently moving physical layers: one for the water body and one for
   * its clear coat. This gives the pond readable ripples and grazing-angle
   * highlights without paying for an extra reflection render.
   */

  import { T, useTask } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    Color,
    MeshPhysicalMaterial,
    NoColorSpace,
    RepeatWrapping,
    ShapeGeometry,
    TextureLoader,
    Vector2,
    type Material,
    type Texture,
  } from "three";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";
  import { createOrganicPondShape } from "../../../../primitives/organic-pond-shape";
  import { AUTUMN_POND_LAYOUT } from "./autumn-pond-layout";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    position?: [number, number, number];
    radiusX?: number;
    radiusZ?: number;
    seed?: number;
    waterLevelOffset?: number;
  }

  let {
    quality,
    groundY = 0,
    position = [0, 0, 0],
    radiusX = AUTUMN_POND_LAYOUT.radiusX,
    radiusZ = AUTUMN_POND_LAYOUT.radiusZ,
    seed = AUTUMN_POND_LAYOUT.seed,
    waterLevelOffset = AUTUMN_POND_LAYOUT.waterLevelOffset,
  }: Props = $props();

  const REFLECTOR_COLOR = "#c98a5a";
  const WATER_BODY_COLOR = "#181528";
  const NORMAL_MAP_PATH = "/textures/water/Water_1_M_Normal.jpg";
  const COAT_NORMAL_MAP_PATH = "/textures/water/Water_2_M_Normal.jpg";

  function configureWaterNormal(texture: Texture, repeat: number): void {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = NoColorSpace;
    texture.anisotropy = 4;
  }

  const pondY = $derived((position[1] ?? groundY) + waterLevelOffset);

  let pondReflector = $state<Reflector | null>(null);
  let surfaceGeometry = $state<ShapeGeometry | null>(null);
  let surfaceMaterial = $state<MeshPhysicalMaterial | null>(null);
  let bodyNormal = $state<Texture | null>(null);
  let coatNormal = $state<Texture | null>(null);

  $effect(() => {
    if (!quality.pondReflector) {
      untrack(() => {
        pondReflector?.geometry.dispose();
        (pondReflector?.material as Material | undefined)?.dispose();
        pondReflector = null;
      });
      return;
    }

    const geometry = new ShapeGeometry(
      createOrganicPondShape({ radiusX, radiusZ, seed }),
      48
    );
    const next = new Reflector(geometry, {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: new Color(REFLECTOR_COLOR),
    });
    next.rotateX(-Math.PI / 2);

    untrack(() => {
      pondReflector?.geometry.dispose();
      (pondReflector?.material as Material | undefined)?.dispose();
      pondReflector = next;
    });

    return () => {
      next.geometry.dispose();
      (next.material as Material).dispose();
    };
  });

  $effect(() => {
    if (quality.pondReflector) {
      untrack(() => {
        surfaceGeometry?.dispose();
        surfaceMaterial?.dispose();
        bodyNormal?.dispose();
        coatNormal?.dispose();
        surfaceGeometry = null;
        surfaceMaterial = null;
        bodyNormal = null;
        coatNormal = null;
      });
      return;
    }

    const geometry = new ShapeGeometry(
      createOrganicPondShape({ radiusX, radiusZ, seed }),
      48
    );
    const loader = new TextureLoader();
    const normal0 = loader.load(NORMAL_MAP_PATH);
    const normal1 = loader.load(COAT_NORMAL_MAP_PATH);
    configureWaterNormal(normal0, 3.6);
    configureWaterNormal(normal1, 5.2);
    normal1.center.set(0.5, 0.5);
    normal1.rotation = 0.42;

    const material = new MeshPhysicalMaterial({
      color: new Color(WATER_BODY_COLOR),
      emissive: new Color("#071922"),
      emissiveIntensity: 0.13,
      roughness: 0.22,
      metalness: 0.06,
      transparent: true,
      opacity: 0.88,
      ior: 1.333,
      transmission: 0.06,
      thickness: 0.24,
      attenuationColor: new Color("#2a1737"),
      attenuationDistance: 3.2,
      clearcoat: 0.72,
      clearcoatRoughness: 0.15,
      normalMap: normal0,
      normalScale: new Vector2(0.34, 0.34),
      clearcoatNormalMap: normal1,
      clearcoatNormalScale: new Vector2(0.2, 0.2),
      envMapIntensity: 0.92,
      depthWrite: true,
    });

    untrack(() => {
      surfaceGeometry?.dispose();
      surfaceMaterial?.dispose();
      bodyNormal?.dispose();
      coatNormal?.dispose();
      surfaceGeometry = geometry;
      surfaceMaterial = material;
      bodyNormal = normal0;
      coatNormal = normal1;
    });

    return () => {
      geometry.dispose();
      material.dispose();
      normal0.dispose();
      normal1.dispose();
    };
  });

  useTask((delta) => {
    const normal0 = bodyNormal;
    const normal1 = coatNormal;
    if (normal0) {
      normal0.offset.x = (normal0.offset.x + delta * 0.0045) % 1;
      normal0.offset.y = (normal0.offset.y + delta * 0.0022) % 1;
    }
    if (normal1) {
      normal1.offset.x = (normal1.offset.x - delta * 0.0031 + 1) % 1;
      normal1.offset.y = (normal1.offset.y + delta * 0.0048) % 1;
    }
  });

  onDestroy(() => {
    pondReflector?.geometry.dispose();
    (pondReflector?.material as Material | undefined)?.dispose();
    surfaceGeometry?.dispose();
    surfaceMaterial?.dispose();
    bodyNormal?.dispose();
    coatNormal?.dispose();
  });
</script>

{#if quality.pondReflector && pondReflector}
  <T
    is={pondReflector}
    position.x={position[0]}
    position.y={pondY}
    position.z={position[2]}
  />
{:else if surfaceGeometry && surfaceMaterial}
  <T.Mesh
    geometry={surfaceGeometry}
    material={surfaceMaterial}
    position.x={position[0]}
    position.y={pondY}
    position.z={position[2]}
    rotation.x={-Math.PI / 2}
    renderOrder={80}
  />
{/if}

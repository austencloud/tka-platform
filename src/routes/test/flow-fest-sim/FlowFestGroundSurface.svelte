<script lang="ts">
  import {
    ClampToEdgeWrapping,
    DataTexture,
    LinearFilter,
    LinearMipmapLinearFilter,
    NoColorSpace,
    RGBAFormat,
    UnsignedByteType,
    type Object3D,
    type Texture,
  } from "three";
  import ForestGroundDetail from "$lib/shared/3d/environments/scenes/forest/ForestGroundDetail.svelte";
  import type { FlowFestGroundFamilyMask } from "./flow-fest-ground-surface";

  interface Props {
    surface: FlowFestGroundFamilyMask;
    scene?: Object3D | null;
  }

  let { surface, scene = null }: Props = $props();
  const TARGET_OBJECT_PREFIXES = [
    "FFS_Terrain_",
    "FFS_PrivateDrive_",
    "FFS_PublicRoadShoulder_",
    "FFS_FootConnector_",
  ] as const;

  let familyMask = $state<Texture | null>(null);

  function recordAppliedGround(details: {
    patchedMaterials: number;
    objectNames: string[];
  }): void {
    (globalThis as Record<string, unknown>).__flowFestGroundSurface = {
      ...surface.audit,
      ...details,
    };
    const proof = (globalThis as Record<string, unknown>)
      .__flowFestProduction as
      { groundSurface?: Record<string, unknown> } | undefined;
    if (!proof?.groundSurface) return;
    proof.groundSurface.patchedMaterials = details.patchedMaterials;
    proof.groundSurface.patchedObjects = details.objectNames;
  }

  $effect(() => {
    const activeSurface = surface;
    const texture = new DataTexture(
      activeSurface.data,
      activeSurface.width,
      activeSurface.height,
      RGBAFormat,
      UnsignedByteType
    );
    texture.name = "Flow Fest registered ground-family mask";
    texture.colorSpace = NoColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    familyMask = texture;
    return () => {
      if (familyMask === texture) familyMask = null;
      texture.dispose();
    };
  });
</script>

{#if familyMask}
  <ForestGroundDetail
    {scene}
    strength={0.96}
    normalResponse={0.32}
    roughnessFloor={0.9}
    absoluteColorStrength={0.84}
    primaryScale={2.45}
    secondaryScale={6.8}
    familyMaskTexture={familyMask}
    familyMaskPath={null}
    maskOrigin={[surface.maskOrigin.x, surface.maskOrigin.y]}
    maskSize={[surface.maskSize.x, surface.maskSize.y]}
    worldAxisSign={[surface.worldAxisSign.x, surface.worldAxisSign.y]}
    targetObjectNamePrefixes={TARGET_OBJECT_PREFIXES}
    materialFamilyOverride="neutral"
    watchSceneGraph={true}
    includeAncestorScene={true}
    onApplied={recordAppliedGround}
  />
{/if}

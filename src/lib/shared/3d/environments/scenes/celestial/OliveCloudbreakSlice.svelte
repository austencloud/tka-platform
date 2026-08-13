<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy } from "svelte";
  import {
    Mesh,
    MeshStandardMaterial,
    type Group,
    type Material,
    type Object3D,
  } from "three";

  import ReflectivePool from "../../primitives/ReflectivePool.svelte";
  import { tryGetAdaptiveQualityContext } from "../../../context/adaptive-quality-context";
  import CloudbreakAsset from "./CloudbreakAsset.svelte";
  import CloudbreakLagoonEdge from "./CloudbreakLagoonEdge.svelte";
  import CloudbreakSpatialStudy from "./CloudbreakSpatialStudy.svelte";
  import CloudbreakWaterfall from "./CloudbreakWaterfall.svelte";
  import {
    getCloudbreakRuntimeAsset,
    type CloudbreakRenderableAsset,
  } from "./cloudbreak-assets";
  import {
    CLOUDBREAK_LAGOON,
    CLOUDBREAK_LAGOON_LOCAL_OUTLINE,
    CLOUDBREAK_LAYOUT,
    CLOUDBREAK_SKY_SUN,
    type CloudbreakAssemblyView,
  } from "./cloudbreak-layout";

  interface Props {
    interactionPulse?: number;
    view?: CloudbreakAssemblyView;
    groundY?: number;
    onReady?: () => void;
    onAssetReady?: (id: string) => void;
  }

  interface Placement {
    asset: CloudbreakRenderableAsset;
    position: [number, number, number];
    rotationY: number;
    scaleMultiplier?: number;
  }

  let {
    interactionPulse = 0,
    view = "runtime",
    groundY = userProportionsState.groundY,
    onReady,
    onAssetReady,
  }: Props = $props();

  const adaptiveQuality = tryGetAdaptiveQualityContext();
  const reflectionResolution = $derived(
    adaptiveQuality?.contentTier === "high" ? 768 : 512
  );
  const shellGltf = useGltf(
    "/models/celestial/olive-cloudbreak-production-slice.glb?v=cloudbreak-r6-runtime",
    {
      meshoptDecoder: useMeshopt(),
      ktx2Loader: useKtx2("/basis/"),
    }
  );
  const { scene, renderer, camera } = useThrelte();
  const shellMaterials = new Set<Material>();
  let shell = $state<Group | null>(null);
  let shellLimestone = $state<MeshStandardMaterial | null>(null);
  let readyAssetIds = $state<string[]>([]);
  let reportedReady = false;

  const fullAssembly = $derived(
    view === "runtime" || view === "front" || view === "rear" || view === "plan"
  );

  const placements = $derived.by<Placement[]>(() => {
    if (view === "trees") {
      return [
        {
          asset: getCloudbreakRuntimeAsset("olive-west-ancient"),
          position: [-7.5, 0.02, -1],
          rotationY: -0.25,
        },
        {
          asset: getCloudbreakRuntimeAsset("olive-east-windswept"),
          position: [0.5, 0.02, -1],
          rotationY: 0.35,
        },
      ];
    }
    if (view === "stone") {
      return [
        {
          asset: getCloudbreakRuntimeAsset("coast-rocks-05"),
          position: [-4.8, 0.02, -1],
          rotationY: -0.4,
        },
        {
          asset: getCloudbreakRuntimeAsset("sand-rocks-small-01"),
          position: [2.4, 0.02, -1],
          rotationY: 0.25,
        },
      ];
    }
    if (view === "rear") return [];
    return [
      {
        asset: getCloudbreakRuntimeAsset("olive-west-ancient"),
        position: [-9.2, 0.02, -0.5],
        rotationY: -0.28,
      },
      {
        asset: getCloudbreakRuntimeAsset("olive-east-windswept"),
        position: [8.2, 0.02, 1.6],
        rotationY: 0.42,
      },
      {
        asset: getCloudbreakRuntimeAsset("coast-rocks-05"),
        position: [10.5, 0.02, 5.25],
        rotationY: -0.74,
        scaleMultiplier: 0.92,
      },
      {
        asset: getCloudbreakRuntimeAsset("sand-rocks-small-01"),
        position: [11.35, 0.02, -5.25],
        rotationY: 0.38,
        scaleMultiplier: 0.82,
      },
    ];
  });

  function applyShellVisibility(root: Object3D): void {
    const isolatedBench = view === "trees" || view === "stone";
    root.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const role = String(child.userData.tka_role ?? "");
      const element = String(child.userData.tka_element ?? "");
      const distantOlive = element === "high-olive-distant-tree";
      const placeholderForegroundOlive =
        (role === "cloudbreak-olive-trunk" ||
          role === "cloudbreak-olive-canopy") &&
        !distantOlive;
      const isolatedContext =
        role === "cloudbreak-distant-mesa" ||
        role === "cloudbreak-distant-mesa-cap" ||
        (role === "cloudbreak-waterfall" && element !== "lagoon") ||
        distantOlive;

      child.visible = !(
        placeholderForegroundOlive ||
        role === "cloudbreak-root-stone" ||
        role === "cloudbreak-surface-stone" ||
        role === "cloudbreak-performance-terrace" ||
        role === "cloudbreak-lagoon-rim" ||
        role === "cloudbreak-lagoon-water" ||
        role === "cloudbreak-waterfall" ||
        (isolatedBench && isolatedContext)
      );
    });
  }

  function gradeShellMaterial(
    source: Material,
    role: string,
    element: string
  ): Material {
    const material = source.clone();
    shellMaterials.add(material);
    if (!(material instanceof MeshStandardMaterial)) return material;

    material.metalness = 0;
    material.envMapIntensity = 0.36;
    material.emissive.set("#000000");
    material.emissiveIntensity = 0;
    if (role === "cloudbreak-weathered-surface") {
      material.color.set("#c8b184");
      material.roughness = 0.96;
      material.normalScale.set(0.62, 0.62);
    } else if (role === "cloudbreak-landmass") {
      material.color.set("#a77d56");
      material.roughness = 0.9;
    } else if (role === "cloudbreak-landmass-strata") {
      material.color.set("#79563e");
      material.roughness = 0.97;
    } else if (role === "cloudbreak-distant-mesa") {
      const mesaColors: Record<string, string> = {
        "left-fall": "#9a704e",
        "right-fall": "#a77e59",
        "high-olive": "#b28e69",
        "far-right-shelf": "#bea17f",
      };
      material.color.set(mesaColors[element] ?? "#a77e59");
      material.roughness = 0.92;
    } else if (role === "cloudbreak-distant-mesa-cap") {
      material.color.set("#d8bd88");
      material.roughness = 0.88;
    } else {
      material.roughness = Math.max(0.84, material.roughness);
    }
    material.needsUpdate = true;
    return material;
  }

  function prepareShell(source: Object3D): Group {
    const clone = source.clone(true) as Group;
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const role = String(child.userData.tka_role ?? "");
      const element = String(child.userData.tka_element ?? "");
      child.material = Array.isArray(child.material)
        ? child.material.map((material) =>
            gradeShellMaterial(material, role, element)
          )
        : gradeShellMaterial(child.material, role, element);
      if (!shellLimestone && role === "cloudbreak-landmass") {
        const material = Array.isArray(child.material)
          ? child.material.find(
              (candidate) => candidate instanceof MeshStandardMaterial
            )
          : child.material;
        if (material instanceof MeshStandardMaterial) shellLimestone = material;
      }
      child.receiveShadow = role !== "cloudbreak-waterfall";
      child.castShadow =
        role !== "cloudbreak-waterfall" &&
        role !== "cloudbreak-weathered-surface";
    });
    applyShellVisibility(clone);
    return clone;
  }

  function handleAssetReady(id: string): void {
    if (!readyAssetIds.includes(id)) readyAssetIds = [...readyAssetIds, id];
    onAssetReady?.(id);
  }

  $effect(() => {
    if (!$shellGltf?.scene || shell) return;
    shell = prepareShell($shellGltf.scene);
  });

  $effect(() => {
    if (!shell) return;
    applyShellVisibility(shell);
  });

  $effect(() => {
    if (!shell) return;
    const requiredIds = placements.map(({ asset }) => asset.id);
    if (!requiredIds.every((id) => readyAssetIds.includes(id))) return;
    if (renderer.current && camera.current && scene.current) {
      renderer.current.compile(scene.current, camera.current);
    }
    if (!reportedReady) {
      reportedReady = true;
      onReady?.();
    }
  });

  onDestroy(() => {
    for (const material of shellMaterials) material.dispose();
    shellMaterials.clear();
  });
</script>

<T.Group position.y={groundY}>
  {#if shell}
    <T.Group scale.x={-1} scale.z={-1}>
      <T is={shell} />
    </T.Group>
  {/if}

  {#if fullAssembly}
    <CloudbreakSpatialStudy planMode={view === "plan"} />
    <CloudbreakLagoonEdge
      outline={CLOUDBREAK_LAGOON.outline}
      surfaceY={CLOUDBREAK_LAYOUT.lagoon.surfaceY + 0.035}
    />
    <CloudbreakWaterfall
      position={[
        CLOUDBREAK_LAYOUT.lagoon.overflowXZ[0],
        -4.35,
        CLOUDBREAK_LAYOUT.lagoon.overflowXZ[1],
      ]}
      width={3.4}
      height={9.2}
      rotationY={-1.2}
      crestDepth={2.1}
      opacity={1}
      speed={1.08}
      pulse={interactionPulse}
    />
    <CloudbreakWaterfall
      position={[-24, -1.1, -38.5]}
      width={3.2}
      height={15.2}
      opacity={0.68}
      speed={0.76}
      pulse={interactionPulse}
    />
    <CloudbreakWaterfall
      position={[25, -0.1, -45]}
      width={3.9}
      height={18.4}
      opacity={0.66}
      speed={0.68}
      pulse={interactionPulse}
    />
    <CloudbreakWaterfall
      position={[14, 2.9, -64.5]}
      width={2.4}
      height={19.8}
      opacity={0.6}
      speed={0.61}
      pulse={interactionPulse}
    />
  {/if}

  {#each placements as placement (placement.asset.id)}
    <CloudbreakAsset
      asset={placement.asset}
      position={placement.position}
      rotationY={placement.rotationY}
      scaleMultiplier={placement.scaleMultiplier}
      stoneMaterial={shellLimestone}
      onReady={handleAssetReady}
    />
  {/each}
</T.Group>

{#if fullAssembly}
  <ReflectivePool
    width={CLOUDBREAK_LAGOON.size[0]}
    depth={CLOUDBREAK_LAGOON.size[1]}
    position={[
      CLOUDBREAK_LAGOON.center[0],
      groundY + CLOUDBREAK_LAYOUT.lagoon.surfaceY + 0.035,
      CLOUDBREAK_LAGOON.center[1],
    ]}
    outline={CLOUDBREAK_LAGOON_LOCAL_OUTLINE}
    textureWidth={reflectionResolution}
    textureHeight={reflectionResolution}
    deepColor="#286572"
    shallowColor="#6eb0a4"
    reflectionTint={0xc1d5d6}
    sunDirection={CLOUDBREAK_SKY_SUN.direction}
    rippleScale={0.44}
    rippleStrength={0.075}
    foamWidth={0.34}
    foamOpacity={0.32}
    shoreFade={1.45}
    flowSpeed={0.34}
    active={view !== "plan"}
  />
{/if}

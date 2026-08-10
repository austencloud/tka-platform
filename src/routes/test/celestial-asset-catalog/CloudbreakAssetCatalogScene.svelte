<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf, useKtx2, useMeshopt } from "@threlte/extras";
  import {
    Color,
    FogExp2,
    Mesh,
    MeshStandardMaterial,
    type Group,
    type Object3D,
  } from "three";

  import OrbitControls from "$lib/shared/3d/components/OrbitControls.svelte";
  import ReflectivePool from "$lib/shared/3d/environments/primitives/ReflectivePool.svelte";
  import SkyGradient from "$lib/shared/3d/environments/primitives/SkyGradient.svelte";
  import { createDefaultCelestialConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
  import CelestialCloudPanorama from "$lib/shared/3d/environments/scenes/celestial/CelestialCloudPanorama.svelte";

  import CatalogAsset from "./CatalogAsset.svelte";
  import CloudbreakSpatialStudy from "./CloudbreakSpatialStudy.svelte";
  import CloudbreakWaterfall from "./CloudbreakWaterfall.svelte";
  import cloudbreakLayout from "../../../../scripts/seraphic-vault-cloudbreak-layout.json";
  import {
    CLOUDBREAK_ASSET_CATALOG,
    type CloudbreakAssetCandidate,
    type CloudbreakCatalogView,
  } from "./catalog";

  interface Props {
    view: CloudbreakCatalogView;
    onAssetReady?: (id: string) => void;
  }

  interface Placement {
    asset: CloudbreakAssetCandidate;
    position: [number, number, number];
    rotationY: number;
    scaleMultiplier?: number;
  }

  let { view, onAssetReady }: Props = $props();

  const config = createDefaultCelestialConfig();
  const skySun = {
    enabled: true,
    direction: [0, 0.12, -1] as [number, number, number],
    angularDiameterDegrees: 0.68,
    color: "#fff4d2",
    opacity: 0.88,
    glowScale: 13,
    glowOpacity: 0.24,
  };
  const lagoonOutline = cloudbreakLayout.lagoon.outlineXZ as Array<
    [number, number]
  >;
  const lagoonMinX = Math.min(...lagoonOutline.map(([x]) => x));
  const lagoonMaxX = Math.max(...lagoonOutline.map(([x]) => x));
  const lagoonMinZ = Math.min(...lagoonOutline.map(([, z]) => z));
  const lagoonMaxZ = Math.max(...lagoonOutline.map(([, z]) => z));
  const lagoonCenter: [number, number] = [
    (lagoonMinX + lagoonMaxX) / 2,
    (lagoonMinZ + lagoonMaxZ) / 2,
  ];
  const lagoonSize: [number, number] = [
    lagoonMaxX - lagoonMinX,
    lagoonMaxZ - lagoonMinZ,
  ];
  const lagoonLocalOutline = lagoonOutline.map(
    ([x, z]) => [x - lagoonCenter[0], z - lagoonCenter[1]] as [number, number]
  );
  const { scene } = useThrelte();
  const shellGltf = useGltf(
    "/models/celestial/olive-cloudbreak-production-slice.glb?v=asset-catalog-r1",
    {
      meshoptDecoder: useMeshopt(),
      ktx2Loader: useKtx2("/basis/"),
    }
  );
  let shell = $state<Group | null>(null);
  let shellLimestone = $state<MeshStandardMaterial | null>(null);

  const byId = new Map(
    CLOUDBREAK_ASSET_CATALOG.map((asset) => [asset.id, asset])
  );

  function asset(id: string): CloudbreakAssetCandidate {
    const candidate = byId.get(id);
    if (!candidate) throw new Error(`Missing Cloudbreak catalog asset: ${id}`);
    return candidate;
  }

  const placements = $derived.by<Placement[]>(() => {
    if (view === "trees") {
      return [
        {
          asset: asset("olive-west-ancient"),
          position: [-7.5, 0.02, -1],
          rotationY: -0.25,
        },
        {
          asset: asset("olive-east-windswept"),
          position: [0.5, 0.02, -1],
          rotationY: 0.35,
        },
      ];
    }
    if (view === "stone") {
      return [
        {
          asset: asset("coast-rocks-05"),
          position: [-7.4, 0.02, -1],
          rotationY: -0.4,
        },
        {
          asset: asset("sand-rocks-small-01"),
          position: [-1.4, 0.02, -1],
          rotationY: 0.25,
        },
        {
          asset: asset("polyhaven-boulder"),
          position: [4.2, 0.02, -1],
          rotationY: -0.7,
        },
        {
          asset: asset("polyhaven-rock"),
          position: [7.8, 0.02, -1],
          rotationY: 0.55,
          scaleMultiplier: 1.6,
        },
      ];
    }
    if (view === "rear") return [];
    return [
      {
        asset: asset("olive-west-ancient"),
        position: [-9.2, 0.02, -0.5],
        rotationY: -0.28,
      },
      {
        asset: asset("olive-east-windswept"),
        position: [8.2, 0.02, 1.6],
        rotationY: 0.42,
      },
      {
        asset: asset("coast-rocks-05"),
        position: [10.5, 0.02, 5.25],
        rotationY: -0.74,
        scaleMultiplier: 0.72,
      },
      {
        asset: asset("sand-rocks-small-01"),
        position: [11.35, 0.02, -5.25],
        rotationY: 0.38,
        scaleMultiplier: 0.66,
      },
    ];
  });

  const camera = $derived.by(() => {
    if (view === "front") {
      return {
        position: [2.25, 9.2, 42] as [number, number, number],
        target: [2.25, 1, -5] as [number, number, number],
        fov: 64,
      };
    }
    if (view === "rear") {
      const preset = cloudbreakLayout.cameraPresets.reverse;
      return {
        position: preset.position as [number, number, number],
        target: preset.target as [number, number, number],
        fov: 66,
      };
    }
    if (view === "plan") {
      const preset = cloudbreakLayout.cameraPresets.plan;
      return {
        position: preset.position as [number, number, number],
        target: preset.target as [number, number, number],
        fov: preset.fovDegrees,
      };
    }
    return {
      position: [0, 6.7, 31] as [number, number, number],
      target: [0, 2.1, -1] as [number, number, number],
      fov: 54,
    };
  });

  function applyShellVisibility(
    root: Object3D,
    currentView: CloudbreakCatalogView
  ): void {
    const isolatedBench = currentView === "trees" || currentView === "stone";
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
        role === "cloudbreak-lagoon-rim" ||
        role === "cloudbreak-lagoon-water" ||
        role === "cloudbreak-waterfall" ||
        (isolatedBench && isolatedContext)
      );
    });
  }

  function prepareShell(source: Object3D): Group {
    const clone = source.clone(true) as Group;
    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const role = String(child.userData.tka_role ?? "");
      if (
        !shellLimestone &&
        (role === "cloudbreak-landmass" ||
          role === "cloudbreak-weathered-surface")
      ) {
        const material = Array.isArray(child.material)
          ? child.material.find(
              (candidate) => candidate instanceof MeshStandardMaterial
            )
          : child.material;
        if (material instanceof MeshStandardMaterial) {
          shellLimestone = material;
        }
      }
      child.receiveShadow = role !== "cloudbreak-waterfall";
      child.castShadow = false;
    });
    applyShellVisibility(clone, view);
    return clone;
  }

  $effect(() => {
    if (!$shellGltf?.scene || shell) return;
    shell = prepareShell($shellGltf.scene);
  });

  $effect(() => {
    if (!shell) return;
    applyShellVisibility(shell, view);
  });

  $effect(() => {
    if (!scene.current) return;
    scene.current.fog = new FogExp2(config.fog.color, config.fog.density);
    scene.current.background = new Color(config.sky.topColor);
    return () => {
      if (!scene.current) return;
      scene.current.fog = null;
      scene.current.background = null;
    };
  });
</script>

<SkyGradient
  topColor="#83add4"
  midColor="#c8dce8"
  bottomColor="#efc997"
  gradientStart={0.08}
  gradientEnd={0.92}
  sun={skySun}
/>
<!-- The review uses the same authored cloud panorama as CelestialScene, so the
     shelf is judged against the atmosphere people will actually receive. -->
<CelestialCloudPanorama />
{#key view}
  <T.PerspectiveCamera
    makeDefault
    position={camera.position}
    fov={camera.fov}
    near={0.1}
    far={240}
  >
    <OrbitControls
      enableDamping
      smoothTime={0.1}
      draggingSmoothTime={0.06}
      target={camera.target}
      minDistance={view === "plan" ? 48 : 9}
      maxDistance={view === "plan" ? 110 : 64}
      maxPolarAngle={Math.PI / 2 + 0.03}
      rotateSpeed={view === "plan" ? 0 : 0.55}
      zoomSpeed={1.05}
      enablePan={view === "plan"}
    />
  </T.PerspectiveCamera>
{/key}

{#if shell}
  <T.Group scale.x={-1} scale.z={-1}>
    <T is={shell} />
  </T.Group>
{/if}

{#if view === "front" || view === "rear" || view === "plan"}
  <CloudbreakSpatialStudy planMode={view === "plan"} />
  <ReflectivePool
    width={lagoonSize[0]}
    depth={lagoonSize[1]}
    position={[
      lagoonCenter[0],
      cloudbreakLayout.lagoon.surfaceY + 0.055,
      lagoonCenter[1],
    ]}
    outline={lagoonLocalOutline}
    textureWidth={768}
    textureHeight={768}
    deepColor="#397e92"
    shallowColor="#79beb8"
    reflectionTint={0xa7c8d2}
    sunDirection={skySun.direction}
    rippleScale={0.44}
    rippleStrength={0.11}
    foamWidth={0.12}
    foamOpacity={0.08}
    shoreFade={0.72}
    flowSpeed={0.42}
    active={view !== "plan"}
  />
  <CloudbreakWaterfall
    position={[15.5, -4.45, -2.5]}
    width={2.7}
    height={9.3}
    rotationY={-0.08}
    crestDepth={1.25}
    opacity={0.92}
    speed={1.15}
  />
  <CloudbreakWaterfall
    position={[-26.1, -1.1, -44.1]}
    width={3.2}
    height={15.2}
    opacity={0.72}
    speed={0.76}
  />
  <CloudbreakWaterfall
    position={[22.5, -0.1, -51.4]}
    width={3.9}
    height={18.4}
    opacity={0.7}
    speed={0.68}
  />
  <CloudbreakWaterfall
    position={[12.4, 2.9, -69.8]}
    width={2.8}
    height={19.8}
    opacity={0.62}
    speed={0.61}
  />
{/if}

{#each placements as placement (placement.asset.id)}
  <CatalogAsset
    asset={placement.asset}
    position={placement.position}
    rotationY={placement.rotationY}
    scaleMultiplier={placement.scaleMultiplier}
    stoneMaterial={shellLimestone}
    onReady={onAssetReady}
  />
{/each}

<T.HemisphereLight
  color={config.hemisphereLight.skyColor}
  groundColor={config.hemisphereLight.groundColor}
  intensity={config.hemisphereLight.intensity}
/>
<T.DirectionalLight
  color="#fff0d2"
  intensity={2.2}
  position={[0, 22, -96]}
  castShadow
  shadow.mapSize.width={1536}
  shadow.mapSize.height={1536}
  shadow.camera.near={1}
  shadow.camera.far={100}
  shadow.camera.left={-24}
  shadow.camera.right={24}
  shadow.camera.top={20}
  shadow.camera.bottom={-20}
  shadow.bias={-0.0006}
  shadow.normalBias={0.04}
  shadow.radius={3}
/>
<T.DirectionalLight color="#b9d1e9" intensity={0.38} position={[-18, 12, 20]} />

<script lang="ts">
  /**
   * WinterScene
   *
   * A winter forest clearing with falling snow, a frozen pond (real mirror
   * reflector on an organic-outlined ice plane), and a warm campfire
   * throwing steam against cold air. Evergreen pines are the Kenney
   * Nature Kit pine set (CC0), dusted cool-white to read as snow-covered.
   *
   * Production callers get the baked defaults; the Scene Lab drives every
   * knob via the `config` prop.
   */

  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onDestroy, onMount, untrack } from "svelte";
  import { disposeSceneGraph } from "../utils/dispose-scene";
  import {
    Vector3,
    FogExp2,
    Color,
    Shape,
    ShapeGeometry,
    type Material,
    type MeshStandardMaterial,
  } from "three";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import {
    type WinterSceneConfig,
    createDefaultWinterConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import IcePlatform from "./winter/IcePlatform.svelte";

  interface Props {
    /** Optional scene config. Defaults to the baked winter look. */
    config?: WinterSceneConfig;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { config, stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const baseConfig = $derived(config ?? createDefaultWinterConfig());

  const activeConfig = $derived.by(() => {
    const neededRadius = Math.max(stageWidth, stageDepth) / 2;
    const r = Math.max(baseConfig.platform.radius, neededRadius);
    if (r <= baseConfig.platform.radius) return baseConfig;
    return {
      ...baseConfig,
      platform: { ...baseConfig.platform, radius: r },
    };
  });

  // Kenney Nature Kit pines (CC0). Evergreen silhouettes + cool tint = snowy forest.
  const pineTallA = useGltf("/models/winter/tree_pineTallA.glb");
  const pineTallC = useGltf("/models/winter/tree_pineTallC.glb");
  const pineDefault = useGltf("/models/winter/tree_pineDefaultA.glb");
  const pineRound = useGltf("/models/winter/tree_pineRoundB.glb");
  const pineSmall = useGltf("/models/winter/tree_pineSmallA.glb");
  const rockA = useGltf("/models/winter/rock_largeA.glb");
  const rockB = useGltf("/models/winter/rock_largeB.glb");
  const logModel = useGltf("/models/winter/log.glb");
  const logLarge = useGltf("/models/winter/log_large.glb");

  const campfire = useGltf("/models/camping/campfire-pit.glb");

  const { scene } = useThrelte();

  // -----------------------------------------------------------------
  // Frozen pond - organic Shape with a Three.js Reflector for true
  // mirror reflections. Not a perfect mirror: the color parameter
  // tints the reflection toward pale ice-blue.
  // -----------------------------------------------------------------
  function createOrganicPondShape(
    radius: number,
    irregularity: number,
    seed: number
  ): Shape {
    const shape = new Shape();
    const pointCount = 14;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const noise =
        Math.sin(i * 2.7 + seed) * irregularity +
        Math.cos(i * 1.9 + seed * 1.3) * irregularity * 0.5;
      const r = radius * (1 + noise);
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    shape.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 0; i < pointCount; i++) {
      const p = pts[i]!;
      const pNext = pts[(i + 1) % pointCount]!;
      const pPrev = pts[(i - 1 + pointCount) % pointCount]!;
      const pPlus = pts[(i + 2) % pointCount]!;
      // Catmull-Rom tangents → cubic Bezier controls (keeps shape smooth + closed)
      const c1 = {
        x: p.x + (pNext.x - pPrev.x) / 6,
        y: p.y + (pNext.y - pPrev.y) / 6,
      };
      const c2 = {
        x: pNext.x - (pPlus.x - p.x) / 6,
        y: pNext.y - (pPlus.y - p.y) / 6,
      };
      shape.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, pNext.x, pNext.y);
    }
    return shape;
  }

  let pondReflector = $state<Reflector | null>(null);

  $effect(() => {
    // Track only the pond config - reading pondReflector here would cause
    // a read→write cycle and trip Svelte's effect_update_depth guard.
    const pond = activeConfig.pond;
    if (!pond?.enabled) {
      untrack(() => {
        const old = pondReflector;
        if (old) {
          old.geometry.dispose();
          (old.material as Material).dispose();
        }
        pondReflector = null;
      });
      return;
    }

    const shape = createOrganicPondShape(
      pond.radius,
      0.28,
      pond.position.x * 0.7 + pond.position.z * 1.3
    );
    const geom = new ShapeGeometry(shape, 96);
    const next = new Reflector(geom, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: new Color(pond.color),
    });
    next.rotateX(-Math.PI / 2);

    untrack(() => {
      const old = pondReflector;
      if (old) {
        old.geometry.dispose();
        (old.material as Material).dispose();
      }
      pondReflector = next;
    });

    return () => {
      next.geometry.dispose();
      (next.material as Material).dispose();
    };
  });

  // Snow-tint: cool-shift cloned materials so the forest reads as snow-covered
  // at distance. A mild blend keeps the pine needles green-ish while frosting
  // them toward pale-blue - closer to "dusted with snow" than "painted white".
  function tintSnowy(root: { traverse: (cb: (obj: unknown) => void) => void }) {
    root.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const clone = (mat as MeshStandardMaterial).clone();
        if (clone.color) {
          clone.color.lerp(new Color("#e2ecf4"), 0.35);
        }
        return clone;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? cloned
        : cloned[0];
    });
  }

  function snowyClone(sourceScene: {
    clone: () => { traverse: (cb: (obj: unknown) => void) => void };
  }) {
    const cloned = sourceScene.clone();
    tintSnowy(cloned);
    return cloned;
  }

  // Tree placements
  const treePlacements = $derived.by(() => {
    return activeConfig.treeRings.flatMap((ring, ringIndex) =>
      Array.from({ length: ring.count }, (_, i) => {
        const angleOffset = ringIndex * 0.4;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;
        const seed = ringIndex * 100 + i;
        const radiusVariation =
          ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;
        const scale =
          ring.scaleBase + Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);
        const rotation = angle + Math.PI + Math.sin(seed * 1.7) * 0.3;
        return [x, z, scale, rotation] as [number, number, number, number];
      })
    );
  });

  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.clearingRadius;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.2;
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.3 + Math.abs(Math.sin(i * 3.2) * 0.25);
      const rotation = Math.sin(i * 2.8) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  // Hand-placed so none intersect the pond (pond default at (-6, 5), r ≈ 4.5)
  const fallenLogPlacements: [number, number, number, number, boolean][] = [
    [7.0, 4.0, 2.0, Math.PI * 0.3, true],
    [-1.5, 9.0, 1.6, Math.PI * 0.7, true],
    [4.5, -6.5, 1.5, Math.PI * 1.2, false],
    [11.0, 2.0, 1.5, Math.PI * 0.5, true],
    [-10.0, -6.0, 1.4, Math.PI * 1.4, false],
  ];

  const groundY = $derived(userProportionsState.groundY);

  const firePosition = $derived.by(() => {
    const cf = activeConfig.campfire;
    if (!cf) return new Vector3(0, groundY, 0);
    const fireHalfHeight = (cf.fireHeight * cf.fireScale) / 2;
    return new Vector3(cf.position.x, groundY + fireHalfHeight, cf.position.z);
  });

  // ── Clone caching — clone + tint once per GLB load, not per render ───

  const treeClones = $derived.by(() => {
    if (!$pineTallA || !$pineTallC || !$pineDefault || !$pineRound || !$pineSmall) return [];
    const variants = [$pineTallA, $pineTallC, $pineDefault, $pineRound, $pineSmall];
    return treePlacements.map((_, i) => snowyClone(variants[i % variants.length]!.scene));
  });

  const rockClones = $derived.by(() => {
    if (!$rockA || !$rockB) return [];
    return rockPlacements.map((_, i) => snowyClone((i % 2 === 0 ? $rockA : $rockB)!.scene));
  });

  const logClones = $derived.by(() => {
    if (!$logModel || !$logLarge) return [];
    return fallenLogPlacements.map(([, , , , isLarge]) =>
      snowyClone((isLarge ? $logLarge : $logModel)!.scene)
    );
  });

  const campfireClone = $derived($campfire ? $campfire.scene.clone() : null);

  onDestroy(() => {
    for (const c of treeClones) disposeSceneGraph(c as import("three").Object3D);
    for (const c of rockClones) disposeSceneGraph(c as import("three").Object3D);
    for (const c of logClones) disposeSceneGraph(c as import("three").Object3D);
    if (campfireClone) disposeSceneGraph(campfireClone as import("three").Object3D);
  });

  let fogInstance: FogExp2 | null = null;
  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    if (!fogInstance) {
      fogInstance = new FogExp2(fog.color, fog.density);
      scene.current.fog = fogInstance;
    } else {
      fogInstance.color.set(fog.color);
      fogInstance.density = fog.density;
    }
    return () => {
      if (scene.current) scene.current.fog = null;
      fogInstance = null;
    };
  });

  const sceneFeatures = getSceneFeatureContext();
  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$pineTallA, $pineTallC, $pineDefault, $pineRound, $pineSmall, $rockA, $rockB, $logModel, $logLarge, $campfire];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      sceneFeatures.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[WinterScene] GLB loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

{#if activeConfig.ground.textured && activeConfig.ground.diffuseMap}
  <TexturedGroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    diffuseMap={activeConfig.ground.diffuseMap}
    normalMap={activeConfig.ground.normalMap}
    roughnessMap={activeConfig.ground.roughnessMap}
    normalScale={activeConfig.ground.normalScale ?? 1.0}
    textureRepeat={activeConfig.ground.textureRepeat ?? 8}
  />
{:else}
  <GroundPlane
    color={activeConfig.ground.color}
    size={activeConfig.ground.size}
    opacity={activeConfig.ground.opacity ?? 1}
  />
{/if}

<!-- Frozen pond: organic Shape with Three.js Reflector for real mirror reflection.
     Color tint is baked into the Reflector itself - no overlay needed, and
     removing it means the reflection is visible from every angle. -->
{#if activeConfig.pond?.enabled && pondReflector}
  <T
    is={pondReflector}
    position.x={activeConfig.pond.position.x}
    position.y={groundY + 0.01}
    position.z={activeConfig.pond.position.z}
  />
{/if}

<!-- Falling snow - #key forces remount when count changes (GPU buffers
     are sized to count at mount). Other props update reactively. -->
{#key activeConfig.snow.count}
  <FallingParticles
    type={activeConfig.snow.type}
    count={activeConfig.snow.count}
    area={activeConfig.snow.area}
    speed={activeConfig.snow.speed}
    colors={activeConfig.snow.colors}
    sizeRange={activeConfig.snow.sizeRange}
    spin={activeConfig.snow.spin}
  />
{/key}

{#each treeClones as clone, i}
  {@const [x, z, scale, rotY] = treePlacements[i] ?? [0, 0, 1, 0]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} scale={scale * 2.4} rotation.y={rotY} />
{/each}

{#each rockClones as clone, i}
  {@const [x, z, scale, rotY] = rockPlacements[i] ?? [0, 0, 1, 0]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} scale={scale * 2.2} rotation.y={rotY} />
{/each}

{#each logClones as clone, i}
  {@const [x, z, scale, rotY] = fallenLogPlacements[i] ?? [0, 0, 1, 0, true]}
  <T is={clone} position.x={x} position.y={groundY} position.z={z} scale={scale * 0.55} rotation.y={rotY} />
{/each}

{#if activeConfig.campfire?.enabled && campfireClone}
  {@const cf = activeConfig.campfire}
  <T
    is={campfireClone}
    position.x={cf.position.x}
    position.y={groundY}
    position.z={cf.position.z}
    scale={cf.modelScale}
  />
  <VolumetricFireComponent
    position={firePosition}
    width={1.0}
    height={cf.fireHeight}
    depth={1.0}
    scale={cf.fireScale}
    sliceSpacing={0.15}
  />
  <T.PointLight
    position.x={cf.position.x}
    position.y={groundY + cf.primaryLight.heightOffset}
    position.z={cf.position.z}
    color={cf.primaryLight.color}
    intensity={cf.primaryLight.intensity}
    distance={cf.primaryLight.distance}
    decay={cf.primaryLight.decay}
  />
  <T.PointLight
    position.x={cf.position.x}
    position.y={groundY + cf.fillLight.heightOffset}
    position.z={cf.position.z}
    color={cf.fillLight.color}
    intensity={cf.fillLight.intensity}
    distance={cf.fillLight.distance}
    decay={cf.fillLight.decay}
  />
  <!-- Steam plume - wider and wispier than smoke, as heat meets cold air -->
  <T.Group
    position.x={cf.position.x}
    position.y={groundY + (cf.fireHeight * cf.fireScale) / 2 + 0.4}
    position.z={cf.position.z}
  >
    {#key cf.smokeCount}
      <FallingParticles
        type="steam"
        count={cf.smokeCount}
        area={{ width: 1.8, height: 5, depth: 1.8 }}
        speed={0.08}
        colors={cf.smokeColors}
        sizeRange={[0.25, 0.6]}
        spin={false}
      />
    {/key}
  </T.Group>
{/if}

<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

{#if activeConfig.moonLight?.enabled}
  {@const m = activeConfig.moonLight}
  <T.DirectionalLight
    color={m.color}
    intensity={m.intensity}
    position.x={m.position[0]}
    position.y={m.position[1]}
    position.z={m.position[2]}
  />
{/if}

<IcePlatform config={activeConfig.platform} />

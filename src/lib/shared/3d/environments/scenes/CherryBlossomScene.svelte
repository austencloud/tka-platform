<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { untrack } from "svelte";
  import {
    FogExp2,
    Color,
    Shape,
    ShapeGeometry,
    type Material,
  } from "three";
  import { Reflector } from "three/examples/jsm/objects/Reflector.js";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import ProceduralCherryTree from "./cherry-blossom/ProceduralCherryTree.svelte";
  import ProceduralGround from "./cherry-blossom/ProceduralGround.svelte";
  import StoneLantern from "./cherry-blossom/StoneLantern.svelte";
  import WoodenBridge from "./cherry-blossom/WoodenBridge.svelte";
  import GrassTufts from "./cherry-blossom/GrassTufts.svelte";
  import LilyPads from "./cherry-blossom/LilyPads.svelte";
  import {
    type CherryBlossomSceneConfig,
    createDefaultCherryBlossomConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";
  import EngawaPlatform from "./cherry-blossom/EngawaPlatform.svelte";

  interface Props {
    config?: CherryBlossomSceneConfig;
  }

  let { config }: Props = $props();

  const activeConfig = $derived(config ?? createDefaultCherryBlossomConfig());

  const { scene } = useThrelte();

  const sceneFeatures = getSceneFeatureContext();

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
          ring.scaleBase +
          Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);
        const rotation = angle + Math.PI + Math.sin(seed * 1.7) * 0.3;
        return { x, z, scale, rotation, seed } as {
          x: number;
          z: number;
          scale: number;
          rotation: number;
          seed: number;
        };
      })
    );
  });

  const groundY = $derived(userProportionsState.groundY);

  // Reflective pond — organic Catmull-Rom shape
  function createOrganicPondShape(
    radius: number,
    irregularity: number,
    seed: number
  ): Shape {
    const shape = new Shape();
    const n = 14;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const noise =
        Math.sin(i * 2.7 + seed) * irregularity +
        Math.cos(i * 1.9 + seed * 1.3) * irregularity * 0.5;
      const r = radius * (1 + noise);
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    shape.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      const pNext = pts[(i + 1) % n]!;
      const pPrev = pts[(i - 1 + n) % n]!;
      const pPlus = pts[(i + 2) % n]!;
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

  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // Procedural scene — no GLBs to wait for
  $effect(() => {
    sceneFeatures?.reportReady("environment");
  });
</script>

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<ProceduralGround
  size={activeConfig.ground.size}
  baseColor={activeConfig.ground.color}
/>

<!-- Fallen petal layer — subtle pink wash over the ground -->
<T.Group position={[0, groundY + 0.005, 0]}>
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[20, 64]} />
    <T.MeshStandardMaterial
      color="#ffb7c5"
      opacity={0.08}
      transparent
      roughness={1}
      depthWrite={false}
    />
  </T.Mesh>
</T.Group>

<!-- Reflective pond — catches the pink light -->
{#if activeConfig.pond?.enabled && pondReflector}
  <T
    is={pondReflector}
    position.x={activeConfig.pond.position.x}
    position.y={groundY + 0.01}
    position.z={activeConfig.pond.position.z}
  />
{/if}

<!-- Procedural cherry trees — pink emissive canopies, dark trunks -->
{#each treePlacements as tree}
  <T.Group
    position.x={tree.x}
    position.y={groundY}
    position.z={tree.z}
    scale={tree.scale}
    rotation.y={tree.rotation}
  >
    <ProceduralCherryTree seed={tree.seed} />
  </T.Group>
{/each}

<!-- Dense cherry blossom petals — close layer -->
{#key activeConfig.petals.count}
  <FallingParticles
    type={activeConfig.petals.type}
    count={activeConfig.petals.count}
    area={activeConfig.petals.area}
    speed={activeConfig.petals.speed}
    colors={activeConfig.petals.colors}
    sizeRange={activeConfig.petals.sizeRange}
    spin={activeConfig.petals.spin}
  />
{/key}

<!-- Distant petals — smaller, slower, wider for depth -->
{#if activeConfig.distantPetals}
  {#key activeConfig.distantPetals.count}
    <FallingParticles
      type={activeConfig.distantPetals.type}
      count={activeConfig.distantPetals.count}
      area={activeConfig.distantPetals.area}
      speed={activeConfig.distantPetals.speed}
      colors={activeConfig.distantPetals.colors}
      sizeRange={activeConfig.distantPetals.sizeRange}
      spin={activeConfig.distantPetals.spin}
    />
  {/key}
{/if}

<!-- Fireflies — twilight warmth -->
{#if activeConfig.fireflies}
  {#key activeConfig.fireflies.count}
    <FallingParticles
      type={activeConfig.fireflies.type}
      count={activeConfig.fireflies.count}
      area={activeConfig.fireflies.area}
      speed={activeConfig.fireflies.speed}
      colors={activeConfig.fireflies.colors}
      sizeRange={activeConfig.fireflies.sizeRange}
      spin={activeConfig.fireflies.spin}
    />
  {/key}
{/if}

<!-- Two stone lanterns — intentionally placed for composition -->
{#each activeConfig.lanterns as lantern}
  <StoneLantern
    position={lantern.position}
    scale={lantern.scale}
    lightColor={lantern.lightColor}
    lightIntensity={lantern.lightIntensity}
    lightDistance={lantern.lightDistance}
  />
{/each}

<!-- Stepping stones — flat discs along a path -->
{#each activeConfig.steppingStones as stone}
  <T.Group position.x={stone.x} position.y={groundY + 0.02} position.z={stone.z}>
    <T.Mesh rotation.y={stone.rotationY}>
      <T.CylinderGeometry args={[stone.radius, stone.radius, 0.03, 8]} />
      <T.MeshStandardMaterial color="#3a3530" roughness={0.95} />
    </T.Mesh>
  </T.Group>
{/each}

<!-- Arched wooden bridge spanning across the pond -->
{#if activeConfig.pond?.enabled}
  <WoodenBridge
    position={activeConfig.pond.position}
    rotationY={Math.PI * 0.3}
    scale={0.9}
    length={activeConfig.pond.radius * 1.8}
  />
{/if}

<!-- Lily pads on the pond surface -->
{#if activeConfig.pond?.enabled}
  <LilyPads
    pondPosition={activeConfig.pond.position}
    pondRadius={activeConfig.pond.radius}
  />
{/if}

<!-- Ground cover — scattered moss/grass tufts -->
<GrassTufts />

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

<EngawaPlatform config={activeConfig.platform} />

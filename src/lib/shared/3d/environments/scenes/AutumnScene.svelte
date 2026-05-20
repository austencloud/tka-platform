<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { FogExp2 } from "three";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import AutumnForest from "./autumn/AutumnForest.svelte";
  import AutumnGround from "./autumn/AutumnGround.svelte";
  import WoodlandStream from "./autumn/WoodlandStream.svelte";
  import MushroomCluster from "./autumn/MushroomCluster.svelte";
  import GroundMist from "./autumn/GroundMist.svelte";
  import {
    type AutumnSceneConfig,
    createDefaultAutumnConfig,
  } from "../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    config?: AutumnSceneConfig;
  }

  let { config }: Props = $props();

  const activeConfig = $derived(config ?? createDefaultAutumnConfig());

  const { scene, renderer, camera } = useThrelte();

  const sceneFeatures = getSceneFeatureContext();

  function cubicBez(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const mt = 1 - t;
    return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
  }

  function isNearStream(px: number, pz: number, margin: number): boolean {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      let sx: number, sz: number;
      if (t < 0.5) {
        const u = t * 2;
        sx = cubicBez(-15, -8, -3, 0, u);
        sz = cubicBez(-5, -3, 3, 4, u);
      } else {
        const u = (t - 0.5) * 2;
        sx = cubicBez(0, 3, 8, 15, u);
        sz = cubicBez(4, 5, 2, 8, u);
      }
      const dx = px - sx, dz = pz - sz;
      if (dx * dx + dz * dz < margin * margin) return true;
    }
    return false;
  }

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
        return { x, z, scale, rotation, seed };
      })
    ).filter(t => !isNearStream(t.x, t.z, 2.0));
  });

  const groundY = $derived(userProportionsState.groundY);

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

  $effect(() => {
    if (!scene.current || !renderer.current || !camera.current) return;

    renderer.current.compile(scene.current, camera.current);
    sceneFeatures?.reportReady("environment");
  });
</script>

<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<AutumnGround
  size={activeConfig.ground.size}
  baseColor={activeConfig.ground.color}
/>

<!-- Fallen leaf wash on ground — warm amber tint -->
<T.Group position={[0, groundY + 0.005, 0]}>
  <T.Mesh rotation.x={-Math.PI / 2}>
    <T.CircleGeometry args={[20, 64]} />
    <T.MeshStandardMaterial
      color="#c88040"
      opacity={0.06}
      transparent
      roughness={1}
      depthWrite={false}
    />
  </T.Mesh>
</T.Group>

<!-- Reflective winding stream -->
{#if activeConfig.stream.enabled}
  <WoodlandStream
    color={activeConfig.stream.color}
    width={activeConfig.stream.width}
  />
{/if}

<!-- Batched procedural trees (InstancedMesh) -->
<AutumnForest placements={treePlacements} {groundY} />

<!-- Dense falling leaves — close layer -->
{#key activeConfig.leaves.count}
  <FallingParticles
    type={activeConfig.leaves.type}
    count={activeConfig.leaves.count}
    area={activeConfig.leaves.area}
    speed={activeConfig.leaves.speed}
    colors={activeConfig.leaves.colors}
    sizeRange={activeConfig.leaves.sizeRange}
    spin={activeConfig.leaves.spin}
  />
{/key}

<!-- Distant leaves — smaller, slower, wider for depth -->
{#if activeConfig.distantLeaves}
  {#key activeConfig.distantLeaves.count}
    <FallingParticles
      type={activeConfig.distantLeaves.type}
      count={activeConfig.distantLeaves.count}
      area={activeConfig.distantLeaves.area}
      speed={activeConfig.distantLeaves.speed}
      colors={activeConfig.distantLeaves.colors}
      sizeRange={activeConfig.distantLeaves.sizeRange}
      spin={activeConfig.distantLeaves.spin}
    />
  {/key}
{/if}

<!-- Mushroom clusters around clearing -->
{#if activeConfig.mushrooms.enabled}
  <MushroomCluster
    count={activeConfig.mushrooms.count}
    ringRadius={activeConfig.mushrooms.ringRadius}
    capColors={activeConfig.mushrooms.capColors}
    stemColor={activeConfig.mushrooms.stemColor}
    glowColor={activeConfig.mushrooms.glowColor}
    glowIntensity={activeConfig.mushrooms.glowIntensity}
  />
{/if}

<!-- Low-lying ground mist -->
{#if activeConfig.mist.enabled}
  <GroundMist
    count={activeConfig.mist.count}
    area={activeConfig.mist.area}
    color={activeConfig.mist.color}
    opacity={activeConfig.mist.opacity}
    speed={activeConfig.mist.speed}
  />
{/if}

<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

<!-- Golden-hour directional sunlight — low angle for warm rim lighting -->
{#if activeConfig.sunLight?.enabled}
  {@const sl = activeConfig.sunLight}
  <T.DirectionalLight
    color={sl.color}
    intensity={sl.intensity}
    position.x={sl.position[0]}
    position.y={sl.position[1]}
    position.z={sl.position[2]}
  />
{/if}

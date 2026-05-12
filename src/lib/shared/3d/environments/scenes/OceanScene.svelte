<script lang="ts">
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import GroundPlane from "../primitives/GroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import type { OceanVariant } from "../domain/enums/environment-enums";
  import {
    type OceanSceneConfig,
    createDefaultOceanDeepConfig,
    createDefaultOceanReefConfig,
  } from "../domain/models/scene-configs";
  import { onMount } from "svelte";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import { FogExp2, Color } from "three";
  import { getSceneFeatureContext } from "../../scene-features/context/scene-feature-context";

  interface Props {
    variant?: OceanVariant;
    config?: OceanSceneConfig;
  }

  let { variant = "deep", config }: Props = $props();

  const activeConfig = $derived(
    config ??
      (variant === "reef"
        ? createDefaultOceanReefConfig()
        : createDefaultOceanDeepConfig())
  );

  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

  const coralBrain = useGltf(`${R2_CDN}/models/ocean/coral_brain.glb`);
  const coralFan = useGltf(`${R2_CDN}/models/ocean/coral_fan.glb`);
  const coralTube = useGltf(`${R2_CDN}/models/ocean/coral_tube.glb`);
  const kelpTall = useGltf(`${R2_CDN}/models/ocean/kelp_tall.glb`);
  const kelpShort = useGltf(`${R2_CDN}/models/ocean/kelp_short.glb`);
  const jellyfishModel = useGltf(`${R2_CDN}/models/ocean/jellyfish_a.glb`);

  const rockA = useGltf(`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`);
  const rockB = useGltf(`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`);

  const { scene } = useThrelte();

  let sceneFeatures = $state<ReturnType<typeof getSceneFeatureContext> | null>(null);
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May render outside scene feature system
  }

  const groundY = $derived(userProportionsState.groundY);

  // ---- Placements (reactive from config) ----

  const coralPlacements = $derived.by(() => {
    const { count, clearingRadius } = activeConfig.coral;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.3;
      const radius = clearingRadius - 1.5 + Math.sin(i * 3.7) * 1.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.6 + Math.abs(Math.sin(i * 2.3) * 0.4);
      const rotation = Math.sin(i * 1.7) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    });
  });

  const kelpPlacements = $derived.by(() => {
    return activeConfig.kelp.rings.flatMap((ring, ringIndex) =>
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
        return [x, z, scale, rotation, seed] as [number, number, number, number, number];
      })
    );
  });

  const rockPlacements = $derived.by(() => {
    const count = activeConfig.rockCount;
    const clearingRadius = activeConfig.kelp.clearingRadius;
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

  const jellyfishPlacements = $derived.by(() => {
    const jf = activeConfig.jellyfish;
    if (!jf?.enabled) return [];
    return Array.from({ length: jf.count }, (_, i) => {
      const angle = (i / jf.count) * Math.PI * 2 + 0.5;
      const radius = jf.spawnRadius * (0.5 + Math.sin(i * 2.7) * 0.3);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = jf.heightRange[0] + (jf.heightRange[1] - jf.heightRange[0]) * ((i + 0.5) / jf.count);
      return { x, y, z, seed: i * 37 };
    });
  });

  // ---- Underwater tint (like Winter's tintSnowy) ----
  function tintUnderwater(root: { traverse: (cb: (obj: unknown) => void) => void }, color: string, blend: number) {
    const tintColor = new Color(color);
    root.traverse((obj) => {
      const m = obj as { isMesh?: boolean; material?: unknown };
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const cloned = mats.map((mat) => {
        const clone = (mat as import("three").MeshStandardMaterial).clone();
        if (clone.color) clone.color.lerp(tintColor, blend);
        if (clone.emissive) clone.emissive.lerp(tintColor, blend * 0.5);
        return clone;
      });
      (m as { material: unknown }).material = Array.isArray(m.material)
        ? cloned
        : cloned[0];
    });
  }

  function underwaterClone(
    sourceScene: { clone: () => { traverse: (cb: (obj: unknown) => void) => void } },
    color: string,
    blend: number,
  ) {
    const cloned = sourceScene.clone();
    tintUnderwater(cloned, color, blend);
    return cloned;
  }

  // ---- Fog ----
  $effect(() => {
    if (!scene.current) return;
    const fog = activeConfig.fog;
    scene.current.fog = new FogExp2(new Color(fog.color), fog.density);
    return () => {
      if (scene.current) scene.current.fog = null;
    };
  });

  // ---- Loading progress ----
  $effect(() => {
    if (!sceneFeatures) return;
    const glbs = [$coralBrain, $coralFan, $coralTube, $kelpTall, $kelpShort, $jellyfishModel, $rockA, $rockB];
    const loaded = glbs.filter(Boolean).length;
    sceneFeatures.reportProgress("environment", loaded / glbs.length);
    if (loaded === glbs.length) {
      sceneFeatures.reportReady("environment");
    }
  });

  onMount(() => {
    const timer = setTimeout(() => {
      if (sceneFeatures && !sceneFeatures.isReady("environment")) {
        console.warn("[OceanScene] GLB loading timed out - lifting curtain");
        sceneFeatures.reportReady("environment");
      }
    }, 15_000);
    return () => clearTimeout(timer);
  });
</script>

<!-- Sky gradient -->
<SkyGradient
  topColor={activeConfig.sky.topColor}
  midColor={activeConfig.sky.midColor}
  bottomColor={activeConfig.sky.bottomColor}
/>

<!-- Ocean floor -->
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

<!-- Bubbles -->
{#key `bubbles|${activeConfig.bubbles.count}|${activeConfig.bubbles.sizeRange[0]}|${activeConfig.bubbles.area.width}|${activeConfig.bubbles.speed}`}
  <FallingParticles
    type={activeConfig.bubbles.type}
    count={activeConfig.bubbles.count}
    area={activeConfig.bubbles.area}
    speed={activeConfig.bubbles.speed}
    colors={activeConfig.bubbles.colors}
    sizeRange={activeConfig.bubbles.sizeRange}
    spin={activeConfig.bubbles.spin}
  />
{/key}

<!-- Dust motes -->
{#if activeConfig.dust}
  {#key `dust|${activeConfig.dust.count}|${activeConfig.dust.sizeRange[0]}|${activeConfig.dust.area.width}|${activeConfig.dust.speed}`}
    <FallingParticles
      type={activeConfig.dust.type}
      count={activeConfig.dust.count}
      area={activeConfig.dust.area}
      speed={activeConfig.dust.speed}
      colors={activeConfig.dust.colors}
      sizeRange={activeConfig.dust.sizeRange}
      spin={activeConfig.dust.spin}
    />
  {/key}
{/if}

<!-- Bioluminescent plankton -->
{#if activeConfig.plankton}
  {#key `plankton|${activeConfig.plankton.count}|${activeConfig.plankton.sizeRange[0]}|${activeConfig.plankton.area.width}`}
    <FallingParticles
      type={activeConfig.plankton.type}
      count={activeConfig.plankton.count}
      area={activeConfig.plankton.area}
      speed={activeConfig.plankton.speed}
      colors={activeConfig.plankton.colors}
      sizeRange={activeConfig.plankton.sizeRange}
      spin={activeConfig.plankton.spin}
    />
  {/key}
{/if}

<!-- Coral formations -->
{#if activeConfig.coral.enabled && $coralBrain && $coralFan && $coralTube}
  {#each coralPlacements as [x, z, scale, rotY], i}
    {@const coralModels = [$coralBrain, $coralFan, $coralTube]}
    {@const source = coralModels[i % coralModels.length]!}
    <T
      is={underwaterClone(source.scene, activeConfig.coral.glowColor, activeConfig.coral.glowBlend)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Kelp forest -->
{#if activeConfig.kelp.enabled && $kelpTall && $kelpShort}
  {#each kelpPlacements as [x, z, scale, rotY, seed], i}
    {@const source = i % 2 === 0 ? $kelpTall : $kelpShort}
    <T
      is={underwaterClone(source.scene, "#0d3a1a", 0.2)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Seabed rocks -->
{#if $rockA && $rockB}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const source = i % 2 === 0 ? $rockA : $rockB}
    <T
      is={underwaterClone(source.scene, activeConfig.rockTintColor, activeConfig.rockTintBlend)}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Jellyfish with point lights -->
{#if activeConfig.jellyfish?.enabled && $jellyfishModel}
  {#each jellyfishPlacements as jf}
    <T.Group position.x={jf.x} position.y={groundY + jf.y} position.z={jf.z}>
      <T
        is={underwaterClone($jellyfishModel.scene, activeConfig.jellyfish.glowColor, 0.4)}
        scale={0.5}
      />
      <T.PointLight
        color={activeConfig.jellyfish.glowColor}
        intensity={activeConfig.jellyfish.lightIntensity}
        distance={activeConfig.jellyfish.lightDistance}
        decay={2}
      />
    </T.Group>
  {/each}
{/if}

<!-- God rays (directional light from above) -->
{#if activeConfig.godRays?.enabled}
  <T.DirectionalLight
    color={activeConfig.godRays.color}
    intensity={activeConfig.godRays.intensity}
    position.x={activeConfig.godRays.position[0]}
    position.y={activeConfig.godRays.position[1]}
    position.z={activeConfig.godRays.position[2]}
  />
{/if}

<!-- Hemisphere ambient -->
<T.HemisphereLight
  color={activeConfig.hemisphereLight.skyColor}
  groundColor={activeConfig.hemisphereLight.groundColor}
  intensity={activeConfig.hemisphereLight.intensity}
/>

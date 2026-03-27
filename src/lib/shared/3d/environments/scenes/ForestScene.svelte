<script lang="ts">
  /**
   * ForestScene
   *
   * A forest clearing environment with KayKit 3D models arranged in a ring
   * around the performer. Includes falling leaves and supports autumn/firefly variants.
   */

  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import TexturedGroundPlane from "../primitives/TexturedGroundPlane.svelte";
  import SkyGradient from "../primitives/SkyGradient.svelte";
  import FallingParticles from "../primitives/FallingParticles.svelte";
  import type { ForestVariant } from "../domain/enums/environment-enums";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import VolumetricFireComponent from "../../effects/volumetric-fire/VolumetricFireComponent.svelte";
  import { Vector3, FogExp2, Color } from "three";

  interface Props {
    /** Color variant: autumn (warm) or firefly (cool green) */
    variant?: ForestVariant;
  }

  let { variant = "autumn" }: Props = $props();

  /** R2 CDN base URL for large assets */
  const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

  // Load KayKit forest models
  const tree1 = useGltf(`${R2_CDN}/models/forest/Tree_1_A_Color1.gltf`);
  const tree2 = useGltf(`${R2_CDN}/models/forest/Tree_2_A_Color1.gltf`);
  const tree3 = useGltf(`${R2_CDN}/models/forest/Tree_3_A_Color1.gltf`);
  const rock1 = useGltf(`${R2_CDN}/models/forest/Rock_1_A_Color1.gltf`);
  const rock2 = useGltf(`${R2_CDN}/models/forest/Rock_1_B_Color1.gltf`);
  const bush1 = useGltf(`${R2_CDN}/models/forest/Bush_1_A_Color1.gltf`);
  const bush2 = useGltf(`${R2_CDN}/models/forest/Bush_2_A_Color1.gltf`);

  // Load camping models (Kenney Survival Kit - CC0)
  const campfire = useGltf(`${R2_CDN}/models/camping/campfire-pit.glb`);
  const tent = useGltf(`${R2_CDN}/models/camping/tent-canvas.glb`);

  // Load forest floor detail models
  const fallenLog = useGltf(`${R2_CDN}/models/camping/tree-log.glb`);
  const fallenLogSmall = useGltf(`${R2_CDN}/models/camping/tree-log-small.glb`);

  // Get scene for fog
  const { scene } = useThrelte();

  // ========================================
  // All positions and scales in METERS (1 unit = 1 meter)
  // ========================================

  // Campfire position - to the right and forward of performer
  const campfirePosition = { x: 3.0, z: -2.25 };
  const campfireScale = 2.5;

  // Tent position - behind and to the left of performer
  const tentPosition = { x: -3.25, z: 2.5 };
  const tentScale = 2.25;

  // Point light and fire emitter heights above campfire
  const campfireLightHeight = 0.75;

  // Fire dimensions - fire is centered at position, so we need to raise it by half its height
  const fireScale = 0.9;
  const fireHeight = 2.0; // Base height before scaling
  const fireHalfHeight = (fireHeight * fireScale) / 2; // 0.9 meters
  const fireEmitterHeight = fireHalfHeight; // Position fire so bottom touches ground

  // Clearing radius - how far the inner ring of trees is from center
  const clearingRadius = 10;

  // Multiple rings of trees to create depth - a true forest clearing feel
  // Ring 1: Inner edge of clearing (sparse, largest trees)
  // Ring 2: Mid-distance (denser, medium trees)
  // Ring 3: Far background (densest, smaller trees due to distance)
  // Ring 4: Distant backdrop (very dense, smallest)

  // Tree rings in meters
  const treeRings = [
    {
      radius: 10,
      count: 16,
      scaleBase: 1.4,
      scaleVariation: 0.4,
      radiusJitter: 1.0,
    },
    {
      radius: 13,
      count: 24,
      scaleBase: 1.25,
      scaleVariation: 0.35,
      radiusJitter: 1.5,
    },
    {
      radius: 16.5,
      count: 32,
      scaleBase: 1.1,
      scaleVariation: 0.3,
      radiusJitter: 1.75,
    },
    {
      radius: 20.5,
      count: 40,
      scaleBase: 0.9,
      scaleVariation: 0.25,
      radiusJitter: 2.0,
    },
  ];

  // Generate all tree placements across all rings
  // Position format: [x, z, scale, rotationY]
  const treePlacements: [number, number, number, number][] = treeRings.flatMap(
    (ring, ringIndex) =>
      Array.from({ length: ring.count }, (_, i) => {
        // Offset each ring's starting angle so trees don't line up
        const angleOffset = ringIndex * 0.4;
        const angle = (i / ring.count) * Math.PI * 2 + angleOffset;

        // Add randomness to radius for natural clustering
        const seed = ringIndex * 100 + i;
        const radiusVariation =
          ring.radius + Math.sin(seed * 3.7) * ring.radiusJitter;
        const x = Math.cos(angle) * radiusVariation;
        const z = Math.sin(angle) * radiusVariation;

        // Scale varies by position for natural look
        const scale =
          ring.scaleBase + Math.abs(Math.sin(seed * 2.3) * ring.scaleVariation);

        // Trees face roughly toward center with variation
        const rotation = angle + Math.PI + Math.sin(seed * 1.7) * 0.3;

        return [x, z, scale, rotation] as [number, number, number, number];
      })
  );

  // Rock placements - scattered around the clearing edge (meters)
  const rockPlacements: [number, number, number, number][] = Array.from(
    { length: 10 },
    (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + 0.2; // Offset from trees
      const radius = clearingRadius - 2.0 + Math.sin(i * 4.1) * 1.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.3 + Math.abs(Math.sin(i * 3.2) * 0.25);
      const rotation = Math.sin(i * 2.8) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    }
  );

  // Bush placements - scattered around clearing, more near trees (meters)
  const bushPlacements: [number, number, number, number][] = Array.from(
    { length: 16 },
    (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + 0.15;
      const radius = clearingRadius - 1.5 + Math.sin(i * 5.3) * 1.75;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.4 + Math.abs(Math.sin(i * 2.1) * 0.25);
      const rotation = Math.sin(i * 3.4) * Math.PI;
      return [x, z, scale, rotation] as [number, number, number, number];
    }
  );

  // Fallen log placements - scattered naturally on forest floor (meters)
  const fallenLogPlacements: [number, number, number, number, boolean][] = [
    // [x, z, scale, rotation, isLarge]
    // Near the clearing edge
    [7.0, 4.0, 2.0, Math.PI * 0.3, true],
    [-6.0, 5.5, 1.75, Math.PI * 0.7, true],
    [4.5, -6.5, 1.5, Math.PI * 1.2, false],
    [-7.5, -3.0, 1.4, Math.PI * 0.1, false],
    // Mid-distance
    [11.0, 2.0, 1.6, Math.PI * 0.5, true],
    [-10.0, -6.0, 1.5, Math.PI * 1.4, false],
    [9.0, -9.0, 1.75, Math.PI * 0.9, true],
    // Between tree rings
    [14.0, 7.5, 1.4, Math.PI * 0.2, false],
    [-13.0, 9.0, 1.5, Math.PI * 1.1, true],
  ];

  // Ground level - derived from user proportions
  const groundY = $derived(userProportionsState.groundY);

  // Fire emitter position (reactive to groundY)
  const firePosition = $derived(
    new Vector3(
      campfirePosition.x,
      groundY + fireEmitterHeight,
      campfirePosition.z
    )
  );

  // Forest floor texture paths
  const forestFloorTextures = {
    diffuse: "/textures/forest-floor/diffuse.jpg",
    normal: "/textures/forest-floor/normal.jpg",
    roughness: "/textures/forest-floor/roughness.jpg",
  };

  // Color palettes from background themeColors
  const palettes = {
    autumn: {
      // From AUTUMN_DRIFT: warm golds, oranges, deep reds
      sky: {
        topColor: "#1a0f0a",
        midColor: "#3d2010",
        bottomColor: "#0a0808",
      },
      ground: "#ddccbb", // Light warm tint - lets texture detail show through
      leaves: ["#d97706", "#dc2626", "#ea580c", "#92400e"],
      // No fireflies in autumn
      fireflies: null as string[] | null,
      // Warm amber fog for autumn morning mist (density in meters)
      fog: { color: "#1a1008", density: 0.036 },
      // Smoke colors (gray with warm tint)
      smoke: ["#443322", "#332211", "#221100"],
    },
    firefly: {
      // From FIREFLY_FOREST: deep night sky transitioning to forest
      // Matching the 2D background gradient exactly
      sky: {
        topColor: "#0a0e18", // Deep night sky (dark blue)
        midColor: "#0a1612", // Transition to forest
        bottomColor: "#0a1810", // Dark green at bottom
      },
      ground: "#99aa88", // Light green tint - lets texture show in darkness
      // Subtle green leaves barely visible in the dark
      leaves: ["#1a3a1a", "#0d2a15", "#153020", "#0f2518"],
      // Single warm yellow-green like real fireflies
      fireflies: ["#d4e157"],
      // Cool blue-green fog for mysterious night atmosphere (density in meters)
      fog: { color: "#0a1210", density: 0.044 },
      // Night smoke (darker, cooler)
      smoke: ["#222222", "#1a1a1a", "#111111"],
    },
  };

  const palette = $derived(palettes[variant]);

  // Apply fog to scene (reactive to variant changes)
  $effect(() => {
    const fogColor = new Color(palette.fog.color);
    scene.current.fog = new FogExp2(fogColor, palette.fog.density);

    return () => {
      scene.current.fog = null;
    };
  });
</script>

<!-- Sky gradient background -->
<SkyGradient
  topColor={palette.sky.topColor}
  midColor={palette.sky.midColor}
  bottomColor={palette.sky.bottomColor}
/>

<!-- Ground plane with PBR forest floor texture -->
<!-- Large size to cover the entire forest (all tree rings and beyond) - 50 meters -->
<TexturedGroundPlane
  color={palette.ground}
  size={50}
  diffuseMap={forestFloorTextures.diffuse}
  textureRepeat={40}
/>

<!-- Falling leaves - covers the entire forest (area in meters) -->
<!-- In firefly mode, leaves are very subtle (dark colors) -->
<FallingParticles
  type="leaves"
  count={variant === "firefly" ? 150 : 450}
  area={{ width: 40, height: 5, depth: 40 }}
  speed={variant === "firefly" ? 0.075 : 0.125}
  colors={palette.leaves}
  sizeRange={variant === "firefly" ? [0.075, 0.175] : [0.125, 0.275]}
  spin={true}
/>

<!-- Fireflies - only in firefly variant (area in meters) -->
{#if palette.fireflies}
  <FallingParticles
    type="fireflies"
    count={60}
    area={{ width: 8, height: 2, depth: 8 }}
    speed={0.005}
    colors={palette.fireflies}
    sizeRange={[0.2, 0.4]}
    spin={false}
  />
{/if}

<!-- KayKit Trees - ring around clearing -->
{#if $tree1 && $tree2 && $tree3}
  {#each treePlacements as [x, z, scale, rotY], i}
    {@const treeModel = i % 3 === 0 ? $tree1 : i % 3 === 1 ? $tree2 : $tree3}
    <T
      is={treeModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- KayKit Rocks - scattered around clearing edge -->
{#if $rock1 && $rock2}
  {#each rockPlacements as [x, z, scale, rotY], i}
    {@const rockModel = i % 2 === 0 ? $rock1 : $rock2}
    <T
      is={rockModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- KayKit Bushes - filling gaps in tree ring -->
{#if $bush1 && $bush2}
  {#each bushPlacements as [x, z, scale, rotY], i}
    {@const bushModel = i % 2 === 0 ? $bush1 : $bush2}
    <T
      is={bushModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Fallen logs - natural forest floor detail -->
{#if $fallenLog && $fallenLogSmall}
  {#each fallenLogPlacements as [x, z, scale, rotY, isLarge]}
    {@const logModel = isLarge ? $fallenLog : $fallenLogSmall}
    <T
      is={logModel.scene.clone()}
      position.x={x}
      position.y={groundY}
      position.z={z}
      {scale}
      rotation.y={rotY}
    />
  {/each}
{/if}

<!-- Campfire with warm point lights and fire particles -->
{#if $campfire}
  <T
    is={$campfire.scene.clone()}
    position.x={campfirePosition.x}
    position.y={groundY}
    position.z={campfirePosition.z}
    scale={campfireScale}
  />
  <!-- Volumetric raymarched fire (realistic) - 3x larger -->
  <VolumetricFireComponent
    position={firePosition}
    width={1.0}
    height={fireHeight}
    depth={1.0}
    scale={fireScale}
    sliceSpacing={0.15}
  />
  <!-- Primary warm point light - STRONG illumination for ground visibility -->
  <T.PointLight
    position.x={campfirePosition.x}
    position.y={groundY + campfireLightHeight * 2}
    position.z={campfirePosition.z}
    color="#ff6622"
    intensity={variant === "firefly" ? 50 : 35}
    distance={20}
    decay={1.2}
  />
  <!-- Secondary fill light (lower, wider spread for ground illumination) -->
  <T.PointLight
    position.x={campfirePosition.x}
    position.y={groundY + 0.25}
    position.z={campfirePosition.z}
    color="#ff4400"
    intensity={variant === "firefly" ? 30 : 20}
    distance={15}
    decay={1.5}
  />
  <!-- Subtle ambient hemisphere light for overall warmth -->
  <T.HemisphereLight
    color="#ff8844"
    groundColor="#221100"
    intensity={variant === "firefly" ? 0.6 : 0.4}
  />
  <!-- Campfire smoke - gentle plume rising from fire (meters) -->
  <T.Group
    position.x={campfirePosition.x}
    position.y={groundY + fireEmitterHeight + 0.5}
    position.z={campfirePosition.z}
  >
    <FallingParticles
      type="smoke"
      count={40}
      area={{ width: 1, height: 4, depth: 1 }}
      speed={0.04}
      colors={palette.smoke}
      sizeRange={[0.15, 0.4]}
      spin={false}
    />
  </T.Group>
{/if}

<!-- Cozy tent -->
{#if $tent}
  <T
    is={$tent.scene.clone()}
    position.x={tentPosition.x}
    position.y={groundY}
    position.z={tentPosition.z}
    scale={tentScale}
    rotation.y={Math.PI * 0.3}
  />
{/if}

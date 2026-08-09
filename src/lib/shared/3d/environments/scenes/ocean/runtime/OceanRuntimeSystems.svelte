<script lang="ts">
  import { T } from "@threlte/core";
  import { Vector3, type DirectionalLight, type Object3D } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    SUN_POS,
    HERO_TARGET_XZ,
    STAGE_DECK_OFFSET,
    keyLightPosition,
  } from "./atmosphere/god-ray-axis";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import WaterSurface from "./water/WaterSurface.svelte";
  import AtmosphereSystem from "./atmosphere/AtmosphereSystem.svelte";
  import FaunaSystem from "./fauna/FaunaSystem.svelte";
  import OceanInteraction from "./interaction/OceanInteraction.svelte";
  import OceanStage from "./OceanStage.svelte";
  import { godraysLightStore } from "../../../../effects/post-processing/godrays-light-store.svelte";
  import { oceanDebugToggles } from "../quality/ocean-debug-toggles.svelte";

  interface Props {
    quality: OceanQualityConfig;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
    worldYOffset?: number;
  }

  let {
    quality,
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
    worldYOffset = 0,
  }: Props = $props();

  let cursorRay = $state({
    origin: new Vector3(),
    dir: new Vector3(0, 0, -1),
    active: false,
  });
  let sunLight = $state<DirectionalLight | undefined>(undefined);
  let keyTarget = $state<Object3D | undefined>(undefined);

  const groundY = $derived(userProportionsState.groundY);
  const keyPosition = $derived(keyLightPosition(groundY));
  const stageDeckY = $derived(groundY + STAGE_DECK_OFFSET);

  $effect(() => {
    if (!sunLight) return;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.04;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.camera.updateProjectionMatrix();
    godraysLightStore.light = sunLight;
    return () => {
      godraysLightStore.light = null;
    };
  });
</script>

<!-- ── The rig ──────────────────────────────────────────────────────────────
     Moody Twilight Reef wants ONE motivated key and real darkness around it.
     Every other composed scene in the program works this way: Autumn and Forest
     have a campfire, Winter has the moon. The ocean's key is the surface shaft
     that lands on the stage — the spot light below IS that shaft, and
     GodRayShafts draws its visible column down the same axis.

     Ambient and sun were carrying the whole frame before this pass (hemisphere
     0.2 + directional 0.9), which lit the sand, the reef, and the far field to
     the same value. Nothing was emphasised because nothing was dark. -->

<!-- Underwater ambient: a hemisphere light gives top-down gradient fill (brighter
     teal from the surface above, darker from the floor below) so the seabed and
     flora get FORM instead of a flat wash — what a single AmbientLight could not
     do. Kept just high enough that shadow interiors stay readable. -->
<T.HemisphereLight
  intensity={oceanDebugToggles.hemiLight ? 0.09 : 0}
  color="#3a6b7a"
  groundColor="#0a1a14"
/>
<!-- One coherent warm-white sun drives surface form, hero shadows, caustics,
     shafts, and the Snell-window disc. It is no longer the scene's key — it
     supplies direction and shadow, the spot supplies the subject.
     Colour went warm-white -> cool (#ffffdd -> #cfe0f0): at 10 m depth sunlight
     is already strongly blue-shifted, and the warm sun was the single biggest
     amplifier of the salmon seabed albedo. This cools the sand across the whole
     frame without touching the GLB texture (that stays a Gate 3 Blender pass),
     and it leaves the torches as the only warm source in the scene. -->
<T.DirectionalLight
  bind:ref={sunLight}
  position={[SUN_POS.x, SUN_POS.y, SUN_POS.z]}
  intensity={0.28}
  color="#dde8ee"
  castShadow
/>

<!-- The key. A surface shaft pooling on the stage, travelling down the same axis
     as the hero god-ray column so the pool has a visible cause. Cool-white
     because this light has come through 10 m of water; the torches own the only
     warmth in the frame.
     No castShadow: the reef is ~54M verts/frame and the directional light
     already spends one full shadow pass over it. The cone's own falloff is what
     creates the darkness, not shadowing.

     Cone geometry is the whole ballgame here, and 0.42/0.8 got it wrong. The
     spot sits 9.83 m up the column axis from the deck, so angle 0.42 put a
     9 m-wide circle over an 8x6 m stage: the cone was LARGER than its subject,
     every edge fell outside the frame, and penumbra 0.8 smeared what was left.
     The result read as fill, not as a beam landing — the deck lit evenly and
     nothing around it went dark. 0.30 gives a ~6.1 m pool that sits inside the
     deck with its falloff visible on the stone, and penumbra 0.55 leaves that
     falloff soft without erasing it. Intensity follows the area down. -->
<T.Object3D
  bind:ref={keyTarget}
  position={[HERO_TARGET_XZ.x, stageDeckY, HERO_TARGET_XZ.z]}
/>
{#if keyTarget}
  <T.SpotLight
    position={[keyPosition.x, keyPosition.y, keyPosition.z]}
    target={keyTarget}
    intensity={260}
    color="#cfe6f5"
    angle={0.3}
    penumbra={0.55}
    distance={34}
    decay={2}
  />
{/if}

<!-- Torch_Light_0 / _1 — exact Blender transforms (Z-up→Y-up: x, z, -y),
     color (1.0, 0.467, 0.133) = #ff7722, energy 150 → tuned three intensity.
     Reef sits at Blender identity, so torch Y is the raw Blender Z (1.708).
     Trimmed 40 → 26 with the rig rebalance: they are warm ACCENTS against the
     cool key, and at the old value they became general fill the moment the
     directional light came down. Reach cut 18 → 10 for the same reason — an 18 m
     radius from the stage's front corners washed the ENTIRE foreground seabed
     orange, which is most of what read as "salmon sand". At 10 m the warmth is a
     halo around the stage instead of a floor tint.
     No castShadow: point-light cube shadows are redundant with the sun's
     directional shadow, and disposing their CubeRenderTarget on scene teardown
     crashes three's deallocateRenderTarget (undefined __webglFramebuffer). -->
<T.PointLight
  position={[3, 1.708, 2.25]}
  intensity={26}
  color="#ff7722"
  distance={10}
  decay={2}
/>
<T.PointLight
  position={[-3, 1.708, 2.25]}
  intensity={26}
  color="#ff7722"
  distance={10}
  decay={2}
/>

<!-- Performer stage (Blender-authored Stage_* objects → stage.glb).
     Gated on the "stage" scene feature; grounds its deck under the performer. -->
<OceanStage />

{#if quality.enableWaterSurface}
  <!-- Water surface (above everything) -->
  <WaterSurface />
{/if}

{#if quality.enableAtmosphere}
  <!-- Atmosphere: god rays, caustics, particles -->
  <AtmosphereSystem {quality} {worldYOffset} />
{/if}

{#if quality.enableFauna}
  <!-- Fauna: fish boids + jellyfish swarm -->
  <FaunaSystem {quality} {cursorRay} {worldYOffset} />

  <!-- Interaction: mouse raycast → fish scatter + audio. Emits the cursor's
       world-space ray; the boid shaders flee fish by perpendicular distance to
       that ray, so scatter is depth-correct at any camera angle. -->
  <OceanInteraction bind:cursorRay />
{/if}

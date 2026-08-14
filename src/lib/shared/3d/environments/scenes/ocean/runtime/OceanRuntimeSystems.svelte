<script lang="ts">
  import { T } from "@threlte/core";
  import { Vector3, type DirectionalLight, type Object3D } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import {
    OCEAN_STAGE_DECK_OFFSET_METERS,
    OCEAN_STAGE_TO_SURFACE_METERS,
  } from "$lib/shared/3d/environments/domain/models/ocean-water-depth";
  import {
    COLUMN_UP,
    SUN_POS,
    HERO_TARGET_XZ,
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

  const keyAxisDistance = OCEAN_STAGE_TO_SURFACE_METERS / COLUMN_UP.y;
  const keyAngle = Math.atan(3.05 / keyAxisDistance);
  const keyIntensity = 260 * Math.pow(keyAxisDistance / 9.83, 2);

  const groundY = $derived(userProportionsState.groundY);
  const keyPosition = $derived(keyLightPosition(groundY));
  const stageDeckY = $derived(groundY + OCEAN_STAGE_DECK_OFFSET_METERS);

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
     Colour went warm-white -> cool (#ffffdd -> #cfe0f0): at this depth sunlight
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
     because this light has come through deep water; the torches own the only
     warmth in the frame.
     No castShadow: the reef is ~54M verts/frame and the directional light
     already spends one full shadow pass over it. The cone's own falloff is what
     creates the darkness, not shadowing.

     The water depth owns the cone angle and intensity. Moving the surface
     farther away otherwise makes the pool wider and dimmer even though the
     stage itself has not changed. The calculation preserves the established
     6.1 m pool and its brightness at any waterline. -->
<T.Object3D
  bind:ref={keyTarget}
  position={[HERO_TARGET_XZ.x, stageDeckY, HERO_TARGET_XZ.z]}
/>
{#if keyTarget}
  <T.SpotLight
    position={[keyPosition.x, keyPosition.y, keyPosition.z]}
    target={keyTarget}
    intensity={keyIntensity}
    color="#cfe6f5"
    angle={keyAngle}
    penumbra={0.55}
    distance={34}
    decay={2}
  />
{/if}

<!-- Torch_Light_0 / _1 — warm accents flanking the stage. Colour is the Blender
     torch colour (1.0, 0.467, 0.133) = #ff7722; energy 150 → tuned three
     intensity. They own the only warmth in the frame, so the sun stays cool.
     Trimmed 40 → 26 with the rig rebalance: at the old value they became general
     fill the moment the directional light came down. Reach cut 18 → 10 for the
     same reason — an 18 m radius washed the ENTIRE foreground seabed orange,
     which is most of what read as "salmon sand".

     They no longer sit at the raw Blender transform (±3, 1.708, 2.25). The dais
     is a RUNTIME object Blender knows nothing about, it is 8x6 at the origin,
     and those coordinates are inside it — 0.2 m from a support pillar and 0.8 m
     under the deck. That was invisible while the dais wrote gl_FragColor and
     received no light at all. The moment it became a lit standard material the
     two torches stopped being accents and became its key: 26 candela at ~1 m is
     an irradiance of ~26 against the spot's 2.7 at the deck, so the near half of
     the stone blew out to flat cream and the column stumps turned orange. That
     is the second half of "the stage looks remarkably washed out" — first it had
     no light, then it had far too much of the wrong light.

     Only the axis that collides moves. ±6.2 puts them 2.2 m outboard of the deck
     edge and 1.9 lifts them to just under the deck lip instead of inside the
     pillar band; z stays at the authored 2.25. Pushing them forward as well (4.2)
     was tried and reverted — it dropped both pools into the camera's immediate
     foreground and turned the whole front of the seabed warm, which is the
     "salmon sand" failure the reach cut above exists to prevent.
     26 → 13 with the move: #ff7722 saturates to flat orange the moment its
     irradiance runs away, and at 2.3 m from the slab's side face 13 candela
     lands near the key's own value there. A warm kiss on the stage's flanks,
     which is what the comment above always claimed these were.
     No castShadow: point-light cube shadows are redundant with the sun's
     directional shadow, and disposing their CubeRenderTarget on scene teardown
     crashes three's deallocateRenderTarget (undefined __webglFramebuffer). -->
<T.PointLight
  position={[6.2, 1.9, 2.25]}
  intensity={13}
  color="#ff7722"
  distance={10}
  decay={2}
/>
<T.PointLight
  position={[-6.2, 1.9, 2.25]}
  intensity={13}
  color="#ff7722"
  distance={10}
  decay={2}
/>

<!-- Performer stage (Blender-authored Stage_* objects → stage.glb).
     Gated on the "stage" scene feature; grounds its deck under the performer. -->
<OceanStage {stageWidth} {stageDepth} {stageZOffset} />

{#if quality.enableWaterSurface}
  <!-- Water surface (above everything) -->
  <WaterSurface {groundY} />
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

<script lang="ts">
  import { T } from "@threlte/core";
  import { Vector3 } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { onDestroy, untrack } from "svelte";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import WaterSurface from "./water/WaterSurface.svelte";
  import AtmosphereSystem from "./atmosphere/AtmosphereSystem.svelte";
  import FaunaSystem from "./fauna/FaunaSystem.svelte";
  import OceanInteraction from "./interaction/OceanInteraction.svelte";
  import OceanStage from "./OceanStage.svelte";
  import { godraysLightStore } from "../../../../effects/post-processing/godrays-light-store.svelte";
  import { oceanDebugToggles } from "../quality/ocean-debug-toggles.svelte";
  import { createOceanLightingRig } from "../../../worlds/ocean/ocean-lighting-rig";

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
  const groundY = $derived(userProportionsState.groundY);
  const lighting = untrack(() =>
    createOceanLightingRig({
      groundY: userProportionsState.groundY,
      hemisphereEnabled: oceanDebugToggles.hemiLight,
    })
  );

  $effect(() => {
    lighting.setGroundY(groundY);
  });
  $effect(() => {
    lighting.setHemisphereEnabled(oceanDebugToggles.hemiLight);
  });
  $effect(() => {
    godraysLightStore.light = lighting.sunLight;
    return () => {
      godraysLightStore.light = null;
    };
  });
  onDestroy(lighting.dispose);
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
<T is={lighting.object} />
<!-- One coherent warm-white sun drives surface form, hero shadows, caustics,
     shafts, and the Snell-window disc. It is no longer the scene's key — it
     supplies direction and shadow, the spot supplies the subject.
     Colour went warm-white -> cool (#ffffdd -> #cfe0f0): at this depth sunlight
     is already strongly blue-shifted, and the warm sun was the single biggest
     amplifier of the salmon seabed albedo. This cools the sand across the whole
     frame without touching the GLB texture (that stays a Gate 3 Blender pass),
     and it leaves the torches as the only warm source in the scene. -->
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

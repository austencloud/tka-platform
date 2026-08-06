<script lang="ts">
  import { T } from "@threlte/core";
  import { Vector3, type DirectionalLight } from "three";
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

<!-- Underwater ambient: a hemisphere light gives top-down gradient fill (brighter
     teal from the surface above, darker from the floor below) so the seabed and
     flora get FORM instead of a flat wash — what a single AmbientLight could not
     do. Low intensity keeps the moody dark world; torches still carry warm key. -->
<T.HemisphereLight
  intensity={oceanDebugToggles.hemiLight ? 0.2 : 0}
  color="#3a6b7a"
  groundColor="#0a1a14"
/>
<!-- One coherent warm-white sun drives surface form, hero shadows, caustics,
     shafts, and the Snell-window disc. Low ambient fill keeps its direction. -->
<T.DirectionalLight
  bind:ref={sunLight}
  position={[10, 30, -20]}
  intensity={0.9}
  color="#ffffdd"
  castShadow
/>
<!-- Torch_Light_0 / _1 — exact Blender transforms (Z-up→Y-up: x, z, -y),
     color (1.0, 0.467, 0.133) = #ff7722, energy 150 → tuned three intensity.
     Reef sits at Blender identity, so torch Y is the raw Blender Z (1.708).
     No castShadow: point-light cube shadows are redundant with the sun's
     directional shadow, and disposing their CubeRenderTarget on scene teardown
     crashes three's deallocateRenderTarget (undefined __webglFramebuffer). -->
<T.PointLight
  position={[3, 1.708, 2.25]}
  intensity={40}
  color="#ff7722"
  distance={18}
  decay={2}
/>
<T.PointLight
  position={[-3, 1.708, 2.25]}
  intensity={40}
  color="#ff7722"
  distance={18}
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

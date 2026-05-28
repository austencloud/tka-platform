<script lang="ts">
  import { T } from "@threlte/core";
  import { Vector3, type DirectionalLight } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import TexturedGroundPlane from "../../../primitives/TexturedGroundPlane.svelte";
  import WaterSurface from "./water/WaterSurface.svelte";
  import AtmosphereSystem from "./atmosphere/AtmosphereSystem.svelte";
  import FaunaSystem from "./fauna/FaunaSystem.svelte";
  import OceanInteraction from "./interaction/OceanInteraction.svelte";
  import { godraysLightStore } from "../../../../effects/post-processing/godrays-light-store.svelte";

  interface Props {
    quality: OceanQualityConfig;
    performerCount?: number;
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let {
    quality,
    performerCount = 1,
    stageWidth = 6,
    stageDepth = 6,
    stageZOffset = 0,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
  let rayPosition = $state(new Vector3(0, -999, 0));
  let sunLight = $state<DirectionalLight | null>(null);

  $effect(() => {
    if (!sunLight) return;
    sunLight.shadow.mapSize.set(512, 512);
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

<!-- Seabed ground plane — PBR sand with underwater tint -->
<TexturedGroundPlane
  diffuseMap="/textures/terrain/sand/diffuse.jpg"
  normalMap="/textures/terrain/sand/normal.jpg"
  roughnessMap="/textures/terrain/sand/roughness.jpg"
  aoMap="/textures/terrain/sand/ao.jpg"
  color="#5a8a8a"
  size={30}
  textureRepeat={12}
  normalScale={2.0}
  aoIntensity={0.8}
  receiveShadow
/>

<!-- Lighting -->
<T.HemisphereLight args={["#3a7090", "#0a1a2a", 1.0]} />
<T.DirectionalLight
  bind:ref={sunLight}
  position={[10, 30, -20]}
  intensity={1.5}
  color="#88bbdd"
  castShadow
/>

<!-- Water surface (above everything) -->
<WaterSurface />

<!-- Atmosphere: god rays, caustics, particles -->
<AtmosphereSystem {quality} />

<!-- Fauna: fish boids + jellyfish swarm -->
<FaunaSystem {quality} {rayPosition} />

<!-- Interaction: mouse raycast → fish scatter + audio -->
<OceanInteraction bind:rayPosition />

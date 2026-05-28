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
  let sunLight = $state<DirectionalLight | undefined>(undefined);

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
  color="#7aaa9a"
  size={40}
  textureRepeat={12}
  normalScale={2.0}
  aoIntensity={0.8}
  receiveShadow
/>

<!-- Lighting — bright even fill to match Blender reference -->
<T.AmbientLight intensity={0.8} color="#88bbdd" />
<T.HemisphereLight args={["#a0d8f0", "#3a6a5a", 3.0]} />
<T.DirectionalLight
  bind:ref={sunLight}
  position={[10, 30, -20]}
  intensity={5.0}
  color="#ddeeff"
  castShadow
/>
<T.DirectionalLight
  position={[0, -10, 0]}
  intensity={2.0}
  color="#ccaa88"
/>
<!-- Reef accent lights — vibrant color pools -->
<T.PointLight position={[-8, 2, -12]} intensity={40} color="#44aacc" distance={25} decay={2} />
<T.PointLight position={[8, 2, -12]} intensity={40} color="#55cc88" distance={25} decay={2} />
<T.PointLight position={[0, 4, -6]} intensity={50} color="#7799ee" distance={30} decay={2} />
<T.PointLight position={[-12, 1, -5]} intensity={30} color="#88bb55" distance={20} decay={2} />
<T.PointLight position={[12, 1, -5]} intensity={30} color="#dd8855" distance={20} decay={2} />
<T.PointLight position={[0, 1, -15]} intensity={35} color="#bb66cc" distance={25} decay={2} />
<T.PointLight position={[-5, 0, -3]} intensity={25} color="#ff9966" distance={18} decay={2} />
<T.PointLight position={[5, 0, -3]} intensity={25} color="#66ddaa" distance={18} decay={2} />

<!-- Water surface (above everything) -->
<WaterSurface />

<!-- Atmosphere: god rays, caustics, particles -->
<AtmosphereSystem {quality} />

<!-- Fauna: fish boids + jellyfish swarm -->
<FaunaSystem {quality} {rayPosition} />

<!-- Interaction: mouse raycast → fish scatter + audio -->
<OceanInteraction bind:rayPosition />

<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
  import {
    Box3,
    DirectionalLight,
    Group,
    MeshBasicMaterial,
    Color,
    Vector3,
  } from "three";
  import type { OceanBoatSilhouetteConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { godraysLightStore } from "../../../effects/post-processing/godrays-light-store.svelte";

  interface Props {
    config: OceanBoatSilhouetteConfig;
    waterSurfaceHeight: number;
  }

  let { config, waterSurfaceHeight }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);
  const boatY = $derived(groundY + waterSurfaceHeight + config.heightAboveSurface);

  const gltf = useGltf(config.modelPath ?? "/models/ocean/boat.glb", {
    meshoptDecoder: MeshoptDecoder,
  });

  const silhouetteMat = new MeshBasicMaterial({
    color: new Color(config.color),
  });

  $effect(() => {
    const model = $gltf;
    if (!model) return;

    model.scene.scale.setScalar(1);
    model.scene.position.set(0, 0, 0);

    const dims: { child: any; max: number; min: number }[] = [];
    model.scene.traverse((child: any) => {
      if (!child.isMesh) return;
      const mb = new Box3().setFromObject(child);
      const ms = new Vector3();
      mb.getSize(ms);
      const sorted = [ms.x, ms.y, ms.z].sort((a, b) => a - b);
      dims.push({ child, max: sorted[2]!, min: sorted[0]! });
    });

    for (const { child, max, min } of dims) {
      const isFlat = min < max * 0.05;
      const isMassive = max > 50;
      if (isFlat || isMassive) {
        child.visible = false;
        continue;
      }
      child.material = silhouetteMat;
      child.castShadow = true;
    }

    const box = new Box3().setFromObject(model.scene);
    const size = new Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim > 0.001 ? config.length / maxDim : 1;
    model.scene.scale.setScalar(s);
    model.scene.position.set(
      -box.getCenter(new Vector3()).x * s,
      -box.min.y * s,
      -box.getCenter(new Vector3()).z * s,
    );
  });

  let group = $state<Group | undefined>(undefined);
  let elapsed = 0;
  let godRayLight = $state<DirectionalLight | null>(null);

  $effect(() => {
    if (!config.godRayOcclusion) return;

    const light = new DirectionalLight(0x88bbdd, 1.5);
    light.position.set(config.offsetX, boatY + 15, config.offsetZ);
    light.target.position.set(config.offsetX, boatY - 5, config.offsetZ);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 30;
    light.shadow.camera.left = -8;
    light.shadow.camera.right = 8;
    light.shadow.camera.top = 8;
    light.shadow.camera.bottom = -8;

    godRayLight = light;
    godraysLightStore.light = light;

    return () => {
      godraysLightStore.light = null;
      light.dispose();
      godRayLight = null;
    };
  });

  useTask((delta) => {
    if (!group || !config.animated) return;
    elapsed += delta;

    const t = elapsed * config.driftSpeed;
    const r = config.driftRadius;
    const driftX = Math.sin(t) * r;
    const driftZ = Math.sin(t * 0.7) * r * 0.6;

    group.position.x = config.offsetX + driftX;
    group.position.z = config.offsetZ + driftZ;
    group.position.y = boatY + Math.sin(elapsed * 0.5) * 0.08;

    const headingX = Math.cos(t) * r * config.driftSpeed;
    const headingZ = Math.cos(t * 0.7) * r * 0.6 * config.driftSpeed * 0.7;
    group.rotation.y = Math.atan2(headingX, headingZ);

    group.rotation.x = Math.sin(elapsed * 0.4) * 0.02;
    group.rotation.z = Math.sin(elapsed * 0.3 + 1.0) * 0.025;
  });
</script>

{#if $gltf}
  <T.Group
    bind:ref={group}
    position.x={config.offsetX}
    position.y={boatY}
    position.z={config.offsetZ}
    rotation.y={config.rotationY}
  >
    <T is={$gltf.scene} />
  </T.Group>
{/if}

{#if godRayLight}
  <T is={godRayLight}>
    <T is={godRayLight.target} />
  </T>
{/if}


<script lang="ts">
  import { T, useTask } from "@threlte/core";
  import {
    BoxGeometry,
    MeshBasicMaterial,
    DirectionalLight,
    DoubleSide,
    Group,
    Color,
  } from "three";
  import type { OceanBoatSilhouetteConfig } from "../../domain/models/scene-configs";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { godraysLightStore } from "../../../effects/post-processing/godrays-light-store.svelte";
  import { onDestroy } from "svelte";

  interface Props {
    config: OceanBoatSilhouetteConfig;
    waterSurfaceHeight: number;
  }

  let { config, waterSurfaceHeight }: Props = $props();
  const groundY = $derived(userProportionsState.groundY);
  const boatY = $derived(groundY + waterSurfaceHeight + config.heightAboveSurface);

  const hullMaterial = new MeshBasicMaterial({
    color: new Color(config.color),
    side: DoubleSide,
  });

  function createTaperedHull(length: number, depth: number, width: number): BoxGeometry {
    const geo = new BoxGeometry(length, depth, width, 4, 1, 1);
    const pos = geo.attributes.position!;
    const halfLen = length / 2;
    const taperStart = 0.55;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const absX = Math.abs(x);
      const norm = absX / halfLen;

      if (norm > taperStart) {
        const t = (norm - taperStart) / (1 - taperStart);
        const squeeze = 1 - t * t * 0.85;
        pos.setZ(i, pos.getZ(i) * squeeze);
        const y = pos.getY(i);
        if (y < 0) {
          pos.setY(i, y * (1 - t * 0.4));
        }
      }
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  const hullGeo = createTaperedHull(config.length, config.depth, config.width);
  const keelGeo = new BoxGeometry(config.length * 0.65, config.depth * 0.75, 0.08);

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

    group.rotation.x = Math.sin(elapsed * 0.4) * 0.015;
    group.rotation.z = Math.sin(elapsed * 0.3 + 1.0) * 0.02;
    group.position.y = boatY + Math.sin(elapsed * 0.5) * 0.05;
  });

  onDestroy(() => {
    hullGeo.dispose();
    keelGeo.dispose();
    hullMaterial.dispose();
  });
</script>

<T.Group
  bind:ref={group}
  position.x={config.offsetX}
  position.y={boatY}
  position.z={config.offsetZ}
  rotation.y={config.rotationY}
>
  <T.Mesh geometry={hullGeo} material={hullMaterial} castShadow />

  {#if config.keelEnabled}
    <T.Mesh
      geometry={keelGeo}
      material={hullMaterial}
      position.y={-config.depth * 0.85}
      castShadow
    />
  {/if}
</T.Group>

{#if godRayLight}
  <T is={godRayLight}>
    <T is={godRayLight.target} />
  </T>
{/if}

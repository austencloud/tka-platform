<!--
  Build-preview capture harness for the Prop Studio picker tiles.

  Load with query params and screenshot the 1280x480 canvas at the top-left
  of the page, then downscale to 640x240 webp:

    /test/prop-3d-studio/capture?prop=triad&finish=fire&rz=0&zoom=1

  - prop:   scene-3d PropType value (staff, triad, quiad, trigeng, ...)
  - finish: fire | day (props with finish variants)
  - rx/ry/rz: presentation rotation in degrees
  - zoom:   camera distance multiplier (default 1)

  document.body.dataset.captureReady flips to "1" once the model has loaded
  and the framing is stable.
-->
<script lang="ts">
  import { Canvas } from "@threlte/core";
  import { page } from "$app/state";
  import {
    PropType,
    propFinishState,
    type PropFinish,
  } from "@austencloud/scene-3d";
  import CaptureScene from "./CaptureScene.svelte";

  const params = $derived(page.url.searchParams);

  const SCENE_PROP_TYPES = new Set<string>(Object.values(PropType));

  const propType = $derived.by(() => {
    const requested = params.get("prop") ?? PropType.STAFF;
    return SCENE_PROP_TYPES.has(requested)
      ? (requested as PropType)
      : PropType.STAFF;
  });

  const rotationDeg = $derived({
    x: Number(params.get("rx") ?? 0),
    y: Number(params.get("ry") ?? 0),
    z: Number(params.get("rz") ?? 0),
  });

  const zoom = $derived(Number(params.get("zoom") ?? 1) || 1);

  $effect(() => {
    const finish = params.get("finish");
    if (finish === "fire" || finish === "day") {
      propFinishState.set(finish satisfies PropFinish);
    }
  });
</script>

<svelte:head>
  <title>Prop build-preview capture</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="capture-stage">
  {#key `${propType}:${params.get("finish") ?? ""}`}
    <Canvas>
      <CaptureScene {propType} {rotationDeg} {zoom} />
    </Canvas>
  {/key}
</div>

<style>
  .capture-stage {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: #070911;
  }

  .capture-stage :global(canvas) {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
</style>

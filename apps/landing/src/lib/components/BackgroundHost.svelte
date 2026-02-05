<!--
  BackgroundHost.svelte (Landing - standalone)

  Thin Svelte wrapper around @austencloud/backgrounds controller.
  Replaces $app/environment browser check with typeof window check.
-->
<script lang="ts">
  import "@austencloud/backgrounds/css/backgrounds.css";
  import { onMount } from "svelte";
  import { BackgroundType, getBackgroundController } from "@austencloud/backgrounds";

  const {
    backgroundType = BackgroundType.NIGHT_SKY,
  } = $props<{
    backgroundType?: BackgroundType;
  }>();

  let containerRef: HTMLDivElement | undefined = $state();
  const isBrowser = typeof window !== "undefined";
  const controller = isBrowser ? getBackgroundController() : null;
  let mounted = $state(false);

  onMount(() => {
    if (!isBrowser || !containerRef || !controller) return;
    controller.mount(containerRef);
    mounted = true;
  });

  $effect(() => {
    if (!mounted || !controller) return;
    controller.setBackground(backgroundType);
  });
</script>

<div
  bind:this={containerRef}
  class="background-canvas-container"
  aria-hidden="true"
></div>

<style>
  .background-canvas-container {
    position: fixed;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }
</style>

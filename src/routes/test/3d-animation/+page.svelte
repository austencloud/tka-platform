<script lang="ts">
  /**
   * 3D Animation Test Page
   *
   * Sandboxed development environment for the 3D animation system.
   * Uses Viewer3DModule which includes keyboard shortcuts.
   */

  import Viewer3DModule from "$lib/shared/3d-animation/Viewer3DModule.svelte";
</script>

<svelte:head>
  <title>3D Animation Test | TKA Scribe</title>
</svelte:head>

<div class="page">
  <Viewer3DModule />
</div>

<style>
  .page {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
</style>

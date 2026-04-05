<script lang="ts">
  /**
   * 3D Animation Test Page
   *
   * Sandboxed development environment for the 3D animation system.
   * Uses StageWorld which is the unified stage + infinite worlds experience.
   */

  import StageWorld from "$lib/shared/3d/StageWorld.svelte";
</script>

<svelte:head>
  <title>3D Animation Test | TKA Composer</title>
</svelte:head>

<div class="page">
  <StageWorld />
</div>

<style>
  .page {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
</style>

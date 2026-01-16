<script lang="ts">
  /**
   * Test page for Endless World terrain rendering.
   * Access at: /test/endless-world
   */

  import EndlessWorldModule from "$lib/features/endless-world/EndlessWorldModule.svelte";
</script>

<svelte:head>
  <title>Endless World Test | TKA Scribe</title>
</svelte:head>

<div class="test-page">
  <EndlessWorldModule />
</div>

<style>
  .test-page {
    position: fixed;
    inset: 0;
    background: #0a0a12;
  }
</style>

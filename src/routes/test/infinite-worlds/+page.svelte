<script lang="ts">
  /**
   * Test Route: Infinite Worlds
   *
   * Direct access to the Threlte-based world scene for testing.
   * Bypasses the main app navigation for quick iteration.
   *
   * Now uses the new WorldScene component with full avatar parity.
   */

  import WorldScene from "$lib/shared/3d/procedural-engine/components/WorldScene.svelte";
  import { onMount } from "svelte";

  // Optional: Parse seed from URL query param
  let seed: number | undefined = $state(undefined);

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get("seed");
    if (seedParam) {
      seed = parseInt(seedParam, 36); // Decode from base36
    }
  });
</script>

<svelte:head>
  <title>Infinite Worlds | TKA Composer</title>
</svelte:head>

<WorldScene {seed} showDebug={true} />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #0a0a1a;
  }
</style>

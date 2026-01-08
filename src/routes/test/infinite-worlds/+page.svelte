<script lang="ts">
  /**
   * Test Route: Infinite Worlds
   *
   * Direct access to the infinite worlds prototype for testing.
   * Bypasses the main app navigation for quick iteration.
   */

  import InfiniteWorldsModule from "$lib/features/infinite-worlds/components/InfiniteWorldsModule.svelte";
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
  <title>Infinite Worlds | TKA Scribe</title>
</svelte:head>

<InfiniteWorldsModule {seed} viewDistance={256} showDebug={true} />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #0a0a1a;
  }
</style>

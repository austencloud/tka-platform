<script lang="ts">
  /**
   * Stage harness.
   *
   * StageModule mounted on its own, outside the app shell. The module builds
   * its own viewer context and choreography document, so nothing but a
   * full-viewport box is needed to run it. This is the surface to iterate on
   * the Stage against while the shell is unavailable; the shipping route is
   * /stage.
   */
  import { onMount } from "svelte";
  import StageModule from "$lib/features/stage/StageModule.svelte";

  // The boot bar in app.html waits for the app layout to report 100%, and a
  // /test route never runs that layout, so without this the splash sits over
  // the harness until its 15s safety net fires.
  onMount(() => {
    (window as unknown as { __tkaLoadProgress?: (p: number) => void })
      .__tkaLoadProgress?.(100);
  });
</script>

<svelte:head><title>Stage harness</title></svelte:head>

<div class="harness">
  <StageModule />
</div>

<style>
  .harness {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }

  :global(body) {
    margin: 0;
    background: #05060b;
  }
</style>

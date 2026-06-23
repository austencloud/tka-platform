<script lang="ts">
  /**
   * Test harness for the orphaned Assemble timing lab (feedback aOukrlZa).
   *
   * AssembleLabModule is fully built but had zero importers — never mounted on
   * any route or in the Lab tab. This page renders the real component so the
   * numpad tap-rhythm capture (timing-interpreter) can be exercised end to end.
   *
   * To see the timing capture: toggle "Build with numpad" (keyboard mode), then
   * tap numpad keys to place steps — the rhythm of your taps drives the
   * resulting animation timing.
   */
  import AssembleLabModule from "$lib/features/assemble-lab/AssembleLabModule.svelte";
</script>

<svelte:head>
  <title>Numpad Timing Lab</title>
</svelte:head>

<div class="lab-host">
  <AssembleLabModule />
</div>

<style>
  .lab-host {
    position: fixed;
    inset: 0;
    height: 100dvh;
    width: 100vw;
    overflow: hidden;
  }
</style>

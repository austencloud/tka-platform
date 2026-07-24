<script lang="ts">
  import { tick, type Component } from "svelte";
  import LazyMount from "./LazyMount.svelte";

  let mounted = $state(true);
  let status = $state("idle");
  let rejectLoad: ((reason: Error) => void) | null = null;

  function rejectAfterTeardown(): Promise<{ default: Component<any> }> {
    return new Promise((_resolve, reject) => {
      rejectLoad = reject;
    });
  }

  async function closeLoader(): Promise<void> {
    mounted = false;
    await tick();
    rejectLoad?.(new Error("late test chunk failure"));
  }
</script>

<button type="button" onclick={closeLoader}>Close loader</button>
<output aria-label="Lazy mount teardown status">{status}</output>

{#if mounted}
  <LazyMount
    loader={rejectAfterTeardown}
    active={true}
    debugName="delayed test component"
    onStatusChange={(next) => (status = next)}
  />
{/if}

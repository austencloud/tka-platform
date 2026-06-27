<!--
  Dispatcher: given the active module key, render its bespoke layout skeleton
  (or the shared shell fallback). Create gets the ambient MandalaLoader — its
  chunk is the heaviest, so the wait is long enough to be worth the visual.
-->
<script lang="ts">
  import { resolveSkeleton } from "./index";
  import MandalaLoader from "$lib/shared/mandala/components/MandalaLoader.svelte";
  let { moduleKey }: { moduleKey: string | null } = $props();
  const Skeleton = $derived(resolveSkeleton(moduleKey));
</script>

{#if moduleKey === "create"}
  <MandalaLoader message="Loading Create…" />
{:else}
  <Skeleton />
{/if}

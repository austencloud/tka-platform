<!--
  Gallery Redesign — test harness for the taxonomy-first "Start here" surface.

  Renders the real <StartHere> (Base-vs-LOOP → element families → real cards from
  canonical TnD decks). "Browse all →" swaps to the real BrowsePanel (the second
  front door). persistKey: null so this harness never touches the real gallery's
  saved state. Real components throughout — no fakes.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import StartHere from "$lib/features/browse/start-here/components/StartHere.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let mode = $state<"start-here" | "browse-all">("start-here");

  const engine = createBrowseEngine({
    persistKey: null,
    initialSource: "community",
    sections: true,
    allowSourceToggle: true,
    sources: ["community", "my-library"],
  });

  onMount(() => {
    engine.initialize();
    return () => engine.destroy();
  });

  function handleSelect(_sequence: SequenceData) {}
</script>

<svelte:head><title>Gallery — Start here · test</title></svelte:head>

<div class="wrap">
  {#if mode === "start-here"}
    <StartHere onBrowseAll={() => (mode = "browse-all")} pool={engine.sequences} />
  {:else}
    <button class="back-to-start" type="button" onclick={() => (mode = "start-here")}>
      ← Start here
    </button>
    <BrowsePanel {engine} layout="fullpage" onSelect={handleSelect} />
  {/if}
</div>

<style>
  .wrap {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--theme-bg, #0b0e16);
    overflow: hidden;
  }
  .wrap :global(.browse-panel) { flex: 1; min-height: 0; }
  .back-to-start {
    align-self: flex-start;
    margin: 0.5rem;
    background: transparent;
    border: 1px solid var(--theme-border, #2a3140);
    color: var(--theme-text, #e8edf6);
    padding: 0.4rem 0.8rem;
    border-radius: 999px;
    cursor: pointer;
  }
</style>

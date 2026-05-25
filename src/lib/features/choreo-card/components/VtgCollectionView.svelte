<script lang="ts">
  import type { Catalog } from "../domain/models/Catalog";
  import VtgFamilyGrid from "./VtgFamilyGrid.svelte";
  import VtgRatioGrid from "./VtgRatioGrid.svelte";
  import VtgReversalGrid from "./VtgReversalGrid.svelte";

  type VtgView = "family" | "ratio" | "reversal";

  interface Props {
    catalogs: Catalog[];
    onSelectCatalog: (catalogId: string) => void;
    onSelectFamily: (familyId: string) => void;
    initialView?: VtgView;
    onViewChange?: (view: VtgView) => void;
  }

  const props: Props = $props();

  // Initialize via $effect.pre - access through props to track initialView reactively
  let activeView = $state<VtgView>("family");
  $effect.pre(() => { activeView = props.initialView ?? "family"; });

  function setView(view: VtgView): void {
    activeView = view;
    props.onViewChange?.(view);
  }

  const continuousCatalogs = $derived(
    props.catalogs.filter(d => !d.reversalPattern || d.reversalPattern === 'continuous')
  );

  function handleSelectPattern(patternId: string): void {
    const matching = props.catalogs.find(d => d.reversalPattern === patternId);
    if (matching) {
      props.onSelectCatalog(matching.id);
    }
  }
</script>

<div class="vtg-collection-view">
  <div class="toggle-bar">
    <button
      type="button"
      class="toggle-pill"
      class:active={activeView === "family"}
      aria-label="Browse by family"
      onclick={() => setView("family")}
    >
      Family
    </button>
    <button
      type="button"
      class="toggle-pill"
      class:active={activeView === "ratio"}
      aria-label="Browse by ratio"
      onclick={() => setView("ratio")}
    >
      Ratio
    </button>
    <button
      type="button"
      class="toggle-pill"
      class:active={activeView === "reversal"}
      aria-label="Browse by reversal"
      onclick={() => setView("reversal")}
    >
      Reversal
    </button>
  </div>

  <div class="grid-content">
    {#if activeView === "family"}
      <VtgFamilyGrid catalogs={continuousCatalogs} onSelectFamily={props.onSelectFamily} />
    {:else if activeView === "ratio"}
      <VtgRatioGrid catalogs={continuousCatalogs} onSelectCatalog={props.onSelectCatalog} />
    {:else}
      <VtgReversalGrid catalogs={props.catalogs} onSelectPattern={handleSelectPattern} />
    {/if}
  </div>
</div>

<style>
  .vtg-collection-view {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .toggle-bar {
    display: flex;
    gap: 8px;
    justify-content: center;
    padding-bottom: 24px;
  }

  .toggle-pill {
    padding: 6px 20px;
    border-radius: 20px;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 150ms ease;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .toggle-pill.active {
    background: var(--loop-accent-bg, rgba(99, 183, 205, 0.2));
    border-color: var(--loop-accent-border, rgba(99, 183, 205, 0.4));
    color: var(--loop-accent, #63b7cd);
  }

  .toggle-pill:not(.active):hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .toggle-pill:focus-visible {
    outline: 2px solid var(--theme-accent, #6c8ee8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-pill {
      transition: none;
    }
  }

  .grid-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
</style>

<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
  import FilterWorkspace from "$lib/features/browse/gallery-home/FilterWorkspace.svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { hydrateSequence as hydrateSequenceData } from "$lib/shared/sequence-viewer/services/sequence-data-provider";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { onDestroy } from "svelte";
  import type { SequenceSource } from "$lib/shared/browse/engine/types";

  interface Props {
    open: boolean;
    onClose: () => void;
    onSelect: (sequence: SequenceData) => void;
    requiredBeatCount?: number | null;
    title?: string;
    showSourceToggle?: boolean;
    initialSource?: SequenceSource;
  }

  let {
    open = $bindable(false),
    onClose,
    onSelect,
    requiredBeatCount = null,
    title = "Select Sequence",
    showSourceToggle = true,
    initialSource = "community",
  }: Props = $props();

  // Engine created once at init. createBrowseEngine registers an internal
  // $effect, so it must run in component-init scope — never inside $derived/
  // $effect (that throws effect_in_teardown when the computation re-runs).
  // Constraints capture the initial prop values, which are fixed per modal open.
  const engine = createBrowseEngine({
    persistKey: null,
    constraints:
      requiredBeatCount != null
        ? [
            {
              type: BrowseFilterType.LENGTH,
              value: requiredBeatCount,
              label: `${requiredBeatCount} steps`,
            },
          ]
        : undefined,
    allowSourceToggle: showSourceToggle,
    sources: ["community", "my-library"],
    initialSource,
  });

  let initialized = $state(false);
  let isSelectingSequence = $state(false);
  let showResults = $state(false);

  $effect(() => {
    if (open && !initialized) {
      engine.initialize();
      initialized = true;
    } else if (open && initialized) {
      engine.refresh();
    }

    if (!open) showResults = false;
  });

  onDestroy(() => engine.destroy());

  async function handleSelect(sequence: SequenceData) {
    isSelectingSequence = true;
    try {
      const fullData = await hydrateSequenceData(sequence);
      onSelect(fullData ?? sequence);
      onClose();
    } finally {
      isSelectingSequence = false;
    }
  }

  function openResults(apply: () => void): void {
    apply();
    showResults = true;
  }
</script>

<BaseModal
  bind:open
  onclose={() => onClose()}
  size="xl"
  class="sequence-picker-modal"
  labelledBy="sequence-picker-title"
>
  {#snippet header()}
    <div class="picker-header">
      <h2 id="sequence-picker-title">{title}</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="picker-body">
    {#if showResults}
      <div class="picker-results">
        <BrowsePanel
          {engine}
          layout="compact"
          onSelect={handleSelect}
          onBack={() => (showResults = false)}
          backLabel="Filters"
          showFilterBar={false}
          hideFilterChips
          {showSourceToggle}
          eager
        />
      </div>
    {:else}
      <FilterWorkspace {engine} onEject={openResults} {resultsPane} />
    {/if}

    {#if isSelectingSequence}
      <div class="loading-overlay">
        <ProgressRing percent={-1} size={40} />
      </div>
    {/if}
  </div>
</BaseModal>

{#snippet resultsPane()}
  <div class="picker-results">
    <BrowsePanel
      {engine}
      layout="compact"
      onSelect={handleSelect}
      showFilterBar={false}
      hideFilterChips
      {showSourceToggle}
      eager
    />
  </div>
{/snippet}

<style>
  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  }

  .picker-header h2 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }

  .close-btn:hover {
    color: var(--theme-text, white);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .picker-body {
    position: relative;
    display: flex;
    height: 60vh;
    min-height: 300px;
    min-width: 0;
  }

  .picker-results {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .picker-results :global(.browse-panel) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10;
    border-radius: inherit;
  }

  /* The picker is a live workspace now. On large displays its filter catalog
   * and sequence grid need room to remain side by side instead of floating as
   * a narrow modal in the middle of the canvas. */
  @media (min-width: 1680px) {
    :global(dialog.base-modal.sequence-picker-modal[data-size="xl"]) {
      width: min(calc(100dvw - 3rem), 112rem);
    }
  }

  @media (min-width: 2600px) {
    :global(dialog.base-modal.sequence-picker-modal[data-size="xl"]) {
      width: min(calc(100dvw - 5rem), 132rem);
    }
  }

  @media (max-width: 520px) {
    /* XL modals are full-screen at the phone seam. The body must consume the
     * space BaseModal leaves beneath its header; a viewport-relative height
     * stranded roughly 40% of an iPhone SE as an empty black band. */
    .picker-body {
      height: 100%;
      min-height: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>

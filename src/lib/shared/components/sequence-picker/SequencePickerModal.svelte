<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { createBrowseEngine } from "$lib/shared/browse/engine/create-browse-engine.svelte";
  import BrowsePanel from "$lib/shared/browse/components/BrowsePanel.svelte";
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

  $effect(() => {
    if (open && !initialized) {
      engine.initialize();
      initialized = true;
    } else if (open && initialized) {
      engine.refresh();
    }
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
</script>

<BaseModal
  bind:open
  onclose={() => onClose()}
  size="xl"
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
    <BrowsePanel
      {engine}
      layout="compact"
      onSelect={handleSelect}
      {showSourceToggle}
      eager
    />

    {#if isSelectingSequence}
      <div class="loading-overlay">
        <ProgressRing percent={-1} size={40} />
      </div>
    {/if}
  </div>
</BaseModal>

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
    height: 60vh;
    min-height: 300px;
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

  @media (prefers-reduced-motion: reduce) {
    .close-btn {
      transition: none;
    }
  }
</style>

<!--
  ActSheet.svelte - Main act editing area

  Shows act details or empty state when no act selected.
-->
<script lang="ts">
  import type { ActData } from "../domain/types/write";
  import ActHeader from "./ActHeader.svelte";
  import SequenceGrid from "./SequenceGrid.svelte";

  interface Props {
    act?: ActData | null;
    disabled?: boolean;
    onActInfoChanged?: (name: string, description: string) => void;
    onMusicLoadRequested?: () => void;
    onSequenceClicked?: (position: number) => void;
    onSequenceRemoveRequested?: (position: number) => void;
  }

  let {
    act = null,
    disabled = false,
    onActInfoChanged,
    onMusicLoadRequested,
    onSequenceClicked,
    onSequenceRemoveRequested,
  }: Props = $props();
</script>

<div class="act-sheet" class:disabled class:empty={!act}>
  {#if act}
    <div class="sheet-header">
      <ActHeader {act} {disabled} {onActInfoChanged} {onMusicLoadRequested} />
    </div>

    <div class="sheet-content">
      <SequenceGrid
        sequences={act.sequences.map(s => s.sequenceData)}
        {onSequenceClicked}
        {onSequenceRemoveRequested}
      />
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fas fa-pen-to-square" aria-hidden="true"></i>
      </div>
      <h3>No Act Selected</h3>
      <p>Select an act from the list or create a new one</p>
    </div>
  {/if}
</div>

<style>
  .act-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-lg, 12px);
    overflow: hidden;
  }

  .act-sheet.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .act-sheet.empty {
    justify-content: center;
    align-items: center;
  }

  .sheet-header {
    flex-shrink: 0;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .sheet-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-xl);
    text-align: center;
    max-width: 300px;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.3));
    font-size: 1.5rem;
  }

  .empty-state h3 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.5;
  }

  /* Scrollbar */
  .sheet-content::-webkit-scrollbar {
    width: 6px;
  }

  .sheet-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }

  .sheet-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;
  }

  @media (max-width: 768px) {
    .sheet-header,
    .sheet-content {
      padding: var(--spacing-sm);
    }
  }
</style>

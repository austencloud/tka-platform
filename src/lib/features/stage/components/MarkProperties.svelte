<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';
  import type { Mark } from '../domain/stage-types';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);

  const selectedPerformer = $derived(
    editMode.selectedPerformerId
      ? choreography.performers.find((p) => p.id === editMode.selectedPerformerId)
      : undefined
  );

  const selectedMark = $derived.by((): Mark | undefined => {
    if (!editMode.selectedMarkId || !selectedPerformer) return undefined;
    return selectedPerformer.marks.find((m) => m.id === editMode.selectedMarkId);
  });

  const markIndex = $derived.by((): number => {
    if (!selectedMark || !selectedPerformer) return -1;
    return selectedPerformer.marks.findIndex((m) => m.id === selectedMark.id);
  });

  function incrementBeats() {
    if (!selectedMark) return;
    stageState.updateMarkBeats(selectedMark.id, selectedMark.beats + 1);
  }

  function decrementBeats() {
    if (!selectedMark) return;
    stageState.updateMarkBeats(selectedMark.id, selectedMark.beats - 1);
  }

  function setWalkStyle(style: 'direct' | 'crab') {
    if (!selectedMark) return;
    stageState.updateMarkWalkStyle(selectedMark.id, style);
  }

  function handleDelete() {
    if (!selectedMark) return;
    const id = selectedMark.id;
    editMode.clearSelection();
    stageState.deleteMark(id);
  }
</script>

{#if selectedPerformer && selectedMark && markIndex > 0}
  <div class="mark-properties" role="region" aria-label="Mark properties">
    <h4 class="mark-header">
      <span class="performer-badge" style="background: {selectedPerformer.color}">
        {selectedPerformer.label}
      </span>
      <span>Mark {markIndex}</span>
    </h4>

    <div class="property-row">
      <span class="property-label">Beats to arrive</span>
      <div class="stepper">
        <button
          type="button"
          class="stepper-btn"
          onclick={decrementBeats}
          disabled={selectedMark.beats <= 1}
          aria-label="Decrease beats"
        >
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <span class="stepper-value" aria-live="polite">{selectedMark.beats}</span>
        <button
          type="button"
          class="stepper-btn"
          onclick={incrementBeats}
          disabled={selectedMark.beats >= 32}
          aria-label="Increase beats"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div class="property-row">
      <span class="property-label">Walk style</span>
      <div class="toggle-group" role="group" aria-label="Walk style">
        <button
          type="button"
          class="toggle-btn"
          class:active={selectedMark.walkStyle === 'direct'}
          aria-pressed={selectedMark.walkStyle === 'direct'}
          onclick={() => setWalkStyle('direct')}
        >Direct</button>
        <button
          type="button"
          class="toggle-btn"
          class:active={selectedMark.walkStyle === 'crab'}
          aria-pressed={selectedMark.walkStyle === 'crab'}
          onclick={() => setWalkStyle('crab')}
        >Crab</button>
      </div>
    </div>

    <div class="property-row">
      <span class="property-label">Position</span>
      <span class="position-value">
        {selectedMark.x.toFixed(1)}m, {selectedMark.z.toFixed(1)}m
      </span>
    </div>

    <button
      type="button"
      class="delete-btn"
      onclick={handleDelete}
      aria-label="Delete mark {markIndex}"
    >
      <i class="fas fa-trash" aria-hidden="true"></i>
      Delete Mark
    </button>
  </div>
{/if}

<style>
  .mark-properties {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .mark-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-text, white);
    margin: 0;
  }

  .performer-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 0.85rem;
    font-weight: 700;
    color: white;
  }

  .property-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .property-label {
    font-size: 0.875rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stepper-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim);
    cursor: pointer;
    transition: all 150ms ease;
    font-size: 0.75rem;
  }

  .stepper-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .stepper-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .stepper-value {
    min-width: 2ch;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--theme-text);
    font-variant-numeric: tabular-nums;
  }

  .toggle-group {
    display: flex;
    gap: 4px;
  }

  .toggle-btn {
    min-width: 48px;
    min-height: 48px;
    padding: 8px 16px;
    border-radius: 8px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .toggle-btn.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: white;
  }

  .toggle-btn:hover:not(.active) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .position-value {
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text);
  }

  .delete-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 10px 16px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    color: var(--semantic-error, #ef4444);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 25%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error, #ef4444) 50%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .stepper-btn,
    .toggle-btn,
    .delete-btn {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import CollapsibleSection from '$lib/features/admin/components/feature-flags/shared/CollapsibleSection.svelte';
  import TransportControls from '$lib/shared/animation-engine/components/controls/TransportControls.svelte';
  import BpmChips from '$lib/shared/animation-engine/components/controls/BpmChips.svelte';
  import FormationSelector from '$lib/shared/3d/components/controls/FormationSelector.svelte';
  import MarkProperties from './MarkProperties.svelte';
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';
  import type { FormationPreset } from '@austencloud/scene-3d';
  import type { FormationPresetId } from '../domain/stage-types';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const isPlaying = $derived(stageState.isPlaying);

  let bpm = $state(120);
  $effect(() => {
    bpm = choreography.bpm;
  });

  function handleBpmChange(newBpm: number) {
    stageState.setBpm(newBpm);
  }

  let activePreset = $state<FormationPreset>('line');

  function handlePresetChange(preset: FormationPreset) {
    activePreset = preset;
    stageState.applyPreset(preset as FormationPresetId);
  }

  function handlePerformerClick(e: MouseEvent, performerId: string) {
    editMode.selectPerformer(performerId, e.shiftKey);
  }
</script>

<aside class="stage-sidebar" aria-label="Stage controls">
  <CollapsibleSection title="Performers" icon="fa-users" defaultOpen={true}>
    {#snippet children()}
      <div class="performer-buttons" role="group" aria-label="Performer selection">
        {#each choreography.performers as performer}
          <button
            type="button"
            class="performer-btn"
            class:selected={editMode.multiSelectedPerformerIds.has(performer.id)}
            style="--performer-color: {performer.color}"
            onclick={(e) => handlePerformerClick(e, performer.id)}
            aria-pressed={editMode.multiSelectedPerformerIds.has(performer.id)}
            aria-label="Select performer {performer.label}"
          >
            {performer.label}
          </button>
        {/each}
      </div>
      <div class="performer-count-controls">
        <button
          type="button"
          class="count-btn"
          onclick={() => stageState.setPerformerCount(choreography.performers.length - 1)}
          disabled={choreography.performers.length <= 2}
          aria-label="Remove performer"
        >
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <span class="count-display" aria-live="polite">{choreography.performers.length}</span>
        <button
          type="button"
          class="count-btn"
          onclick={() => stageState.setPerformerCount(choreography.performers.length + 1)}
          disabled={choreography.performers.length >= 8}
          aria-label="Add performer"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    {/snippet}
  </CollapsibleSection>

  <CollapsibleSection title="Transport" icon="fa-play" defaultOpen={true}>
    {#snippet children()}
      <TransportControls
        {isPlaying}
        onPlaybackToggle={() => stageState.togglePlay()}
        onRestartToStart={() => stageState.seek(0)}
      />
      <div class="bpm-section">
        <BpmChips bind:bpm variant="compact" onBpmChange={handleBpmChange} />
      </div>
    {/snippet}
  </CollapsibleSection>

  <CollapsibleSection title="Formation Presets" icon="fa-shapes" defaultOpen={true}>
    {#snippet children()}
      <FormationSelector
        value={activePreset}
        performerCount={choreography.performers.length}
        onchange={handlePresetChange}
      />
    {/snippet}
  </CollapsibleSection>

  {#if editMode.selectedMarkId}
    <div class="mark-section">
      <MarkProperties {editMode} />
    </div>
  {/if}
</aside>

<style>
  .stage-sidebar {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding: 8px;
  }

  .performer-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .performer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--performer-color) 20%, transparent);
    border: 2px solid color-mix(in srgb, var(--performer-color) 40%, transparent);
    color: var(--performer-color);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .performer-btn.selected {
    background: color-mix(in srgb, var(--performer-color) 40%, transparent);
    border-color: var(--performer-color);
    box-shadow: 0 0 12px color-mix(in srgb, var(--performer-color) 40%, transparent);
  }

  .performer-btn:hover:not(.selected) {
    background: color-mix(in srgb, var(--performer-color) 30%, transparent);
    border-color: color-mix(in srgb, var(--performer-color) 60%, transparent);
  }

  .performer-count-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 8px;
  }

  .count-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 150ms ease;
  }

  .count-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .count-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .count-display {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--theme-text, white);
    font-variant-numeric: tabular-nums;
    min-width: 2ch;
    text-align: center;
  }

  .bpm-section {
    margin-top: 8px;
  }

  .mark-section {
    padding: 12px;
    border-radius: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  @media (prefers-reduced-motion: reduce) {
    .performer-btn,
    .count-btn {
      transition: none;
    }
  }
</style>

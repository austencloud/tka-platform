<!--
  BeatVisualization.svelte - Current Beat Display

  Shows the current beat from the sequence during training.
  Displays pictograph visualization and beat information.
-->
<script lang="ts">
  import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  interface Props {
    beat: StepData | null;
    stepNumber: number;
    totalSteps: number;
    showDetails?: boolean;
  }

  let {
    beat = null,
    stepNumber = 0,
    totalSteps = 0,
    showDetails = true,
  }: Props = $props();

  // Get beat info for display
  const hasStep = $derived(beat !== null);
  const isBlank = $derived(beat?.isBlank ?? false);
</script>

<div class="beat-visualization">
  <!-- Beat counter -->
  <div class="beat-header">
    <span class="beat-counter">Beat {stepNumber} / {totalSteps}</span>
  </div>

  <!-- Pictograph visualization -->
  <div class="pictograph-container">
    {#if hasStep && !isBlank}
      <PictographContainer pictographData={beat} />
    {:else if isBlank}
      <div class="blank-beat">
        <span>Blank Beat</span>
      </div>
    {:else}
      <div class="no-beat">
        <span>No beat data</span>
      </div>
    {/if}
  </div>

  <!-- Beat details (optional) -->
  {#if showDetails && beat}
    <div class="beat-details">
      {#if beat.blueReversal || beat.redReversal}
        <div class="reversals">
          {#if beat.blueReversal}
            <span class="reversal blue">Blue Reversal</span>
          {/if}
          {#if beat.redReversal}
            <span class="reversal red">Red Reversal</span>
          {/if}
        </div>
      {/if}

      {#if beat.motions}
        <div class="positions">
          {#if beat.motions.blue}
            <div class="position-info">
              <span class="label blue">Blue:</span>
              <span class="location">{beat.motions.blue.endLocation}</span>
            </div>
          {/if}
          {#if beat.motions.red}
            <div class="position-info">
              <span class="label red">Red:</span>
              <span class="location">{beat.motions.red.endLocation}</span>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .beat-visualization {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
  }

  .beat-header {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .beat-counter {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pictograph-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
    background: color-mix(in srgb, var(--theme-shadow) 20%, transparent);
    border-radius: 8px;
    padding: 1rem;
  }

  .blank-beat,
  .no-beat {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-size: 1rem;
  }

  .beat-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .reversals {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .reversal {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .reversal.blue {
    background: color-mix(
      in srgb,
      var(--prop-blue, var(--semantic-info)) 20%,
      transparent
    );
    color: var(--prop-blue, var(--semantic-info));
    border: 1px solid
      color-mix(
        in srgb,
        var(--prop-blue, var(--semantic-info)) 30%,
        transparent
      );
  }

  .reversal.red {
    background: color-mix(
      in srgb,
      var(--prop-red, var(--semantic-error)) 20%,
      transparent
    );
    color: var(--prop-red, var(--semantic-error));
    border: 1px solid
      color-mix(
        in srgb,
        var(--prop-red, var(--semantic-error)) 30%,
        transparent
      );
  }

  .positions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .position-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label {
    font-weight: 600;
    min-width: var(--min-touch-target);
  }

  .label.blue {
    color: var(--prop-blue, var(--semantic-info));
  }

  .label.red {
    color: var(--prop-red, var(--semantic-error));
  }

  .location {
    font-family: monospace;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
  }
</style>

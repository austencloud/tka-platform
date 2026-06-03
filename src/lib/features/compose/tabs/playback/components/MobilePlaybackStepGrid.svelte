<!--
  MobilePlaybackStepGrid.svelte

  Lightweight step grid for mobile playback panel.
  Shows sequence steps with playback sync highlighting (golden glow on current beat).
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import TKAGlyph from "$lib/shared/pictograph/tka-glyph/components/TKAGlyph.svelte";

  let {
    sequence = null,
    currentStep = 0,
    isPlaying = false,
  }: {
    sequence: SequenceData | null;
    currentStep: number;
    isPlaying: boolean;
  } = $props();

  // Get steps from sequence (excluding metadata beat at index 0)
  const steps = $derived(() => {
    if (!sequence?.steps) return [];
    // Skip first beat (metadata) if present
    return sequence.steps.slice(1);
  });

  // Calculate grid columns based on beat count
  const gridColumns = $derived(() => {
    const count = steps().length;
    if (count <= 4) return count || 1;
    if (count <= 8) return 4;
    if (count <= 12) return 4;
    return 5;
  });
</script>

<div class="mobile-step-grid">
  {#if steps().length === 0}
    <div class="empty-state">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      <span>{t("empty_no_sequence_loaded")}</span>
    </div>
  {:else}
    <div class="step-grid" style:--grid-cols={gridColumns()}>
      {#each steps() as step, index}
        {@const stepNumber = index + 1}
        {@const isCurrentStep = isPlaying && currentStep === stepNumber}
        <div
          class="step-cell"
          class:current={isCurrentStep}
          class:played={isPlaying && currentStep > stepNumber}
        >
          <div class="step-content">
            <TKAGlyph pictographData={step} letter={step?.letter} />
          </div>
          <span class="step-number">{stepNumber}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .mobile-step-grid {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    overflow: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.4);
    font-size: 0.85rem;
  }

  .empty-state i {
    font-size: 1.5rem;
    opacity: 0.6;
  }

  .step-grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols), 1fr);
    gap: 4px;
    width: 100%;
    max-width: 400px;
  }

  .step-cell {
    position: relative;
    aspect-ratio: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast) ease;
    overflow: hidden;
  }

  .step-cell.current {
    border-color: rgba(251, 191, 36, 0.8);
    box-shadow:
      0 0 12px rgba(251, 191, 36, 0.4),
      0 0 24px rgba(251, 191, 36, 0.2),
      inset 0 0 8px rgba(251, 191, 36, 0.1);
    background: rgba(251, 191, 36, 0.08);
  }

  .step-cell.played {
    opacity: 0.5;
  }

  .step-content {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }

  .step-number {
    position: absolute;
    bottom: 2px;
    right: 4px;
    font-size: 0.65rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.35);
    font-variant-numeric: tabular-nums;
  }

  .step-cell.current .step-number {
    color: rgba(251, 191, 36, 0.9);
  }
</style>

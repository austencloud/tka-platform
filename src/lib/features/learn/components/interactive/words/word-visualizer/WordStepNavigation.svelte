<!--
WordStepNavigation - Beat navigation dots for letter sequence
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import type { LetterDefinition } from "../../../../domain/constants/word-visualizer-data";

  let {
    letters,
    currentStepIndex,
    showStepNumber = true,
    compact = false,
    onStepChange,
  }: {
    letters: LetterDefinition[];
    currentStepIndex: number;
    showStepNumber?: boolean;
    compact?: boolean;
    onStepChange: (index: number) => void;
  } = $props();

  const hapticService = container.items.hapticFeedback as IHapticFeedback;

  function goToStep(index: number) {
    hapticService?.trigger("selection");
    onStepChange(index);
  }
</script>

<div class="beat-navigation">
  {#each letters as letter, i}
    <button
      class="beat-dot"
      class:active={i === currentStepIndex}
      class:compact
      onclick={() => goToStep(i)}
      aria-label="Beat {i + 1}: {letter.letter}"
    >
      {#if showStepNumber}
        <span class="beat-number">{i + 1}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .beat-navigation {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .beat-dot {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 2px solid var(--theme-stroke-strong);
    border-radius: 50%;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    color: var(--theme-text-dim);
    font-size: 0.75rem;
    font-weight: 600;
  }

  .beat-dot.compact {
    width: 24px;
    height: 24px;
    font-size: 0.625rem;
  }

  .beat-dot:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.1);
  }

  .beat-dot.active {
    background: rgba(34, 211, 238, 0.25);
    border-color: rgba(34, 211, 238, 0.6);
    color: #22d3ee;
  }

  .beat-number {
    line-height: 1;
  }
</style>

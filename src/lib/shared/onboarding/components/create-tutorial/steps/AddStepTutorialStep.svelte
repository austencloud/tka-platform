<!--
  AddStepTutorialStep - Step 2 of the create tutorial

  Shows available next steps via the OptionPicker after the user picked a start position.
  The user picks 4 steps total. Each pick updates the sequence and refreshes options.
  Auto-advances to the next wizard step after the 4th step.
-->
<script lang="ts">
  import {
    createTutorialState,
    REQUIRED_STEPS,
  } from "../../../state/create-tutorial-state.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import {
    getLetterType,
    type Letter,
  } from "$lib/shared/foundation/domain/models/letter";
  import { LetterType } from "$lib/shared/foundation/domain/models/letter-type";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  // The full sequence so far: start position + all steps picked
  const currentSequence = $derived<PictographData[]>(
    createTutorialState.sequence
  );

  const stepCount = $derived(createTutorialState.steps.length);

  // Use the grid mode stored when the start position was picked
  const currentGridMode = $derived(createTutorialState.gridMode);

  function handleOptionSelected(option: PictographData) {
    createTutorialState.addStep(option);
    if (createTutorialState.stepsRemaining <= 0) {
      onAdvance();
    }
  }

  // Tutorial shows only Type 1 (dual-shift) options, presented as the whole set.
  function isType1(option: PictographData): boolean {
    return (
      !!option.letter &&
      getLetterType(option.letter as Letter) === LetterType.TYPE1
    );
  }
</script>

<div class="tutorial-step">
  <div class="step-header">
    <h1 class="title">Add step {stepCount + 1} of {REQUIRED_STEPS}</h1>
    <p class="subtitle">Tap a step to add it.</p>
  </div>

  <div class="picker-container">
    {#if currentSequence.length > 0}
      {#await import("$lib/features/create/construct/option-picker/components/OptionPicker.svelte") then mod}
        <mod.default
          {currentSequence}
          {currentGridMode}
          onOptionSelected={handleOptionSelected}
          filterPredicate={isType1}
          hideFilters
        />
      {/await}
    {:else}
      <p class="loading">Loading options...</p>
    {/if}
  </div>
</div>

<style>
  .tutorial-step {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    max-width: 780px;
    width: 100%;
    text-align: center;
    padding: 20px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-radius: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .picker-container {
    width: 100%;
    height: clamp(300px, 55vh, 600px);
  }

  .loading {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9rem;
    padding: 40px 0;
  }

  @media (max-width: 640px) {
    .picker-container {
      height: clamp(340px, 62vh, 560px);
    }
  }

  @media (max-width: 480px) {
    .tutorial-step {
      padding: 12px;
      gap: 8px;
    }
    .title {
      font-size: 1.25rem;
    }
    .picker-container {
      height: clamp(360px, 68vh, 560px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tutorial-step {
      transition: none;
    }
  }
</style>

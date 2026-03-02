<!--
  AddBeatStep - Step 2 of the create tutorial

  Shows available next beats via the OptionPicker after the user picked a start position.
  Auto-advances when the user taps an option (no Continue button needed).
-->
<script lang="ts">
  import OptionPicker from "$lib/features/create/construct/option-picker/components/OptionPicker.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { createTutorialState } from "../../../state/create-tutorial-state.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  // Build the current sequence from tutorial state (just the start position at this point)
  const currentSequence = $derived<PictographData[]>(
    createTutorialState.startPosition
      ? [createTutorialState.startPosition]
      : []
  );

  // Use the grid mode from the start position, or default to DIAMOND
  const currentGridMode = $derived(
    createTutorialState.startPosition?.gridMode ?? GridMode.DIAMOND
  );

  function handleOptionSelected(option: PictographData) {
    createTutorialState.setSelectedBeat(option);
    onAdvance();
  }
</script>

<div class="tutorial-step">
  <h1 class="title">Add a beat</h1>
  <p class="subtitle">These are your options. Tap one to add it to your sequence.</p>

  <div class="picker-container">
    {#if currentSequence.length > 0}
      <OptionPicker
        {currentSequence}
        {currentGridMode}
        onOptionSelected={handleOptionSelected}
      />
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
    max-width: 560px;
    width: 100%;
    text-align: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-size: 1.4rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .subtitle {
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .picker-container {
    width: 100%;
    min-height: 200px;
  }

  .loading {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9rem;
    padding: 40px 0;
  }

  @media (max-width: 480px) {
    .tutorial-step {
      padding: 16px;
      gap: 10px;
    }
    .title {
      font-size: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tutorial-step {
      transition: none;
    }
  }
</style>

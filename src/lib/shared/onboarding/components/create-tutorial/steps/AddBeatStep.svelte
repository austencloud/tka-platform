<!--
  AddBeatStep - Step 2 of the create tutorial

  Shows available next beats via the OptionPicker after the user picked a start position.
  The user picks 4 beats total. Each pick updates the sequence and refreshes options.
  Auto-advances to the next wizard step after the 4th beat.
-->
<script lang="ts">
  import OptionPicker from "$lib/features/create/construct/option-picker/components/OptionPicker.svelte";
  import {
    createTutorialState,
    REQUIRED_BEATS,
  } from "../../../state/create-tutorial-state.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  // The full sequence so far: start position + all beats picked
  const currentSequence = $derived<PictographData[]>(
    createTutorialState.sequence
  );

  const beatCount = $derived(createTutorialState.beats.length);
  const beatsRemaining = $derived(createTutorialState.beatsRemaining);
  const isLastBeat = $derived(beatsRemaining === 1);

  // Use the grid mode stored when the start position was picked
  const currentGridMode = $derived(createTutorialState.gridMode);

  // On the last beat, only show options that loop back to the start position
  // so the user's first sequence is a seamless loop.
  const loopFilter = $derived.by(() => {
    if (!isLastBeat) return undefined;

    const startPos = createTutorialState.startPosition;
    if (!startPos) return undefined;

    const targetPosition = startPos.startPosition;
    const targetBlueOri = startPos.motions?.blue?.startOrientation;
    const targetRedOri = startPos.motions?.red?.startOrientation;

    return (option: PictographData): boolean => {
      if (option.endPosition !== targetPosition) return false;

      // Also match orientations so the loop is seamless
      if (targetBlueOri && option.motions?.blue?.endOrientation !== targetBlueOri) return false;
      if (targetRedOri && option.motions?.red?.endOrientation !== targetRedOri) return false;

      return true;
    };
  });

  function handleOptionSelected(option: PictographData) {
    createTutorialState.addBeat(option);
    if (createTutorialState.beatsRemaining <= 0) {
      onAdvance();
    }
  }
</script>

<div class="tutorial-step">
  <h1 class="title">Add beat {beatCount + 1} of {REQUIRED_BEATS}</h1>
  <p class="subtitle">
    {#if beatsRemaining > 1}
      Pick a move. {beatsRemaining} beats left.
    {:else}
      Pick a move that loops back to your start position.
    {/if}
  </p>

  <div class="picker-container">
    {#if currentSequence.length > 0}
      <OptionPicker
        {currentSequence}
        {currentGridMode}
        onOptionSelected={handleOptionSelected}
        filterPredicate={loopFilter}
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

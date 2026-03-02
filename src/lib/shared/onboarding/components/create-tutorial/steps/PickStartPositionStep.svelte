<!--
  PickStartPositionStep - Step 1 of the create tutorial

  Embeds the real StartPositionPicker so the user can tap a starting position.
  Auto-advances when a position is selected (no Continue button needed).
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import StartPositionPicker from "$lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte";
  import { createSimplifiedStartPositionState } from "$lib/features/create/construct/start-position-picker/state/start-position-state.svelte";
  import { createTutorialState } from "../../../state/create-tutorial-state.svelte";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  // Create a local start position state for the picker
  const startPositionState = createSimplifiedStartPositionState();
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Listen for user position selection
    unsubscribe = startPositionState.onSelectedPositionChange(
      (position, source) => {
        if (source === "user" && position) {
          // Store in tutorial state and advance
          createTutorialState.setStartPosition(position);
          onAdvance();
        }
      }
    );
  });

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<div class="tutorial-step">
  <h1 class="title">Pick a starting position</h1>
  <p class="subtitle">Every sequence begins with a position. Tap one.</p>

  <div class="picker-container">
    <StartPositionPicker {startPositionState} />
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

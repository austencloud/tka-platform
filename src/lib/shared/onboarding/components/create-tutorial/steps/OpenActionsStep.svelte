<!--
  OpenActionsStep - Step 3 of the create tutorial

  Shows the sequence the user built (start position + beat) and a green
  Sequence Actions button. Tapping the button advances to the next step.
-->
<script lang="ts">
  import SequenceActionsButton from "$lib/features/create/shared/workspace-panel/shared/components/buttons/SequenceActionsButton.svelte";
  import { createTutorialState } from "../../../state/create-tutorial-state.svelte";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();
</script>

<div class="tutorial-step">
  <h1 class="title">Open sequence actions</h1>
  <p class="subtitle">
    Tap the green button to see what you can do with your sequence.
  </p>

  <div class="sequence-display">
    {#each createTutorialState.sequence as _step, i}
      <div class="sequence-beat" class:start={i === 0}>
        <span class="beat-label">{i === 0 ? "Start" : `Beat ${i}`}</span>
        <div class="beat-thumbnail">
          <i
            class="fas {i === 0 ? 'fa-crosshairs' : 'fa-plus'}"
            aria-hidden="true"
          ></i>
        </div>
      </div>
      {#if i < createTutorialState.sequence.length - 1}
        <div class="arrow">
          <i class="fas fa-chevron-right" aria-hidden="true"></i>
        </div>
      {/if}
    {/each}
  </div>

  <div class="action-area">
    <SequenceActionsButton onclick={onAdvance} />
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

  .sequence-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    width: 100%;
  }

  .sequence-beat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .beat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .beat-thumbnail {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.1rem;
  }

  .start .beat-thumbnail {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 40%,
      transparent
    );
    color: var(--theme-accent, #8b5cf6);
  }

  .arrow {
    color: rgba(255, 255, 255, 0.25);
    font-size: 0.85rem;
    margin-top: 18px;
  }

  .action-area {
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }

  @media (max-width: 480px) {
    .tutorial-step {
      padding: 16px;
      gap: 10px;
    }
    .title {
      font-size: 1.25rem;
    }
    .beat-thumbnail {
      width: 48px;
      height: 48px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tutorial-step {
      transition: none;
    }
  }
</style>

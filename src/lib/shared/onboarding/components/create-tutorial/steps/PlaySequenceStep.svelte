<!--
  PlaySequenceStep - Step 4 of the create tutorial

  Shows a Preview button that plays a simple step-through animation
  highlighting each beat in the sequence, then auto-advances.
-->
<script lang="ts">
  import { createTutorialState } from "../../../state/create-tutorial-state.svelte";

  interface Props {
    onAdvance: () => void;
  }

  const { onAdvance }: Props = $props();

  let isPlaying = $state(false);
  let activeIndex = $state(-1);

  function handlePreview() {
    if (isPlaying) return;
    isPlaying = true;
    activeIndex = 0;

    const sequence = createTutorialState.sequence;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (step >= sequence.length) {
        clearInterval(interval);
        setTimeout(() => {
          isPlaying = false;
          activeIndex = -1;
          onAdvance();
        }, 800);
      } else {
        activeIndex = step;
      }
    }, 1000);
  }
</script>

<div class="tutorial-step">
  <h1 class="title">Play it back</h1>
  <p class="subtitle">Tap Preview to watch your sequence animate.</p>

  <div class="sequence-display">
    {#each createTutorialState.sequence as _step, i}
      <div
        class="sequence-beat"
        class:active={activeIndex === i}
        class:start={i === 0}
      >
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

  {#if !isPlaying}
    <button class="preview-button" onclick={handlePreview}>
      <i class="fas fa-play" aria-hidden="true"></i>
      Preview
    </button>
  {:else}
    <div class="playing-indicator">
      <i class="fas fa-circle playing-dot" aria-hidden="true"></i>
      Playing...
    </div>
  {/if}
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
    transition: transform 0.3s ease;
  }

  .beat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    transition: color 0.3s ease;
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
    transition:
      border-color 0.3s ease,
      box-shadow 0.3s ease,
      transform 0.3s ease;
  }

  .start .beat-thumbnail {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 40%,
      transparent
    );
    color: var(--theme-accent, #8b5cf6);
  }

  .active .beat-thumbnail {
    border-color: var(--semantic-success, #22c55e);
    box-shadow: 0 0 16px
        color-mix(in srgb, var(--semantic-success, #22c55e) 50%, transparent),
      0 0 32px
        color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent);
    transform: scale(1.1);
  }

  .active .beat-label {
    color: var(--semantic-success, #22c55e);
  }

  .arrow {
    color: rgba(255, 255, 255, 0.25);
    font-size: 0.85rem;
    margin-top: 18px;
  }

  .preview-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 32px;
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 30%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--semantic-success, #22c55e) 50%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preview-button:hover {
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 40%,
      transparent
    );
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--semantic-success, #22c55e) 30%, transparent);
  }

  .preview-button:active {
    transform: scale(0.97);
  }

  .preview-button:focus-visible {
    outline: 2px solid var(--semantic-success, #22c55e);
    outline-offset: 2px;
  }

  .playing-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--semantic-success, #22c55e);
    font-size: 0.95rem;
    font-weight: 600;
    padding: 14px 0;
  }

  .playing-dot {
    font-size: 0.5rem;
    animation: pulse-dot 1s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
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
    .preview-button {
      padding: 12px 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tutorial-step,
    .sequence-beat,
    .beat-thumbnail,
    .beat-label,
    .preview-button {
      transition: none;
    }

    .active .beat-thumbnail {
      transform: none;
    }

    .playing-dot {
      animation: none;
      opacity: 1;
    }
  }
</style>

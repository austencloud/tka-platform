<!--
  TransformExample.svelte

  Interactive pictograph example for a transform.
  Shows ONE pictograph that transforms in-place when button is clicked.
-->
<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

  interface Props {
    pictograph: PictographData | null;
    color: string;
    isRotate?: boolean;
    isLoading?: boolean;
    onTransform: () => void;
    onRotate?: (direction: "cw" | "ccw") => void;
    onShuffle: () => void;
  }

  let {
    pictograph,
    color,
    isRotate = false,
    isLoading = false,
    onTransform,
    onRotate,
    onShuffle,
  }: Props = $props();
</script>

<div class="example-section" style="--help-color: {color}">
  <div class="example-label" id="example-label">Try it:</div>
  <div class="example-content" aria-labelledby="example-label">
    <div class="pictograph-box">
      {#if isLoading}
        <div class="pictograph-loading" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <span class="sr-only">Loading pictograph example...</span>
        </div>
      {:else if pictograph}
        <div class="pictograph-wrapper">
          <PictographContainer pictographData={pictograph} />
        </div>
      {:else}
        <div class="pictograph-empty" aria-hidden="true">
          <i class="fas fa-image" aria-hidden="true"></i>
        </div>
      {/if}
    </div>

    <div class="action-buttons" role="group" aria-label="Transform controls">
      {#if isRotate && onRotate}
        <button
          class="transform-btn"
          onclick={() => onRotate("ccw")}
          disabled={!pictograph || isLoading}
          aria-label="Rotate counter-clockwise"
        >
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
        </button>
        <button
          class="transform-btn"
          onclick={() => onRotate("cw")}
          disabled={!pictograph || isLoading}
          aria-label="Rotate clockwise"
        >
          <i class="fas fa-rotate-right" aria-hidden="true"></i>
        </button>
      {:else}
        <button
          class="transform-btn"
          onclick={onTransform}
          disabled={!pictograph || isLoading}
          aria-label="Apply transform"
        >
          <i class="fas fa-play" aria-hidden="true"></i>
        </button>
      {/if}
      <button
        class="shuffle-btn"
        onclick={onShuffle}
        disabled={isLoading}
        aria-label="Get new random pictograph"
      >
        <i class="fas fa-shuffle" aria-hidden="true"></i>
      </button>
    </div>
  </div>
  <p class="example-hint">Tap to see the effect. Shuffle for a new example.</p>
</div>

<style>
  /* Screen reader only - visually hidden but accessible */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .example-section {
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .example-label {
    font-size: 0.7rem;
    color: var(--theme-text-dim); /* WCAG AA: increased from 0.4 */
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }

  .example-content {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }

  .pictograph-box {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pictograph-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.3);
    overflow: hidden;
    transition: transform var(--duration-normal) ease;
  }

  .pictograph-wrapper:active {
    transform: scale(0.95);
  }

  .pictograph-wrapper :global(svg) {
    width: 100%;
    height: 100%;
  }

  .pictograph-loading,
  .pictograph-empty {
    width: 80px;
    height: 80px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim); /* Improved contrast for WCAG AAA */
    font-size: var(--font-size-xl);
  }

  .pictograph-loading {
    color: var(--help-color);
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .transform-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--help-color);
    border: none;
    color: white;
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all var(--duration-fast) ease;
  }

  .transform-btn:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 2px 12px
      color-mix(in srgb, var(--help-color) 50%, transparent);
  }

  .transform-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .transform-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .transform-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .shuffle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all var(--duration-fast) ease;
  }

  .shuffle-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: var(--theme-text);
  }

  .shuffle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .shuffle-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .example-hint {
    margin: 8px 0 0;
    font-size: 0.7rem;
    color: var(--theme-text-dim); /* WCAG AA: increased from 0.35 */
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .transform-btn:hover:not(:disabled),
    .transform-btn:active:not(:disabled),
    .pictograph-wrapper:active {
      transform: none;
    }
  }
</style>

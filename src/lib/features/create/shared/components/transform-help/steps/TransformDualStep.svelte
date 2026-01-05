<!--
  TransformDualStep.svelte

  Shows a dual-motion pictograph that animates when the transform is applied.
  Clicking Apply toggles the transform back and forth.
-->
<script lang="ts">
  import type { TransformHelpItem } from "../../../domain/transforms/transform-help-content";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { getRandomDualMotionPictographForTransform } from "../../../domain/transforms/pictograph-example-loader";
  import {
    applyMirror,
    applyFlip,
    applyInvert,
    applyRotate,
    applySwap,
    applyRewind,
  } from "../../../domain/transforms/transform-functions";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";

  type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";

  interface Props {
    transformId: TransformId;
    transform: TransformHelpItem;
  }

  let { transformId, transform }: Props = $props();

  let displayedPictograph = $state<PictographData | null>(null);
  let isLoading = $state(true);

  // Load initial example
  $effect(() => {
    loadExample();
  });

  async function loadExample() {
    isLoading = true;
    displayedPictograph = await getRandomDualMotionPictographForTransform(transformId);
    isLoading = false;
  }

  function applyTransform() {
    if (!displayedPictograph) return;

    switch (transformId) {
      case "mirror":
        displayedPictograph = applyMirror(displayedPictograph);
        break;
      case "flip":
        displayedPictograph = applyFlip(displayedPictograph);
        break;
      case "invert":
        displayedPictograph = applyInvert(displayedPictograph);
        break;
      case "rotate":
        displayedPictograph = applyRotate(displayedPictograph, "cw");
        break;
      case "swap":
        displayedPictograph = applySwap(displayedPictograph);
        break;
      case "rewind":
        displayedPictograph = applyRewind(displayedPictograph);
        break;
    }
  }

  // Get context-specific explanation for dual-motion
  const explanation = $derived(() => {
    switch (transformId) {
      case "mirror":
        return "Watch both hands swap horizontal positions. Click repeatedly to toggle.";
      case "flip":
        return "Both hands flip vertically. Click repeatedly to toggle.";
      case "invert":
        return "Both hands reverse rotation. Click repeatedly to toggle.";
      case "rotate":
        return "The whole pattern rotates 90° each click.";
      case "swap":
        return "Blue becomes red, red becomes blue. Click repeatedly to toggle.";
      case "rewind":
        return "Both hands swap their start/end positions. Click repeatedly to toggle.";
      default:
        return "Click to see the transform in action.";
    }
  });
</script>

<div class="dual-step">
  <h3 class="step-title">Both Hands Together</h3>
  <p class="step-desc">{explanation()}</p>

  <!-- Animated pictograph -->
  <div class="example-container">
    <div
      class="pictograph-frame"
      style:--transform-color={transform.color}
    >
      {#if isLoading}
        <div class="loading-state">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        </div>
      {:else if displayedPictograph}
        <PictographContainer pictographData={displayedPictograph} />
      {:else}
        <div class="empty-state">
          <i class="fas fa-image" aria-hidden="true"></i>
        </div>
      {/if}
    </div>
  </div>

  <!-- Action buttons -->
  <div class="action-buttons">
    <button
      class="action-btn apply"
      onclick={applyTransform}
      disabled={isLoading}
      style:--transform-color={transform.color}
    >
      <i class="fas {transform.icon}" aria-hidden="true"></i>
      <span>Apply {transform.name}</span>
    </button>

    <button
      class="action-btn shuffle"
      onclick={loadExample}
      disabled={isLoading}
    >
      <i class="fas fa-shuffle" aria-hidden="true"></i>
      <span>New Example</span>
    </button>
  </div>

  <!-- Dual-motion note -->
  <div class="note-box">
    <i class="fas fa-hands" aria-hidden="true"></i>
    <span>This example uses both hands</span>
  </div>
</div>

<style>
  .dual-step {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .step-desc {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.7);
  }

  .example-container {
    display: flex;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
  }

  .pictograph-frame {
    width: 200px;
    height: 200px;
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .loading-state,
  .empty-state {
    font-size: var(--font-size-2xl, 24px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .loading-state i {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .action-btn.apply {
    background: var(--transform-color, #3b82f6);
    color: white;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .action-btn.apply:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .action-btn.apply:disabled,
  .action-btn.shuffle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.shuffle {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .action-btn.shuffle:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .note-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
  }

  .note-box i {
    color: #60a5fa;
  }

  @media (prefers-reduced-motion: reduce) {
    .action-btn { transition: none; }
  }

  @media (max-width: 480px) {
    .pictograph-frame {
      width: 160px;
      height: 160px;
    }
  }
</style>

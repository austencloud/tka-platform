<!--
  RewindTimelineStep.svelte

  Animated timeline visualization showing how rewind reverses beat order.
  Specific to the rewind transform - shows beats sliding to new positions.
-->
<script lang="ts">
  import type { TransformHelpItem } from "../../../domain/transforms/transform-help-content";

  interface Props {
    transform: TransformHelpItem;
  }

  let { transform }: Props = $props();

  // Animation state
  let animationPhase = $state<"initial" | "animating" | "complete">("initial");
  let showExplanation = $state(false);

  // Beat labels for visualization
  const originalBeats = ["Start", "1", "2", "3", "4"];
  const rewindedBeats = ["4-End", "4↩", "3↩", "2↩", "1↩"];

  function startAnimation() {
    animationPhase = "animating";

    // After animation completes, show final state
    setTimeout(() => {
      animationPhase = "complete";
      showExplanation = true;
    }, 1200);
  }

  function resetAnimation() {
    animationPhase = "initial";
    showExplanation = false;
  }
</script>

<div class="timeline-step">
  <h3 class="step-title">How Rewind Works</h3>
  <p class="step-desc">
    Rewind plays your sequence backwards - the last beat becomes the first.
  </p>

  <!-- Timeline visualization -->
  <div class="timeline-container">
    <!-- Original sequence -->
    <div class="timeline-row" class:faded={animationPhase === "complete"}>
      <div class="row-label">Original</div>
      <div class="beat-track">
        {#each originalBeats as beat, i}
          <div
            class="beat-box"
            class:start={i === 0}
            class:animating={animationPhase === "animating"}
            style:--delay={i * 0.1}s
          >
            <span class="beat-number">{beat}</span>
          </div>
          {#if i < originalBeats.length - 1}
            <div class="arrow-connector">
              <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Rewind indicator -->
    <div
      class="rewind-indicator"
      class:visible={animationPhase === "animating" || animationPhase === "complete"}
    >
      <div class="rewind-arrow">
        <i class="fas fa-rotate-left" aria-hidden="true"></i>
        <span>Rewind</span>
      </div>
    </div>

    <!-- Rewinded sequence -->
    <div
      class="timeline-row result"
      class:visible={animationPhase === "animating" || animationPhase === "complete"}
    >
      <div class="row-label">Rewinded</div>
      <div class="beat-track">
        {#each rewindedBeats as beat, i}
          <div
            class="beat-box rewinded"
            class:start={i === 0}
            class:animating={animationPhase === "animating"}
            style:--delay={(rewindedBeats.length - 1 - i) * 0.1}s
          >
            <span class="beat-number">{beat}</span>
          </div>
          {#if i < rewindedBeats.length - 1}
            <div class="arrow-connector">
              <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <!-- Explanation panel -->
  {#if showExplanation}
    <div class="explanation-panel">
      <div class="explanation-item">
        <i class="fas fa-exchange-alt" aria-hidden="true"></i>
        <span>Beat order reverses: 1→2→3→4 becomes 4→3→2→1</span>
      </div>
      <div class="explanation-item">
        <i class="fas fa-sync-alt" aria-hidden="true"></i>
        <span>Turn directions flip: clockwise ↔ counter-clockwise</span>
      </div>
      <div class="explanation-item">
        <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
        <span>End position becomes the new start position</span>
      </div>
    </div>
  {/if}

  <!-- Action buttons -->
  <div class="action-buttons">
    {#if animationPhase === "initial"}
      <button
        class="action-btn play"
        onclick={startAnimation}
        style:--transform-color={transform.color}
      >
        <i class="fas fa-play" aria-hidden="true"></i>
        <span>Play Animation</span>
      </button>
    {:else}
      <button class="action-btn reset" onclick={resetAnimation}>
        <i class="fas fa-redo" aria-hidden="true"></i>
        <span>Replay</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .timeline-step {
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

  /* Timeline container */
  .timeline-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
  }

  .timeline-row {
    display: flex;
    align-items: center;
    gap: 12px;
    transition: opacity 0.3s ease;
  }

  .timeline-row.faded {
    opacity: 0.4;
  }

  .timeline-row.result {
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.4s ease,
      transform 0.4s ease;
  }

  .timeline-row.result.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .row-label {
    width: 70px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
    flex-shrink: 0;
  }

  .beat-track {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .beat-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 8px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    transition: all 0.3s ease;
  }

  .beat-box.start {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .beat-box.rewinded {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .beat-box.rewinded.start {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .beat-box.animating {
    animation: beat-pop 0.4s ease calc(var(--delay) + 0.3s) both;
  }

  @keyframes beat-pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
    }
  }

  .beat-number {
    font-size: var(--font-size-compact, 12px);
  }

  .arrow-connector {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.3);
    font-size: 10px;
  }

  /* Rewind indicator */
  .rewind-indicator {
    display: flex;
    justify-content: center;
    opacity: 0;
    transform: scale(0.8);
    transition:
      opacity 0.3s ease,
      transform 0.3s ease;
  }

  .rewind-indicator.visible {
    opacity: 1;
    transform: scale(1);
  }

  .rewind-arrow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 20px;
    color: #f87171;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
  }

  .rewind-arrow i {
    animation: spin-reverse 0.8s ease;
  }

  @keyframes spin-reverse {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(-360deg);
    }
  }

  /* Explanation panel */
  .explanation-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 10px;
    animation: fade-in 0.4s ease;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .explanation-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.75);
  }

  .explanation-item i {
    color: #60a5fa;
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  /* Action buttons */
  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .action-btn.play {
    background: var(--transform-color, #ef4444);
    color: white;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
  }

  .action-btn.play:hover {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  }

  .action-btn.reset {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .action-btn.reset:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  @media (prefers-reduced-motion: reduce) {
    .timeline-row,
    .rewind-indicator,
    .beat-box,
    .explanation-panel,
    .action-btn {
      transition: none;
    }

    .beat-box.animating,
    .rewind-arrow i {
      animation: none;
    }
  }

  /* Mobile adjustments */
  @media (max-width: 480px) {
    .beat-box {
      width: 36px;
      height: 36px;
    }

    .beat-number {
      font-size: 10px;
    }

    .row-label {
      width: 60px;
      font-size: 10px;
    }
  }
</style>

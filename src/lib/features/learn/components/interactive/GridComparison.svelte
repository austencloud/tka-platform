<!--
GridComparison - Side-by-side view of Diamond and Box grids
Shows both grids simultaneously for comparison
-->
<script lang="ts">
  import GridVisualizer from "./GridVisualizer.svelte";

  let showMerged = $state(false);
  let isAnimating = $state(false);

  async function handleMergeAnimation() {
    if (isAnimating) return;

    isAnimating = true;

    // Animate the merge
    await new Promise((resolve) => setTimeout(resolve, 600));
    showMerged = true;

    isAnimating = false;
  }

  function handleSplit() {
    showMerged = false;
  }
</script>

<div class="grid-comparison">
  <!-- Header -->
  <div class="comparison-header">
    <h2 class="comparison-title">Grid Modes: Diamond vs Box</h2>
    <p class="comparison-subtitle">
      The Kinetic Alphabet uses a 4-point grid system. There are two modes:
      Diamond and Box.
    </p>
  </div>

  <!-- Grid views -->
  {#if !showMerged}
    <div class="grids-side-by-side" class:animating={isAnimating}>
      <div class="grid-panel left" class:animating={isAnimating}>
        <GridVisualizer mode="diamond" />
        <div class="grid-description">
          <h4>💎 Diamond Grid</h4>
          <p>
            Points arranged in a diamond pattern. <strong
              >Easier for beginners!</strong
            >
          </p>
          <p>Most practitioners prefer diamond mode for its intuitive flow.</p>
        </div>
      </div>

      <div class="grid-panel right" class:animating={isAnimating}>
        <GridVisualizer mode="box" />
        <div class="grid-description">
          <h4>📦 Box Grid</h4>
          <p>Points arranged in a square/box pattern.</p>
          <p>Everything in TKA translates between both modes.</p>
        </div>
      </div>
    </div>

    <!-- Merge button -->
    <div class="action-section">
      <button
        class="merge-button"
        onclick={handleMergeAnimation}
        disabled={isAnimating}
      >
        <span class="button-icon">✨</span>
        <span class="button-text">
          {isAnimating ? "Merging..." : "Show 8-Point Grid"}
        </span>
        <span class="button-icon">✨</span>
      </button>
      <p class="action-hint">
        See how diamond and box combine to form the 8-point grid!
      </p>
    </div>
  {:else}
    <!-- Merged view -->
    <div class="merged-view">
      <GridVisualizer mode="merged" />

      <div class="merged-explanation">
        <h3>🌟 The 8-Point Grid</h3>
        <p>
          When you combine Diamond (4 points) and Box (4 points), you get the
          complete
          <strong>8-point grid</strong>.
        </p>
        <p>
          This expanded grid gives you even more possibilities for complex
          patterns and transitions!
        </p>

        <button class="split-button" onclick={handleSplit}>
          ← Back to Comparison
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .grid-comparison {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .comparison-header {
    text-align: center;
    padding: 1rem 0;
  }

  .comparison-title {
    font-size: 1.75rem;
    font-weight: 800;
    color: white;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #4a9eff, #ff4a9e);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .comparison-subtitle {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0;
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .grids-side-by-side {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .grids-side-by-side.animating {
    opacity: 0.5;
    transform: scale(0.95);
  }

  .grid-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .grid-panel.animating {
    filter: blur(4px);
  }

  .grid-description {
    padding: 1rem;
    background: var(--theme-card-bg);
    border-left: 3px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
  }

  .grid-description h4 {
    font-size: 1.125rem;
    font-weight: 700;
    color: white;
    margin: 0 0 0.5rem 0;
  }

  .grid-description p {
    font-size: 0.9375rem;
    color: rgba(255, 255, 255, 0.8);
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .grid-description p:last-child {
    margin-bottom: 0;
  }

  .action-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem 1rem;
  }

  .merge-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(74, 158, 255, 0.2),
      rgba(123, 104, 238, 0.2)
    );
    border: 2px solid rgba(123, 104, 238, 0.4);
    border-radius: 12px;
    color: white;
    font-size: 1.125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    min-height: var(--min-touch-target);
  }

  .merge-button:hover:not(:disabled) {
    background: linear-gradient(
      135deg,
      rgba(74, 158, 255, 0.3),
      rgba(123, 104, 238, 0.3)
    );
    border-color: rgba(123, 104, 238, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(123, 104, 238, 0.3);
  }

  .merge-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .merge-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .button-text {
    line-height: 1;
  }

  .action-hint {
    font-size: 0.9375rem;
    color: var(--theme-text-dim);
    text-align: center;
    margin: 0;
    font-style: italic;
  }

  .merged-view {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    animation: fadeIn 0.6s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .merged-explanation {
    padding: 2rem;
    background: linear-gradient(
      135deg,
      rgba(123, 104, 238, 0.1),
      rgba(74, 158, 255, 0.1)
    );
    border: 2px solid rgba(123, 104, 238, 0.3);
    border-radius: 16px;
    text-align: center;
  }

  .merged-explanation h3 {
    font-size: 1.5rem;
    font-weight: 800;
    color: white;
    margin: 0 0 1rem 0;
  }

  .merged-explanation p {
    font-size: 1rem;
    color: var(--theme-text);
    margin: 0 0 1rem 0;
    line-height: 1.6;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  .split-button {
    margin-top: 1.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: var(--min-touch-target);
  }

  .split-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .grids-side-by-side {
      grid-template-columns: 1fr;
    }

    .comparison-title {
      font-size: 1.5rem;
    }

    .merge-button {
      font-size: 1rem;
      padding: 0.875rem 1.5rem;
    }

    .merged-explanation {
      padding: 1.5rem;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .merged-view {
      animation: none;
    }
  }
</style>

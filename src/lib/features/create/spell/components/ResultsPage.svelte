<!--
ResultsPage.svelte - Results display for preferences-first flow

Shows:
- Count of variations that matched user preferences
- Best variation prominently displayed (optional preview)
- Three action buttons:
  1. "Pick Best" - Select the top-scored variation
  2. "Browse All" - View all matching variations
  3. "Adjust Preferences" - Go back to preferences phase
-->
<script lang="ts">
  import type { ScoredVariation } from "../state/variation-state.svelte";

  let {
    matchedCount,
    bestVariation = null,
    onPickBest,
    onBrowseAll,
    onAdjustPreferences,
  }: {
    matchedCount: number;
    bestVariation?: ScoredVariation | null;
    onPickBest: () => void;
    onBrowseAll: () => void;
    onAdjustPreferences: () => void;
  } = $props();

  const hasResults = $derived(matchedCount > 0);
</script>

<div class="results-page">
  <!-- Header -->
  <div class="page-header">
    <h2 class="page-title">
      {#if hasResults}
        {matchedCount} {matchedCount === 1 ? "Variation" : "Variations"} Found
      {:else}
        No Variations Match
      {/if}
    </h2>
    <p class="page-subtitle">
      {#if hasResults}
        Choose the best match or browse all options
      {:else}
        Try adjusting your preferences to find matches
      {/if}
    </p>
  </div>

  {#if hasResults}
    <!-- Best Variation Card (optional preview in future) -->
    {#if bestVariation}
      <div class="best-variation-card">
        <div class="best-badge">
          <i class="fas fa-star" aria-hidden="true"></i>
          <span>Best Match</span>
        </div>
        <div class="variation-info">
          <div class="info-row">
            <span class="info-label">Length:</span>
            <span class="info-value"
              >{bestVariation.sequence.steps.length} steps</span
            >
          </div>
          <div class="info-row">
            <span class="info-label">Score:</span>
            <span class="info-value"
              >{bestVariation.score.total.toFixed(2)}</span
            >
          </div>
          <div class="info-row">
            <span class="info-label">Reversals:</span>
            <span class="info-value">{bestVariation.score.reversalCount}</span>
          </div>
        </div>
        <!-- Future: Add SequencePreview component here -->
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="actions-section">
      <button class="action-button primary" onclick={onPickBest}>
        <span class="button-icon" aria-hidden="true">
          <i class="fas fa-star"></i>
        </span>
        <span class="button-text">Pick Best</span>
      </button>

      <button class="action-button secondary" onclick={onBrowseAll}>
        <span class="button-icon" aria-hidden="true">
          <i class="fas fa-th-large"></i>
        </span>
        <span class="button-text">Browse All {matchedCount}</span>
      </button>
    </div>
  {/if}

  <!-- Adjust Preferences (always visible) -->
  <div class="adjust-section">
    <button class="adjust-button" onclick={onAdjustPreferences}>
      <span class="button-icon" aria-hidden="true">
        <i class="fas fa-arrow-left"></i>
      </span>
      <span class="button-text">Adjust Preferences</span>
    </button>
  </div>
</div>

<style>
  .results-page {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-lg, 24px);
    padding: var(--settings-spacing-md, 16px);
    max-width: 600px;
    margin: 0 auto;
    min-height: 100%;
    justify-content: center;
  }

  /* Header */
  .page-header {
    text-align: center;
  }

  .page-title {
    margin: 0 0 var(--settings-spacing-xs, 4px) 0;
    font-size: var(--font-size-xl, 24px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .page-subtitle {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    line-height: 1.5;
  }

  /* Best Variation Card */
  .best-variation-card {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    padding: var(--settings-spacing-lg, 24px);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #6366f1) 5%, transparent) 100%
    );
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: var(--settings-radius-lg, 16px);
  }

  .best-badge {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-xs, 4px);
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .best-badge i {
    font-size: var(--font-size-md, 16px);
  }

  .variation-info {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--settings-spacing-sm, 8px) 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .info-value {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #ffffff);
    font-weight: 600;
  }

  /* Action Buttons */
  .actions-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    min-height: 56px;
    padding: var(--settings-spacing-md, 16px) var(--settings-spacing-lg, 24px);
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    font-size: var(--font-size-md, 16px);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .action-button.primary {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .action-button.primary:hover {
    background: var(--theme-accent-hover, #4f46e5);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .action-button.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .action-button.secondary:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  }

  .action-button:active {
    transform: translateY(0);
  }

  .action-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 4px;
  }

  .button-icon {
    font-size: var(--font-size-lg, 18px);
  }

  .button-text {
    font-size: var(--font-size-md, 16px);
  }

  /* Adjust Preferences */
  .adjust-section {
    display: flex;
    justify-content: center;
    padding-top: var(--settings-spacing-md, 16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .adjust-button {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 48px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: transparent;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .adjust-button:hover {
    color: var(--theme-accent, #6366f1);
  }

  .adjust-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
    border-radius: var(--settings-radius-sm, 8px);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .results-page {
      padding: var(--settings-spacing-sm, 8px);
    }

    .best-variation-card {
      padding: var(--settings-spacing-md, 16px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-button,
    .adjust-button {
      transition: none;
    }

    .action-button:hover {
      transform: none;
    }
  }
</style>

<!--
  SimilarSequencesPanel.svelte

  Shows sequences similar to the current one using the comparison engine.
  Displays as a collapsible panel at the bottom of the sequence details modal.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { safeSlide } from "$lib/shared/utils/transitions";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { ISimilarityCalculator, SimilarityReport } from "$lib/shared/comparison/services/contracts/ISimilarityCalculator";
  import type { ISequenceEquivalenceDetector, EquivalenceResult } from "$lib/features/create/shared/services/contracts/ISequenceEquivalenceDetector";
  import { container } from "$lib/shared/di";

  interface Props {
    sequence: SequenceData;
    allSequences: readonly SequenceData[];
    onSequenceSelect?: (sequence: SequenceData) => void;
  }

  let { sequence, allSequences, onSequenceSelect }: Props = $props();

  // State
  let isExpanded = $state(false);
  let isLoading = $state(false);
  let similarSequences = $state<Array<{
    sequence: SequenceData;
    similarity: SimilarityReport;
    equivalence: EquivalenceResult | null;
  }>>([]);

  // Services
  let similarityCalculator: ISimilarityCalculator | null = null;
  let equivalenceDetector: ISequenceEquivalenceDetector | null = null;

  onMount(() => {
    try {
      similarityCalculator = container.items.similarityCalculator;
      equivalenceDetector = container.items.sequenceEquivalenceDetector;
    } catch (e) {
      console.warn("[SimilarSequencesPanel] Services not available:", e);
    }
  });

  // Find similar sequences when expanded
  async function findSimilarSequences() {
    if (!similarityCalculator || !sequence || allSequences.length === 0) return;

    isLoading = true;

    try {
      const results: typeof similarSequences = [];

      for (const candidate of allSequences) {
        // Skip self
        if (candidate.id === sequence.id || candidate.word === sequence.word) continue;

        // Quick score first
        const quickResult = similarityCalculator.computeQuickScore(sequence, candidate);

        // Only compute full similarity if quick score is promising
        if (quickResult.score > 0.3) {
          const similarity = similarityCalculator.computeSimilarity(sequence, candidate);

          // Check equivalence if score is high
          let equivalence: EquivalenceResult | null = null;
          if (similarity.overallScore > 0.7 && equivalenceDetector) {
            equivalence = equivalenceDetector.areEquivalent(sequence, candidate);
          }

          if (similarity.overallScore > 0.4) {
            results.push({ sequence: candidate, similarity, equivalence });
          }
        }
      }

      // Sort by similarity score descending
      results.sort((a, b) => b.similarity.overallScore - a.similarity.overallScore);

      // Take top 10
      similarSequences = results.slice(0, 10);
    } catch (e) {
      console.error("[SimilarSequencesPanel] Error finding similar sequences:", e);
    } finally {
      isLoading = false;
    }
  }

  function toggleExpanded() {
    isExpanded = !isExpanded;
    if (isExpanded && similarSequences.length === 0) {
      findSimilarSequences();
    }
  }

  function handleSequenceClick(seq: SequenceData) {
    onSequenceSelect?.(seq);
  }

  function getScoreColor(score: number): string {
    if (score >= 0.9) return "var(--semantic-success, #22c55e)";
    if (score >= 0.7) return "var(--theme-accent, #6366f1)";
    if (score >= 0.5) return "var(--semantic-warning, #f59e0b)";
    return "var(--theme-text-dim, rgba(255, 255, 255, 0.5))";
  }

  function getEquivalenceLabel(equivalence: EquivalenceResult | null): string | null {
    if (!equivalence?.isEquivalent) return null;

    switch (equivalence.equivalenceType) {
      case "identical": return "Identical";
      case "spatial-rotation": return "Rotated";
      case "circular-rotation": return "Shifted";
      case "combined": return "Transform";
      default: return "Equivalent";
    }
  }
</script>

<div class="similar-panel">
  <button
    type="button"
    class="panel-header"
    onclick={toggleExpanded}
    aria-expanded={isExpanded}
  >
    <div class="header-left">
      <i class="fas fa-code-branch" aria-hidden="true"></i>
      <span class="header-title">Similar Sequences</span>
      {#if similarSequences.length > 0}
        <span class="count-badge">{similarSequences.length}</span>
      {/if}
    </div>
    <i class="fas {isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>
  </button>

  {#if isExpanded}
    <div class="panel-content" transition:safeSlide={{ duration: 200 }}>
      {#if isLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Analyzing sequences...</span>
        </div>
      {:else if similarSequences.length === 0}
        <div class="empty-state">
          <i class="fas fa-search" aria-hidden="true"></i>
          <span>No similar sequences found</span>
        </div>
      {:else}
        <div class="sequence-list">
          {#each similarSequences as item, index (item.sequence.id || item.sequence.word)}
            <button
              type="button"
              class="sequence-item"
              onclick={() => handleSequenceClick(item.sequence)}
              in:fade={{ delay: index * 50, duration: 150 }}
            >
              <div class="item-main">
                <span class="sequence-word">{item.sequence.word || "Untitled"}</span>
                {#if getEquivalenceLabel(item.equivalence)}
                  <span class="equivalence-badge">
                    {getEquivalenceLabel(item.equivalence)}
                  </span>
                {/if}
              </div>
              <div class="item-details">
                <span class="score" style="color: {getScoreColor(item.similarity.overallScore)}">
                  {Math.round(item.similarity.overallScore * 100)}% match
                </span>
                <span class="beat-count">
                  {item.sequence.steps?.length || 0} beats
                </span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .similar-panel {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: background 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .panel-header:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.06));
  }

  .panel-header:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-left i:first-child {
    color: var(--theme-accent, #6366f1);
    font-size: 14px;
  }

  .header-title {
    font-weight: 600;
  }

  .count-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    background: var(--theme-accent, #6366f1);
    border-radius: 11px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: white;
  }

  .panel-content {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 12px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .sequence-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sequence-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
    width: 100%;
  }

  .sequence-item:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .sequence-item:active {
    transform: scale(0.98);
  }

  .sequence-item:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .item-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sequence-word {
    font-weight: 600;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
  }

  .equivalence-badge {
    padding: 2px 8px;
    background: color-mix(in srgb, var(--semantic-success, #22c55e) 20%, transparent);
    border: 1px solid color-mix(in srgb, var(--semantic-success, #22c55e) 40%, transparent);
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--semantic-success, #22c55e);
  }

  .item-details {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .score {
    font-weight: 600;
    font-size: var(--font-size-compact, 12px);
  }

  .beat-count {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }

    .sequence-item,
    .panel-header {
      transition: none;
    }
  }
</style>

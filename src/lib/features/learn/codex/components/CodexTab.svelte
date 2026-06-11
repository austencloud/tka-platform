<!--
Codex Tab - Letter reference and pictograph browser

Provides access to the complete TKA letter codex with drill-down detail view:
- Browse all available letters and pictographs
- Click a letter to see all its variations
- Smooth slide animation between grid and detail views
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import CodexComponent from "./CodexComponent.svelte";
  import LetterDetailView from "./LetterDetailView.svelte";
  import { createCodexState } from "../state/codex-state.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";

  // Codex state for fetching letter details
  const codexState = createCodexState();

  // View state
  let selectedLetter = $state<string | null>(null);
  let letterPictographs = $state<PictographData[]>([]);
  let isLoadingDetails = $state(false);

  // Derived view mode
  let viewMode = $derived<"grid" | "detail">(
    selectedLetter ? "detail" : "grid"
  );

  // Handle letter selection from the grid
  async function handleLetterSelected(letter: string) {
    isLoadingDetails = true;
    try {
      // Fetch all pictographs for this letter
      const pictographs = await codexState.getAllPictographsForLetter(letter);
      letterPictographs = pictographs;
      selectedLetter = letter;
    } catch (error) {
      console.error("Failed to load letter details:", error);
      // Reset on error and tell the user — otherwise the spinner clears and nothing happens
      selectedLetter = null;
      letterPictographs = [];
      toast.error("Failed to load letter details. Please try again.");
    } finally {
      isLoadingDetails = false;
    }
  }

  // Handle back from detail view
  function handleBackToGrid() {
    selectedLetter = null;
    letterPictographs = [];
  }

  // Handle pictograph click (could be used to add to sequence, etc.)
  function handlePictographClick(pictograph: PictographData) {
    // Could emit events or handle selection logic here
  }
</script>

<div class="codex-tab">
  <div class="codex-header">
    <h2>{t("learn_letters_title")}</h2>
  </div>

  <div class="codex-content">
    <!-- Flex container that adjusts widths -->
    <div class="panel-container">
      <!-- Grid View - compresses when detail opens -->
      <div class="grid-panel" class:compressed={viewMode === "detail"}>
        <CodexComponent
          isVisible={true}
          onLetterSelected={handleLetterSelected}
          onPictographSelected={handlePictographClick}
        />
      </div>

      <!-- Detail View - expands from 0 width when letter selected -->
      <div class="detail-panel" class:expanded={viewMode === "detail"}>
        {#if selectedLetter}
          <LetterDetailView
            letter={selectedLetter}
            pictographs={letterPictographs}
            onBack={handleBackToGrid}
            onPictographClick={handlePictographClick}
          />
        {/if}
      </div>

      <!-- Loading overlay when fetching letter details -->
      {#if isLoadingDetails}
        <div class="loading-overlay" transition:fade={{ duration: 150 }}>
          <ProgressRing percent={-1} size={32} strokeWidth={3} />
          <p>{t("learn_loading_letter_details")}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .codex-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    color: var(--foreground, #ffffff);
    overflow: hidden;
  }

  .codex-header {
    background: transparent;
    text-align: center;
    flex-shrink: 0;
  }

  .codex-header h2 {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--theme-text);
    background: linear-gradient(135deg, var(--theme-text), var(--theme-text-muted));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .codex-content {
    flex: 1;
    overflow: hidden;
    background: transparent;
    position: relative;
  }

  /* Flex panel container - adjusts widths dynamically */
  .panel-container {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    gap: 0;
  }

  /* Grid panel - starts at full width, compresses when detail opens */
  .grid-panel {
    flex: 1 1 100%;
    min-width: 0; /* Allow shrinking below content size */
    height: 100%;
    overflow: hidden;
    transition: flex var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .grid-panel.compressed {
    flex: 1 1 40%; /* Takes 40% when detail is open */
  }

  /* Detail panel - starts at 0 width, expands when letter selected */
  .detail-panel {
    flex: 0 0 0%;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    transition: flex var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
    border-left: 0 solid var(--theme-stroke);
    transition:
      flex 400ms cubic-bezier(0.4, 0, 0.2, 1),
      border-left-width 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .detail-panel.expanded {
    flex: 0 0 60%; /* Takes 60% when expanded */
    border-left-width: 1px;
  }

  /* Loading overlay */
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-panel-bg) 85%, transparent);
    z-index: 100;
    gap: 1rem;
  }

  .loading-overlay p {
    margin: 0;
    color: var(--theme-text);
    font-size: 0.9375rem;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .codex-header h2 {
      font-size: 1.25rem;
    }

    /* On mobile/tablet, detail takes full width when expanded */
    .grid-panel.compressed {
      flex: 0 0 0%; /* Grid completely hidden on mobile */
    }

    .detail-panel.expanded {
      flex: 1 1 100%; /* Detail takes full width */
    }
  }

  @media (max-width: 480px) {
    .codex-header h2 {
      font-size: 1.125rem;
    }
  }

  /* Desktop: side-by-side with more balanced split */
  @media (min-width: 1200px) {
    .grid-panel.compressed {
      flex: 1 1 45%; /* More space for grid on large screens */
    }

    .detail-panel.expanded {
      flex: 0 0 55%; /* Detail takes less on large screens */
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .grid-panel,
    .detail-panel {
      transition: none;
    }
  }
</style>

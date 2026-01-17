<!--
SpellPanel.svelte - Word-to-Sequence Generation Panel (Funnel Wizard)

New UX flow:
1. SETUP: Word input + Grid mode + Loop toggle → Generate All
2. GENERATING: Progress bar while finding all variations
3. WIZARD: Step-by-step filter (length → motion → reversals → flow)
4. BROWSING: Manual selection from filtered variations

This component orchestrates the UI phases; business logic lives in services.
-->
<script lang="ts">
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import type { SpellTabState } from "../state/spell-tab-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IVariationExplorationOrchestrator } from "../services/contracts/IVariationExplorationOrchestrator";
  import { UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import WordInput from "./WordInput.svelte";
  import QuickGreekBar from "./QuickGreekBar.svelte";
  import FunnelWizard from "./FunnelWizard.svelte";
  import VariationGrid from "./VariationGrid.svelte";
  import { getVariationState, type ScoredVariation } from "../state/variation-state.svelte";

  // Props
  let {
    spellState,
    sequenceState,
    isDesktop = false,
  }: {
    spellState: SpellTabState;
    sequenceState: SequenceState | null;
    isDesktop?: boolean;
  } = $props();

  // Lazy-resolved services
  let explorationOrchestrator: IVariationExplorationOrchestrator | null = null;

  function getExplorationOrchestrator(): IVariationExplorationOrchestrator {
    if (!explorationOrchestrator) {
      explorationOrchestrator = container.items.variationExplorationOrchestrator as IVariationExplorationOrchestrator;
    }
    return explorationOrchestrator;
  }

  // Variation state (for generation progress)
  const variationState = getVariationState();

  // All collected variations (for wizard)
  let allVariations = $state<ScoredVariation[]>([]);

  // Filtered variations (after wizard filtering)
  let filteredVariations = $state<ScoredVariation[]>([]);

  // ============================================================================
  // SETUP PHASE
  // ============================================================================

  function handleLetterInsert(letter: string) {
    spellState.insertLetter(letter);
  }

  function handleGridModeChange(mode: GridMode) {
    spellState.setGridMode(mode);
  }

  // ============================================================================
  // GENERATION PHASE
  // ============================================================================

  async function handleGenerateAll() {
    if (!spellState.inputWord.trim()) return;

    spellState.setWizardPhase("generating");
    spellState.setGenerating(true);
    spellState.clearError();
    allVariations = [];

    try {
      const orchestrator = getExplorationOrchestrator();

      // Parse word to get expanded letters
      const parseResult = await orchestrator.parseWord(spellState.inputWord);
      if (!parseResult.success || !parseResult.expandedLetters) {
        spellState.setError(parseResult.error || "Could not parse word");
        spellState.setWizardPhase("setup");
        return;
      }

      spellState.setExpandedWord(parseResult.expandedWord || spellState.inputWord);

      // Estimate total variations
      const estimatedTotal = await orchestrator.estimateVariationCount(
        parseResult.expandedLetters,
        spellState.selectedGridMode
      );

      // Start exploration with progress tracking
      const abortSignal = variationState.startExploration(estimatedTotal);
      orchestrator.resetDeduplicator();

      // Collect all variations
      const collected: ScoredVariation[] = [];

      const result = await orchestrator.exploreVariations(
        parseResult.expandedLetters,
        spellState.preferences,
        spellState.selectedGridMode,
        {
          onVariationFound: (variation) => {
            collected.push(variation);
            variationState.addVariation(variation);
          },
          onProgress: (count) => {
            variationState.updateProgress(count);
          },
        },
        abortSignal
      );

      variationState.completeExploration();

      if (result.error) {
        spellState.setError(result.error);
        spellState.setWizardPhase("setup");
        return;
      }

      // Store all variations and move to wizard phase
      allVariations = collected;
      spellState.markHasGeneratedOnce();

      if (collected.length === 0) {
        spellState.setError("No valid variations found for this word.");
        spellState.setWizardPhase("setup");
      } else if (collected.length === 1) {
        // Only one variation - skip wizard, select it directly
        handleVariationComplete(collected[0]!);
      } else {
        spellState.setWizardPhase("wizard");
      }
    } catch (error) {
      console.error("Failed to explore variations:", error);
      if (error instanceof Error && error.name !== "AbortError") {
        spellState.setError(error.message);
      }
      spellState.setWizardPhase("setup");
    } finally {
      spellState.setGenerating(false);
    }
  }

  function handleCancelExploration() {
    variationState.cancelExploration();
    spellState.setWizardPhase("setup");
    spellState.setGenerating(false);
  }

  // ============================================================================
  // WIZARD PHASE
  // ============================================================================

  function handleVariationComplete(variation: ScoredVariation) {
    if (!sequenceState) return;

    sequenceState.setCurrentSequence({
      ...variation.sequence,
      name: spellState.inputWord,
      word: spellState.expandedWord || spellState.inputWord,
    });

    spellState.pushUndoSnapshot(UndoOperationType.SPELL_GENERATE, {
      word: spellState.inputWord,
    });

    // Reset to setup for next generation
    spellState.setWizardPhase("setup");
  }

  function handleBrowseVariations(filtered: ScoredVariation[]) {
    filteredVariations = filtered;
    spellState.setWizardPhase("browsing");
  }

  function handleBackToSetup() {
    spellState.setWizardPhase("setup");
    allVariations = [];
    filteredVariations = [];
  }

  // ============================================================================
  // BROWSING PHASE
  // ============================================================================

  function handleVariationSelect(variationId: string) {
    const variation = filteredVariations.find((v) => v.id === variationId);
    if (!variation) return;

    variationState.selectVariation(variationId);
    handleVariationComplete(variation);
  }

  function handleBackToWizard() {
    spellState.setWizardPhase("wizard");
  }

  // ============================================================================
  // SHARED
  // ============================================================================

  function handleClear() {
    spellState.clearSpellState();
    variationState.reset();
    allVariations = [];
    filteredVariations = [];
    if (sequenceState) {
      sequenceState.clearSequenceCompletely();
    }
  }

  // Progress percentage for generation phase
  const progressPercent = $derived(() => {
    const { totalExplored, estimatedTotal } = variationState.progress;
    if (estimatedTotal === 0) return 0;
    return Math.min(100, Math.round((totalExplored / estimatedTotal) * 100));
  });
</script>

<div class="spell-panel" data-is-desktop={isDesktop}>
  {#if spellState.wizardPhase === "setup"}
    <!-- SETUP PHASE -->
    <div class="spell-panel-scroll">
      <h2 class="spell-title">Turn words into sequences</h2>

      <!-- Word Input -->
      <div class="input-section">
        <WordInput
          value={spellState.inputWord}
          onInput={(value) => spellState.setInputWord(value)}
          disabled={spellState.isGenerating}
        />
      </div>

      <!-- Quick Greek Letters -->
      <div class="greek-bar-section">
        <QuickGreekBar onSelect={handleLetterInsert} />
      </div>

      <!-- Grid Mode Selector -->
      <div class="setup-option">
        <span class="option-label">Grid Mode</span>
        <div class="mode-chips" role="radiogroup" aria-label="Grid mode">
          <button
            class="mode-chip"
            class:active={spellState.selectedGridMode === GridMode.DIAMOND}
            onclick={() => handleGridModeChange(GridMode.DIAMOND)}
            role="radio"
            aria-checked={spellState.selectedGridMode === GridMode.DIAMOND}
          >
            <i class="fas fa-gem" aria-hidden="true"></i>
            Diamond
          </button>
          <button
            class="mode-chip"
            class:active={spellState.selectedGridMode === GridMode.BOX}
            onclick={() => handleGridModeChange(GridMode.BOX)}
            role="radio"
            aria-checked={spellState.selectedGridMode === GridMode.BOX}
          >
            <i class="fas fa-square" aria-hidden="true"></i>
            Box
          </button>
        </div>
      </div>

      <!-- Make Loopable Toggle -->
      <div class="setup-option">
        <button
          class="loop-toggle"
          class:active={spellState.preferences.makeCircular}
          onclick={() =>
            spellState.updatePreference(
              "makeCircular",
              !spellState.preferences.makeCircular
            )}
          aria-pressed={spellState.preferences.makeCircular}
        >
          <span class="loop-icon" aria-hidden="true">
            {#if spellState.preferences.makeCircular}
              <i class="fas fa-check-circle"></i>
            {:else}
              <i class="fas fa-circle"></i>
            {/if}
          </span>
          <span class="loop-label">Make it loop back to start</span>
        </button>
      </div>

      <!-- Error Display -->
      {#if spellState.error}
        <div class="error-message">
          {spellState.error}
        </div>
      {/if}
    </div>

    <!-- Sticky Generate Button -->
    <div class="button-area">
      <button
        class="generate-button"
        onclick={handleGenerateAll}
        disabled={!spellState.canGenerate}
      >
        <i class="fas fa-search" aria-hidden="true"></i>
        Find All Variations
      </button>
    </div>

  {:else if spellState.wizardPhase === "generating"}
    <!-- GENERATING PHASE -->
    <div class="generation-phase">
      <div class="progress-content">
        <h3 class="progress-title">Finding all possibilities...</h3>

        <div class="progress-stats">
          <span class="count">{variationState.stats.totalUnique}</span>
          <span class="label">unique variations found</span>
        </div>

        <div class="progress-bar-container">
          <div
            class="progress-bar"
            style="width: {progressPercent()}%"
            role="progressbar"
            aria-valuenow={progressPercent()}
            aria-valuemin={0}
            aria-valuemax={100}
          ></div>
        </div>

        <p class="progress-hint">
          Exploring {variationState.progress.totalExplored} paths...
        </p>

        <button class="cancel-button" onclick={handleCancelExploration}>
          Cancel
        </button>
      </div>
    </div>

  {:else if spellState.wizardPhase === "wizard"}
    <!-- WIZARD PHASE -->
    <FunnelWizard
      variations={allVariations}
      onComplete={handleVariationComplete}
      onBrowse={handleBrowseVariations}
      onBack={handleBackToSetup}
    />

  {:else if spellState.wizardPhase === "browsing"}
    <!-- BROWSING PHASE -->
    <div class="browsing-phase">
      <div class="browsing-header">
        <button class="back-button" onclick={handleBackToWizard}>
          <i class="fas fa-arrow-left" aria-hidden="true"></i>
          Back to Filter
        </button>
        <h3 class="browsing-title">
          {filteredVariations.length} Variations
        </h3>
      </div>

      <div class="variation-grid-container">
        <VariationGrid
          variations={filteredVariations}
          progress={{ ...variationState.progress, isExploring: false }}
          stats={{ ...variationState.stats, totalUnique: filteredVariations.length, totalFiltered: filteredVariations.length }}
          selectedVariationId={variationState.selectedVariationId}
          sortBy={variationState.sortBy}
          sortDescending={variationState.sortDescending}
          filters={variationState.filters}
          onSelect={handleVariationSelect}
          onToggleFilter={(key) => variationState.toggleFilter(key)}
          onSetSortBy={(option) => variationState.setSortBy(option)}
          onCancel={() => {}}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .spell-panel {
    container-type: size;
    container-name: spell-panel;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
  }

  .spell-panel-scroll {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    overflow-y: auto;
    padding: var(--settings-spacing-sm, 8px);
    padding-bottom: var(--settings-spacing-md, 16px);
  }

  .spell-title {
    margin: 0;
    padding: 8px 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text);
    text-align: center;
  }

  @media (max-width: 768px) {
    .spell-title {
      display: none;
    }
  }

  /* Setup sections */
  .input-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-md, 16px);
  }

  .greek-bar-section {
    padding: 0 var(--settings-spacing-sm, 8px);
  }

  .setup-option {
    padding: 0 var(--settings-spacing-sm, 8px);
  }

  .option-label {
    display: block;
    margin-bottom: var(--settings-spacing-sm, 8px);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .mode-chips {
    display: flex;
    gap: var(--settings-spacing-sm, 8px);
  }

  .mode-chip {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .mode-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .mode-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .mode-chip.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  /* Loop toggle */
  .loop-toggle {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    min-height: 48px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .loop-toggle:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .loop-toggle.active {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent) 0%,
      color-mix(in srgb, var(--theme-accent, #6366f1) 10%, transparent) 100%
    );
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .loop-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .loop-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-accent, #6366f1);
  }

  .loop-label {
    flex: 1;
    text-align: left;
  }

  /* Button area */
  .button-area {
    position: sticky;
    bottom: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    padding: var(--settings-spacing-md, 16px);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    z-index: 10;
    display: flex;
    justify-content: center;
  }

  .generate-button {
    width: 100%;
    max-width: 480px;
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-accent, #6366f1);
    color: white;
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .generate-button:hover:not(:disabled) {
    background: var(--theme-accent-hover, #4f46e5);
    transform: translateY(-1px);
  }

  .generate-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Error message */
  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--semantic-error, #ef4444);
    border-radius: var(--settings-radius-sm, 8px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
  }

  /* Generation phase */
  .generation-phase {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--settings-spacing-lg, 24px);
  }

  .progress-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--settings-spacing-md, 16px);
    max-width: 400px;
    text-align: center;
  }

  .progress-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .progress-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .progress-stats .count {
    font-size: 48px;
    font-weight: 700;
    color: var(--theme-accent, #6366f1);
    line-height: 1;
  }

  .progress-stats .label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .progress-bar-container {
    width: 100%;
    height: 8px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    transition: width var(--duration-emphasis) ease;
  }

  .progress-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .cancel-button {
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .cancel-button:hover {
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
  }

  /* Browsing phase */
  .browsing-phase {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .browsing-header {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-md, 16px);
    padding: var(--settings-spacing-md, 16px);
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .back-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .browsing-title {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .variation-grid-container {
    flex: 1;
    overflow: hidden;
    padding: var(--settings-spacing-md, 16px);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mode-chip,
    .loop-toggle,
    .generate-button,
    .cancel-button,
    .back-button,
    .progress-bar {
      transition: none;
    }

    .generate-button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>

<!--
SpellPanel.svelte - Word-to-Sequence Generation Panel (Preferences-First Flow)

New UX flow (preferences-first):
1. PREFERENCES: Collect ALL preferences upfront (word, grid, length, motion, reversals, loop)
2. GENERATING: Progress bar while exploring constrained variations
3. RESULTS: Show count, best variation, and three actions (Pick Best / Browse All / Adjust Preferences)

This component orchestrates the UI phases; business logic lives in services.
-->
<script lang="ts">
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import type { SpellTabState } from "../state/spell-tab-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IVariationExplorationOrchestrator } from "../services/contracts/IVariationExplorationOrchestrator";
  import type { IRandomSequenceGenerator } from "../services/contracts/IRandomSequenceGenerator";
  import type { ISpellServiceLoader } from "../services/contracts/ISpellServiceLoader";
  import { UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/features/create/shared/domain/models/SequenceData";
  import PreferencesPage from "./PreferencesPage.svelte";
  import ResultsPage from "./ResultsPage.svelte";
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
  let orchestrator: IVariationExplorationOrchestrator | null = null;
  let serviceLoader: ISpellServiceLoader | null = null;
  let randomGenerator: IRandomSequenceGenerator | null = null;

  function getServiceLoader(): ISpellServiceLoader {
    if (!serviceLoader) {
      serviceLoader = container.items.spellServiceLoader as ISpellServiceLoader;
    }
    return serviceLoader;
  }

  function getOrchestrator(): IVariationExplorationOrchestrator {
    if (!orchestrator) {
      orchestrator = container.items.variationExplorationOrchestrator as IVariationExplorationOrchestrator;
    }
    return orchestrator;
  }

  async function getRandomGenerator(): Promise<IRandomSequenceGenerator> {
    if (!randomGenerator) {
      const loader = getServiceLoader();
      randomGenerator = await loader.getRandomSequenceGenerator();
    }
    return randomGenerator;
  }

  // Current generated sequence
  let currentSequence = $state<SequenceData | null>(null);

  // ============================================================================
  // PREFERENCES PHASE
  // ============================================================================

  function handleWordChange(value: string) {
    spellState.setInputWord(value);
  }

  function handleGridModeChange(mode: GridMode) {
    spellState.setGridMode(mode);
  }

  function handlePreferenceChange<K extends keyof typeof spellState.preferences>(
    key: K,
    value: (typeof spellState.preferences)[K]
  ) {
    spellState.updatePreference(key, value);
  }

  // ============================================================================
  // GENERATION PHASE
  // ============================================================================

  async function handleGenerate() {
    if (!spellState.inputWord.trim()) return;

    spellState.setWizardPhase("generating");
    spellState.setGenerating(true);
    spellState.clearError();
    currentSequence = null;

    try {
      const orch = getOrchestrator();
      const generator = await getRandomGenerator();

      // Parse word to get expanded letters
      const parseResult = await orch.parseWord(spellState.inputWord);
      if (!parseResult.success || !parseResult.expandedLetters) {
        spellState.setError(parseResult.error || "Could not parse word");
        spellState.setWizardPhase("preferences");
        return;
      }

      spellState.setExpandedWord(parseResult.expandedWord || spellState.inputWord);

      // Build constraints from preferences
      const loader = getServiceLoader();
      const constraintBuilder = await loader.getVariationConstraintBuilder();
      const constraints = constraintBuilder.buildConstraints(
        spellState.preferences,
        parseResult.expandedLetters
      );

      // Generate ONE random valid sequence
      const sequence = await generator.generateRandomSequence(
        parseResult.expandedLetters,
        {
          gridMode: spellState.selectedGridMode,
          constraints,
        }
      );

      if (!sequence) {
        spellState.setError("Could not generate a valid sequence. Try different settings.");
        spellState.setWizardPhase("preferences");
        return;
      }

      // Success! Show the result
      currentSequence = sequence;
      spellState.markHasGeneratedOnce();
      spellState.setWizardPhase("results");

    } catch (error) {
      console.error("Failed to generate sequence:", error);
      spellState.setError(error instanceof Error ? error.message : "Generation failed");
      spellState.setWizardPhase("preferences");
    } finally {
      spellState.setGenerating(false);
    }
  }

  // ============================================================================
  // RESULTS PHASE
  // ============================================================================

  function handleUseThis() {
    if (!sequenceState || !currentSequence) return;

    sequenceState.setCurrentSequence({
      ...currentSequence,
      name: spellState.inputWord,
      word: spellState.expandedWord || spellState.inputWord,
    });

    spellState.pushUndoSnapshot(UndoOperationType.SPELL_GENERATE, {
      word: spellState.inputWord,
    });

    // Reset to preferences for next generation
    currentSequence = null;
    spellState.setWizardPhase("preferences");
  }

  function handleGenerateAnother() {
    // Generate a new random sequence with same settings
    handleGenerate();
  }

  function handleAdjustPreferences() {
    // Go back to preferences (keep word and settings for refinement)
    spellState.setWizardPhase("preferences");
  }

  // ============================================================================
  // SHARED
  // ============================================================================

  function handleClear() {
    spellState.clearSpellState();
    currentSequence = null;
    if (sequenceState) {
      sequenceState.clearSequenceCompletely();
    }
  }
</script>

<div class="spell-panel" data-is-desktop={isDesktop}>
  {#if spellState.wizardPhase === "preferences"}
    <!-- PREFERENCES PHASE -->
    <PreferencesPage
      word={spellState.inputWord}
      onWordChange={handleWordChange}
      gridMode={spellState.selectedGridMode}
      onGridModeChange={handleGridModeChange}
      preferences={spellState.preferences}
      onPreferenceChange={handlePreferenceChange}
      onGenerate={handleGenerate}
      estimatedCount={null}
      isEstimating={false}
    />

  {:else if spellState.wizardPhase === "generating"}
    <!-- GENERATING PHASE -->
    <div class="generation-phase">
      <div class="progress-content">
        <div class="spinner" aria-label="Generating sequence"></div>
        <h3 class="progress-title">Generating your sequence...</h3>
      </div>
    </div>

  {:else if spellState.wizardPhase === "results"}
    <!-- RESULTS PHASE -->
    {#if currentSequence}
      <div class="results-simple">
        <h3>✨ Here's your sequence</h3>
        <p class="sequence-details">
          {currentSequence.steps.length} steps
        </p>

        <div class="result-actions">
          <button class="action-button primary" onclick={handleUseThis}>
            <i class="fas fa-check" aria-hidden="true"></i>
            Use This
          </button>
          <button class="action-button secondary" onclick={handleGenerateAnother}>
            <i class="fas fa-sync-alt" aria-hidden="true"></i>
            Generate Another
          </button>
          <button class="action-button secondary" onclick={handleAdjustPreferences}>
            <i class="fas fa-sliders-h" aria-hidden="true"></i>
            Refine...
          </button>
        </div>
      </div>
    {/if}
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

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Results Simple */
  .results-simple {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-lg, 24px);
    padding: var(--settings-spacing-lg, 24px);
    text-align: center;
  }

  .results-simple h3 {
    margin: 0;
    font-size: var(--font-size-xl, 24px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .sequence-details {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .result-actions {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    max-width: 400px;
  }

  .action-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 56px;
    padding: var(--settings-spacing-md, 16px);
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .action-button.primary {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .action-button.primary:hover {
    background: var(--theme-accent-hover, #4f46e5);
    transform: translateY(-2px);
  }

  .action-button.secondary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .action-button.secondary:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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

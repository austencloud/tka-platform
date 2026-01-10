<!--
SpellPanel.svelte - Word-to-Sequence Generation Panel

Allows users to type a word and generate a valid TKA sequence with bridge letters.
- Word input with autocomplete for Greek letters
- Letter palette for clicking to insert Greek symbols
- Preferences for generation constraints
- Result display showing original vs expanded word

This component orchestrates the UI; business logic lives in extracted services.
-->
<script lang="ts">
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import type { SpellTabState } from "../state/spell-tab-state.svelte";
  import { container } from "$lib/shared/di";
  import type { ISpellGenerationOrchestrator } from "../services/contracts/ISpellGenerationOrchestrator";
  import type { IVariationExplorationOrchestrator } from "../services/contracts/IVariationExplorationOrchestrator";
  import type { ILOOPSelectionCoordinator } from "../services/contracts/ILOOPSelectionCoordinator";
  import type { ISequenceExtender } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
  import { UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
  import type { LOOPType } from "../domain/models/spell-models";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { CircularizationOption } from "$lib/features/create/shared/services/contracts/ISequenceExtender";
  import { slide } from "svelte/transition";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import WordInput from "./WordInput.svelte";
  import LetterPalette from "./LetterPalette.svelte";
  import PreferencesPanel from "./PreferencesPanel.svelte";
  import ResultDisplay from "./ResultDisplay.svelte";
  import LOOPPicker from "$lib/shared/components/loop-picker/LOOPPicker.svelte";
  import BridgePictographGrid from "$lib/shared/components/loop-picker/BridgePictographGrid.svelte";
  import VariationGrid from "./VariationGrid.svelte";
  import { getVariationState } from "../state/variation-state.svelte";

  type LOOPPhase = "bridge-selection" | "loop-selection";

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
  let generationOrchestrator: ISpellGenerationOrchestrator | null = null;
  let explorationOrchestrator: IVariationExplorationOrchestrator | null = null;
  let loopCoordinator: ILOOPSelectionCoordinator | null = null;

  function getGenerationOrchestrator(): ISpellGenerationOrchestrator {
    if (!generationOrchestrator) {
      generationOrchestrator = container.items.spellGenerationOrchestrator as ISpellGenerationOrchestrator;
    }
    return generationOrchestrator;
  }

  function getExplorationOrchestrator(): IVariationExplorationOrchestrator {
    if (!explorationOrchestrator) {
      explorationOrchestrator = container.items.variationExplorationOrchestrator as IVariationExplorationOrchestrator;
    }
    return explorationOrchestrator;
  }

  function getLOOPCoordinator(): ILOOPSelectionCoordinator {
    if (!loopCoordinator) {
      loopCoordinator = container.items.loopSelectionCoordinator as ILOOPSelectionCoordinator;
    }
    return loopCoordinator;
  }

  // Extension options (ALL valid next pictographs from current position)
  let extensionOptions = $state<CircularizationOption[]>([]);

  // Variation exploration mode
  type GenerationMode = "single" | "all";
  let generationMode = $state<GenerationMode>("single");
  const variationState = getVariationState();

  // Generate sequence from the input word
  async function handleGenerate() {
    if (!spellState.inputWord.trim()) return;

    spellState.setGenerating(true);
    spellState.clearError();

    try {
      const orchestrator = getGenerationOrchestrator();
      const result = await orchestrator.generate(
        spellState.inputWord,
        spellState.preferences
      );

      if (result.success) {
        // Update spell state with results
        spellState.setExpandedWord(result.expandedWord);
        spellState.setLetterSources(result.letterSources);

        if (result.loopAnalysis) {
          spellState.setLoopAnalysis(result.loopAnalysis);
        }
        spellState.setCircularizationOptions(result.circularizationOptions);
        spellState.setDirectLoopUnavailableReason(
          result.directLoopUnavailableReason
        );

        // Update extension options
        extensionOptions = result.extensionOptions;

        // Push to sequence state
        if (sequenceState) {
          sequenceState.setCurrentSequence({
            ...result.sequence,
            name: result.originalWord,
            word: result.expandedWord,
          });
        }

        // Push undo snapshot
        spellState.pushUndoSnapshot(UndoOperationType.SPELL_GENERATE, {
          word: result.originalWord,
        });
      } else {
        spellState.setError(result.error);
      }
    } catch (error) {
      console.error("Failed to generate sequence:", error);
      spellState.setError(
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      spellState.setGenerating(false);
    }
  }

  // Handle letter insertion from palette
  function handleLetterInsert(letter: string) {
    spellState.insertLetter(letter);
  }

  // Handle regenerate - generates a new variation
  function handleRegenerate() {
    handleGenerate();
  }

  // Handle "Generate All" - explores all variations
  async function handleGenerateAll() {
    if (!spellState.inputWord.trim()) return;

    spellState.setGenerating(true);
    spellState.clearError();

    try {
      const orchestrator = getExplorationOrchestrator();

      // Parse word to get expanded letters
      const parseResult = await orchestrator.parseWord(spellState.inputWord);
      if (!parseResult.success || !parseResult.expandedLetters) {
        spellState.setError(parseResult.error || "Could not parse word");
        return;
      }

      // Store expanded word for display
      spellState.setExpandedWord(
        parseResult.expandedWord || spellState.inputWord
      );

      // Estimate total variations for progress UI
      const gridMode = GridMode.DIAMOND;
      const estimatedTotal = await orchestrator.estimateVariationCount(
        parseResult.expandedLetters,
        gridMode
      );

      // Start exploration
      const abortSignal = variationState.startExploration(estimatedTotal);
      orchestrator.resetDeduplicator();

      // Run exploration with callbacks
      const result = await orchestrator.exploreVariations(
        parseResult.expandedLetters,
        spellState.preferences,
        gridMode,
        {
          onVariationFound: (variation) => {
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
        variationState.setError(result.error);
        spellState.setError(result.error);
      }

      // Auto-select the best variation
      const best = variationState.variations[0];
      if (best) {
        variationState.selectVariation(best.id);
        handleVariationSelect(best.id);
      }
    } catch (error) {
      console.error("Failed to explore variations:", error);
      if (error instanceof Error && error.name !== "AbortError") {
        variationState.setError(error.message);
        spellState.setError(error.message);
      }
    } finally {
      spellState.setGenerating(false);
    }
  }

  // Handle variation selection
  function handleVariationSelect(variationId: string) {
    const variation = variationState.allVariations.find(
      (v) => v.id === variationId
    );
    if (!variation || !sequenceState) return;

    variationState.selectVariation(variationId);

    sequenceState.setCurrentSequence({
      ...variation.sequence,
      name: spellState.inputWord,
      word: spellState.expandedWord || spellState.inputWord,
    });

    spellState.setExpandedWord(variation.sequence.word || spellState.inputWord);
  }

  // Cancel ongoing variation exploration
  function handleCancelExploration() {
    variationState.cancelExploration();
  }

  // Handle LOOP chip click - apply LOOP with optional bridge
  async function handleApplyLOOP(
    bridgeLetter: Letter | null,
    loopType: LOOPType
  ) {
    if (!spellState.inputWord.trim()) {
      return;
    }

    spellState.setGenerating(true);
    spellState.clearError();

    try {
      // If we're in the two-phase flow (user selected a bridge pictograph),
      // the sequence already has the bridge beat appended. We should just
      // apply the LOOP to the current sequence instead of regenerating.
      if (selectedBridge && sequenceState?.currentSequence) {
        const sequenceExtender = container.items.sequenceExtender as ISequenceExtender;

        const extendedSequence = await sequenceExtender.extendSequence(
          sequenceState.currentSequence,
          { loopType }
        );

        // Update sequence state
        sequenceState.setCurrentSequence({
          ...extendedSequence,
          name: spellState.inputWord,
          word: extendedSequence.word || spellState.expandedWord,
        });

        // Clear circularization options since we just applied one
        spellState.setCircularizationOptions([]);
        spellState.setDirectLoopUnavailableReason(null);

        spellState.pushUndoSnapshot(UndoOperationType.SPELL_APPLY_LOOP, {
          word: spellState.inputWord,
          loopType,
          bridgeLetter: selectedBridge.bridgeLetters[0],
        });
      } else {
        // No bridge selected - regenerate from scratch with LOOP + bridge
        const coordinator = getLOOPCoordinator();
        const result = await coordinator.applyLOOP(
          spellState.inputWord,
          spellState.preferences,
          bridgeLetter,
          loopType
        );

        if (result.success && result.sequence) {
          spellState.setExpandedWord(result.expandedWord || "");
          spellState.setCircularizationOptions([]);
          spellState.setDirectLoopUnavailableReason(null);

          if (sequenceState) {
            sequenceState.setCurrentSequence({
              ...result.sequence,
              name: spellState.inputWord,
              word: result.expandedWord ?? spellState.inputWord,
            });
          }

          spellState.pushUndoSnapshot(UndoOperationType.SPELL_APPLY_LOOP, {
            word: spellState.inputWord,
            loopType,
            bridgeLetter,
          });
        } else {
          const errorMsg = result.error || "Failed to apply LOOP";
          console.error("[SpellPanel] LOOP application failed:", errorMsg);
          spellState.setError(errorMsg);
        }
      }
    } catch (error) {
      console.error("[SpellPanel] Exception while applying LOOP:", error);
      spellState.setError(
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      spellState.setGenerating(false);
    }
  }

  // Handle clear
  function handleClear() {
    spellState.clearSpellState();
    variationState.reset();
    if (sequenceState) {
      sequenceState.clearSequenceCompletely();
    }
  }

  // Track input focus for showing/hiding palette
  let isInputFocused = $state(false);

  function handleInputFocusChange(focused: boolean) {
    isInputFocused = focused;
  }

  // ============================================
  // Two-Phase LOOP Selection Flow
  // ============================================

  let selectedBridge = $state<CircularizationOption | null>(null);

  const hasExtensionOptions = $derived(extensionOptions.length > 0);

  const loopPhase = $derived<LOOPPhase>(
    selectedBridge ? "loop-selection" : "bridge-selection"
  );

  const activeLoopOptions = $derived(
    selectedBridge ? selectedBridge.availableLOOPs : []
  );

  async function handleBridgeSelect(option: CircularizationOption) {
    if (spellState.isGenerating || !sequenceState) return;

    const currentSequence = sequenceState.currentSequence;
    if (!currentSequence) {
      console.error("[SpellPanel] No current sequence to extend");
      return;
    }

    try {
      spellState.setGenerating(true);

      const coordinator = getLOOPCoordinator();
      const result = await coordinator.applyBridge(currentSequence, option);

      if (result.success && result.sequence) {
        sequenceState.setCurrentSequence(result.sequence);
        selectedBridge = option;
      } else {
        spellState.setError(result.error || "Failed to add bridge");
      }
    } catch (error) {
      console.error("[SpellPanel] Failed to append bridge beat:", error);
      spellState.setError("Failed to add bridge letter");
    } finally {
      spellState.setGenerating(false);
    }
  }

  async function handleLoopSelect(
    bridgeLetter: Letter | null,
    loopType: LOOPType
  ) {
    if (spellState.isGenerating) {
      return;
    }

    const finalBridgeLetter = selectedBridge
      ? (selectedBridge.bridgeLetters[0] as Letter)
      : bridgeLetter;

    // Apply the LOOP and wait for it to complete before resetting selection
    await handleApplyLOOP(finalBridgeLetter, loopType);

    // Only reset selectedBridge after LOOP application completes
    selectedBridge = null;
  }

  function handleBackToBridges() {
    if (spellState.isGenerating) return;
    selectedBridge = null;
  }

  // Reset bridge selection when extension options change
  $effect(() => {
    extensionOptions;
    selectedBridge = null;
  });
</script>

<div class="spell-panel" data-is-desktop={isDesktop}>
  <div class="spell-panel-inner">
    <!-- Word Input Section -->
    <div class="input-section">
      <WordInput
        value={spellState.inputWord}
        onInput={(value) => spellState.setInputWord(value)}
        onFocusChange={handleInputFocusChange}
        disabled={spellState.isGenerating}
      />
    </div>

    <!-- Letter Palette (visible when input is focused) -->
    {#if isInputFocused}
      <div class="palette-section" transition:slide={{ duration: 200 }}>
        <LetterPalette onSelect={handleLetterInsert} />
      </div>
    {/if}

    <!-- Preferences Section -->
    <div class="preferences-section">
      <PreferencesPanel
        preferences={spellState.preferences}
        onUpdate={(key, value) => spellState.updatePreference(key, value)}
      />
    </div>

    <!-- LOOP Selection (shown when makeCircular is on and sequence exists) -->
    {#if spellState.preferences.makeCircular && spellState.hasSequence()}
      <div class="loop-selection-section">
        <!-- Phase 1: Pictograph Selection -->
        {#if loopPhase === "bridge-selection" && hasExtensionOptions}
          <div class="loop-phase-header">
            <h3>Choose Next Pictograph</h3>
            <p class="phase-subtitle">
              Select a pictograph to extend your sequence
            </p>
          </div>
          <BridgePictographGrid
            options={extensionOptions}
            onSelect={handleBridgeSelect}
            isLoading={spellState.isGenerating}
          />
        {:else if loopPhase === "loop-selection"}
          <!-- Phase 2: LOOP Selection -->
          <div class="loop-phase-header">
            {#if selectedBridge}
              <button
                class="back-button"
                onclick={handleBackToBridges}
                disabled={spellState.isGenerating}
                aria-label="Back to bridge selection"
              >
                <i class="fas fa-arrow-left" aria-hidden="true"></i>
              </button>
              <div class="header-text">
                <h3>Choose Extension Pattern</h3>
                <p class="phase-subtitle">
                  Via "{selectedBridge.bridgeLetters[0]}" → {selectedBridge.endPosition}
                </p>
              </div>
            {:else}
              <div class="header-text">
                <h3>Choose Extension Pattern</h3>
                <p class="phase-subtitle">Select how to extend your sequence</p>
              </div>
            {/if}
          </div>
          <LOOPPicker
            directOptions={activeLoopOptions}
            circularizationOptions={[]}
            onSelect={handleLoopSelect}
            directUnavailableReason={null}
            isApplying={spellState.isGenerating}
          />
        {:else}
          <div class="no-loop-options">
            <i class="fas fa-info-circle" aria-hidden="true"></i>
            <p>No extension patterns available for this sequence position.</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Generation Mode Toggle -->
    <div class="mode-toggle-section">
      <div class="mode-toggle">
        <button
          class="mode-button"
          class:active={generationMode === "single"}
          onclick={() => (generationMode = "single")}
          disabled={variationState.progress.isExploring}
        >
          <i class="fas fa-dice-one" aria-hidden="true"></i>
          Single
        </button>
        <button
          class="mode-button"
          class:active={generationMode === "all"}
          onclick={() => (generationMode = "all")}
          disabled={variationState.progress.isExploring}
        >
          <i class="fas fa-layer-group" aria-hidden="true"></i>
          All Variations
        </button>
      </div>
    </div>

    <!-- Generate Button -->
    <div class="actions-section">
      {#if generationMode === "single"}
        <button
          class="generate-button"
          onclick={handleGenerate}
          disabled={!spellState.canGenerate}
        >
          {#if spellState.isGenerating}
            <span class="spinner"></span>
            Generating...
          {:else}
            Generate Sequence
          {/if}
        </button>
      {:else}
        <button
          class="generate-button"
          onclick={handleGenerateAll}
          disabled={!spellState.canGenerate ||
            variationState.progress.isExploring}
        >
          {#if variationState.progress.isExploring}
            <span class="spinner"></span>
            Exploring... ({variationState.stats.totalUnique} unique)
          {:else}
            <i class="fas fa-search" aria-hidden="true"></i>
            Explore All Variations
          {/if}
        </button>
      {/if}

      {#if spellState.hasSequence() && generationMode === "single"}
        <button class="secondary-button" onclick={handleRegenerate}>
          Regenerate
        </button>
      {/if}

      {#if spellState.hasSequence() || variationState.stats.totalUnique > 0}
        <button class="secondary-button danger" onclick={handleClear}>
          Clear
        </button>
      {/if}
    </div>

    <!-- Variation Grid -->
    {#if generationMode === "all" && (variationState.stats.totalUnique > 0 || variationState.progress.isExploring)}
      <div class="variation-section">
        <VariationGrid
          variations={variationState.variations}
          progress={variationState.progress}
          stats={variationState.stats}
          selectedVariationId={variationState.selectedVariationId}
          sortBy={variationState.sortBy}
          sortDescending={variationState.sortDescending}
          filters={variationState.filters}
          onSelect={handleVariationSelect}
          onToggleFilter={(key) => variationState.toggleFilter(key)}
          onSetSortBy={(option) => variationState.setSortBy(option)}
          onCancel={handleCancelExploration}
        />
      </div>
    {/if}

    <!-- Error Display -->
    {#if spellState.error}
      <div class="error-message">
        {spellState.error}
      </div>
    {/if}

    <!-- Result Display -->
    {#if spellState.expandedWord}
      <div class="result-section">
        <ResultDisplay
          originalWord={spellState.inputWord}
          expandedWord={spellState.expandedWord}
          letterSources={spellState.letterSources}
        />
      </div>
    {/if}
  </div>
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
    overflow: auto;
    padding: var(--settings-spacing-sm, 8px);
  }

  .spell-panel-inner {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    width: 100%;
  }

  .input-section,
  .palette-section,
  .preferences-section,
  .actions-section,
  .result-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-md, 16px);
  }

  .actions-section {
    display: flex;
    gap: var(--settings-spacing-sm, 8px);
    flex-wrap: wrap;
    justify-content: center;
  }

  .generate-button {
    flex: 1;
    min-width: 200px;
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-accent, #6366f1);
    color: white;
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
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

  .secondary-button {
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .secondary-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .secondary-button.danger:hover {
    border-color: var(--semantic-error, #ef4444);
    color: var(--semantic-error, #ef4444);
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--semantic-error, #ef4444);
    border-radius: var(--settings-radius-sm, 8px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    color: var(--semantic-error, #ef4444);
    font-size: var(--font-size-min, 14px);
  }

  /* Mode Toggle */
  .mode-toggle-section {
    display: flex;
    justify-content: center;
  }

  .mode-toggle {
    display: inline-flex;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: 4px;
    gap: 4px;
  }

  .mode-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: transparent;
    border: none;
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mode-button:hover:not(:disabled) {
    color: var(--theme-text, #ffffff);
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .mode-button.active {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .mode-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Variation Section */
  .variation-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-md, 16px);
    min-height: 300px;
    max-height: 500px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* Desktop layout */
  @media (min-width: 1024px) {
    .spell-panel-inner {
      justify-content: center;
    }

    .variation-section {
      min-height: 400px;
      max-height: 600px;
    }
  }

  /* LOOP Selection Styles */
  .loop-selection-section {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
    padding: var(--settings-spacing-md, 16px);
  }

  .loop-phase-header {
    display: flex;
    align-items: flex-start;
    gap: var(--settings-spacing-sm, 8px);
    margin-bottom: var(--settings-spacing-md, 16px);
  }

  .loop-phase-header h3 {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .phase-subtitle {
    margin: 4px 0 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .header-text {
    flex: 1;
  }

  .back-button {
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-lg, 18px);
    cursor: pointer;
    padding: 8px;
    border-radius: var(--settings-radius-sm, 8px);
    min-width: 48px;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .back-button:hover:not(:disabled) {
    background: var(--theme-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #ffffff);
  }

  .back-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .back-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .no-loop-options {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-lg, 24px);
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .no-loop-options i {
    font-size: var(--font-size-xl, 1.5rem);
    opacity: 0.6;
  }

  .no-loop-options p {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .generate-button,
    .secondary-button,
    .back-button {
      transition: none;
    }

    .generate-button:hover:not(:disabled),
    .back-button:hover:not(:disabled) {
      transform: none;
    }

    .spinner {
      animation: none;
      border-color: white;
    }
  }
</style>

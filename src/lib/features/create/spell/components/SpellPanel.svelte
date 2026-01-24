<!--
SpellPanel.svelte - Word-to-Sequence Generation Panel (Preferences-First Flow)

New UX flow (preferences-first):
1. PREFERENCES: Collect ALL preferences upfront (word, grid, motion, flow, loop)
2. GENERATING: Progress bar while generating
3. HAS-SEQUENCE: Show action buttons (Shuffle, Transform, New Word, Refine)

Keyboard-aware input mode:
- On touch devices, focusing the word input triggers "input mode"
- Header and preferences collapse to maximize space for word entry
- Keyboard toolbar appears above virtual keyboard with Generate/Done buttons

Sequences go directly into sequenceState, and the workspace displays them automatically.
This component only shows controls - no preview. Same pattern as Generator tab.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import type { SpellTabState } from "../state/spell-tab-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IVariationExplorationOrchestrator } from "../services/contracts/IVariationExplorationOrchestrator";
  import type { IRandomSequenceGenerator } from "../services/contracts/IRandomSequenceGenerator";
  import type { ISpellServiceLoader } from "../services/contracts/ISpellServiceLoader";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/features/create/shared/domain/models/SequenceData";
  import PreferencesPage from "./PreferencesPage.svelte";
  import SpellInputToolbar from "./SpellInputToolbar.svelte";
  import { loadSpellState, saveSpellState } from "../state/spell-persistence.svelte";
  import { createConstraintSet } from "$lib/shared/sequence-engine/constraints";
  import { tryGetCreateModuleContext } from "$lib/features/create/shared/context/create-module-context";

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

  // Touch device and input focus tracking
  const deviceDetector = container.items.deviceDetector as IDeviceDetector;
  let isTouchDevice = $state(false);
  let isInputFocused = $state(false);
  let keyboardHeight = $state(0);
  let isKeyboardVisible = $state(false);

  // Input mode: distraction-free typing on touch devices
  const isInputMode = $derived(isInputFocused && isTouchDevice);

  // Get context at component initialization (not in event handlers)
  const createModuleContext = tryGetCreateModuleContext();

  // Notify parent layout when input mode changes (collapses workspace on mobile)
  $effect(() => {
    createModuleContext?.layout?.setInputMode(isInputMode);
  });

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

  // Load persisted state on mount and detect touch device
  onMount(() => {
    isTouchDevice = deviceDetector.isTouchDevice();

    const persisted = loadSpellState();
    if (persisted.inputWord) {
      spellState.setInputWord(persisted.inputWord);
    }
    if (persisted.expandedWord) {
      spellState.setExpandedWord(persisted.expandedWord);
    }
    // Restore wizard phase - if sequenceState has a sequence, show results
    if (sequenceState?.currentSequence) {
      spellState.setWizardPhase("results");
    } else {
      spellState.setWizardPhase(persisted.wizardPhase === "results" ? "preferences" : persisted.wizardPhase);
    }
  });

  function handleInputFocusChange(focused: boolean) {
    isInputFocused = focused;
  }

  function handleToolbarDone() {
    isInputFocused = false;
    // Blur any focused element
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function handleKeyboardVisibilityChange(visible: boolean, height: number) {
    isKeyboardVisible = visible;
    keyboardHeight = height;
  }

  // Auto-save state when phase changes (sequence is persisted via sequenceState)
  $effect(() => {
    const phase = spellState.wizardPhase;
    const word = spellState.inputWord;
    const expanded = spellState.expandedWord;
    const prefs = spellState.preferences;
    const hasGenerated = spellState.hasGeneratedOnce;

    saveSpellState({
      wizardPhase: phase,
      inputWord: word,
      expandedWord: expanded,
      preferences: prefs,
      hasGeneratedOnce: hasGenerated,
    });
  });

  /**
   * Derive start position from first step if missing, using proper service
   */
  function deriveStartPosition(sequence: SequenceData): SequenceData {
    if (sequence.startPosition || !sequence.steps?.length) {
      return sequence;
    }

    const firstStep = sequence.steps[0];
    if (!firstStep) return sequence;

    try {
      const derivedStartPosition = startPositionDeriver.deriveFromFirstBeat(firstStep);
      return {
        ...sequence,
        startPosition: derivedStartPosition,
      };
    } catch (error) {
      console.warn("Failed to derive start position:", error);
      return sequence;
    }
  }

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
    if (!spellState.inputWord.trim() || !sequenceState) return;

    spellState.setWizardPhase("generating");
    spellState.setGenerating(true);
    spellState.clearError();

    try {
      const orch = getOrchestrator();
      const generator = await getRandomGenerator();

      // Parse word WITH bridge letters (needed for incompatible transitions like B→O)
      const parseResult = await orch.parseWord(spellState.inputWord);
      if (!parseResult.success || !parseResult.expandedLetters) {
        spellState.setError(parseResult.error || "Could not parse word");
        spellState.setWizardPhase("preferences");
        return;
      }

      const letters = parseResult.expandedLetters;
      spellState.setExpandedWord(parseResult.expandedWord || spellState.inputWord);

      // Update letter sources for word label styling (original vs bridge letters)
      if (parseResult.letterSources) {
        spellState.setLetterSources(parseResult.letterSources);
      }

      // Build constraints from preferences
      const loader = getServiceLoader();
      const constraintBuilder = await loader.getVariationConstraintBuilder();
      const constraints = constraintBuilder.buildConstraints(
        spellState.preferences,
        letters
      );

      // Create soft constraint set for flow preferences (smooth, natural, high-reversal)
      const constraintSet = createConstraintSet(spellState.preferences.constraintPreset);

      // Generate ONE random valid sequence
      const sequence = await generator.generateRandomSequence(
        letters,
        {
          gridMode: spellState.selectedGridMode,
          constraints,
          constraintSet,
        }
      );

      if (!sequence) {
        spellState.setError("Could not generate a valid sequence. Try different settings.");
        spellState.setWizardPhase("preferences");
        return;
      }

      // Derive start position if missing
      const sequenceWithStart = deriveStartPosition(sequence);

      // Set sequence directly on sequenceState - workspace will display it
      // Include spellData in metadata for word label styling persistence
      sequenceState.setCurrentSequence({
        ...sequenceWithStart,
        name: spellState.inputWord,
        word: spellState.expandedWord || spellState.inputWord,
        metadata: {
          ...sequenceWithStart.metadata,
          spellData: {
            originalWord: spellState.inputWord,
            expandedWord: spellState.expandedWord || spellState.inputWord,
            letterSources: parseResult.letterSources || [],
          },
        },
      });

      // Also set the display start position
      if (sequenceWithStart.startPosition) {
        sequenceState.setSelectedStartPosition(sequenceWithStart.startPosition);
      }

      spellState.pushUndoSnapshot(UndoOperationType.SPELL_GENERATE, {
        word: spellState.inputWord,
      });

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
  // RESULTS PHASE - Action buttons for the generated sequence
  // ============================================================================

  async function handleShuffle() {
    // Shuffle generates new variations but preserves step IDs for smooth CSS transitions
    if (!sequenceState?.currentSequence) {
      // No existing sequence - do a full generate
      handleGenerate();
      return;
    }

    const existingSequence = sequenceState.currentSequence;
    const existingSteps = existingSequence.steps;

    spellState.setGenerating(true);
    spellState.clearError();

    try {
      const generator = await getRandomGenerator();
      const loader = getServiceLoader();
      const orch = getOrchestrator();

      // Parse word to get letters
      const parseResult = await orch.parseWord(spellState.inputWord);
      if (!parseResult.success || !parseResult.expandedLetters) {
        spellState.setError(parseResult.error || "Could not parse word");
        return;
      }

      const letters = parseResult.expandedLetters;

      // Update letter sources for word label styling
      if (parseResult.letterSources) {
        spellState.setLetterSources(parseResult.letterSources);
      }

      // Build constraints from preferences
      const constraintBuilder = await loader.getVariationConstraintBuilder();
      const constraints = constraintBuilder.buildConstraints(
        spellState.preferences,
        letters
      );

      // Create soft constraint set for flow preferences
      const constraintSet = createConstraintSet(spellState.preferences.constraintPreset);

      // Generate new sequence
      const newSequence = await generator.generateRandomSequence(
        letters,
        {
          gridMode: spellState.selectedGridMode,
          constraints,
          constraintSet,
        }
      );

      if (!newSequence) {
        spellState.setError("Could not generate a new variation. Try again.");
        return;
      }

      // Preserve existing step IDs for smooth transitions
      const mergedSteps = newSequence.steps.map((newStep, index) => {
        const existingId = existingSteps[index]?.id;
        return {
          ...newStep,
          id: existingId ?? newStep.id, // Keep existing ID if available
        };
      });

      // Derive new start position
      const newStartPosition = mergedSteps.length > 0
        ? startPositionDeriver.deriveFromFirstBeat(mergedSteps[0])
        : existingSequence.startPosition;

      // Update sequence in place - same ID, new data
      // Include spellData in metadata for word label styling persistence
      sequenceState.setCurrentSequence({
        ...existingSequence,
        steps: mergedSteps,
        startPosition: newStartPosition,
        metadata: {
          ...existingSequence.metadata,
          spellData: {
            originalWord: spellState.inputWord,
            expandedWord: spellState.expandedWord || spellState.inputWord,
            letterSources: parseResult.letterSources || [],
          },
        },
      });

      // Also update the display start position (separate from sequence.startPosition)
      if (newStartPosition) {
        sequenceState.setSelectedStartPosition(newStartPosition);
      }

    } catch (error) {
      console.error("Failed to shuffle sequence:", error);
      spellState.setError(error instanceof Error ? error.message : "Shuffle failed");
    } finally {
      spellState.setGenerating(false);
    }
  }

  function handleTransform() {
    // Open the sequence actions panel for transforms
    createModuleContext?.panelState?.openSequenceActionsPanel();
  }

  function handleNewWord() {
    // Clear everything and start fresh
    spellState.clearSpellState();
    if (sequenceState) {
      sequenceState.clearSequenceCompletely();
    }
    saveSpellState({
      wizardPhase: "preferences",
      inputWord: "",
      expandedWord: "",
      preferences: spellState.preferences,
      hasGeneratedOnce: spellState.hasGeneratedOnce,
    });
  }

  function handleRefine() {
    // Go back to preferences (keep word and settings for refinement)
    spellState.setWizardPhase("preferences");
  }

  // ============================================================================
  // SHARED
  // ============================================================================

  function handleClear() {
    spellState.clearSpellState();
    if (sequenceState) {
      sequenceState.clearSequenceCompletely();
    }
    // Clear persisted state
    saveSpellState({
      wizardPhase: "preferences",
      inputWord: "",
      expandedWord: "",
      preferences: spellState.preferences,
      hasGeneratedOnce: false,
    });
  }

  // Derived: check if we have a sequence in sequenceState
  const hasSequence = $derived(sequenceState?.currentSequence !== null);
</script>

<div class="spell-panel" data-is-desktop={isDesktop}>
  {#if spellState.error}
    <div class="error-banner" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span class="error-message">{spellState.error}</span>
      <button
        class="error-dismiss"
        onclick={() => spellState.clearError()}
        aria-label="Dismiss error"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/if}

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
      {isInputMode}
      {keyboardHeight}
      onInputFocusChange={handleInputFocusChange}
    />

    <!-- Keyboard toolbar for touch devices -->
    {#if isTouchDevice}
      <SpellInputToolbar
        visible={isInputFocused}
        canGenerate={spellState.inputWord.length > 0}
        isGenerating={spellState.isGenerating}
        word={spellState.inputWord}
        onDone={handleToolbarDone}
        onGenerate={handleGenerate}
        onKeyboardVisibilityChange={handleKeyboardVisibilityChange}
      />
    {/if}

  {:else if spellState.wizardPhase === "generating"}
    <!-- GENERATING PHASE -->
    <div class="generation-phase" role="status" aria-live="polite" aria-busy="true">
      <div class="progress-content">
        <div class="spinner" aria-hidden="true"></div>
        <h3 class="progress-title">Generating your sequence...</h3>
      </div>
    </div>

  {:else if spellState.wizardPhase === "results" && hasSequence}
    <!-- RESULTS PHASE - Controls only, workspace shows sequence -->
    <div class="results-controls">
      <div class="word-display">{spellState.expandedWord || spellState.inputWord}</div>
      <p class="step-count">{sequenceState?.currentSequence?.steps?.length ?? 0} steps</p>

      <div class="action-buttons">
        <button class="action-button primary" onclick={handleShuffle}>
          <i class="fas fa-sync-alt" aria-hidden="true"></i>
          Shuffle
        </button>
        <button class="action-button secondary" onclick={handleTransform}>
          <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
          Transform
        </button>
        <button class="action-button secondary" onclick={handleNewWord}>
          <i class="fas fa-plus" aria-hidden="true"></i>
          New Word
        </button>
        <button class="action-button secondary" onclick={handleRefine}>
          <i class="fas fa-sliders-h" aria-hidden="true"></i>
          Refine...
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .spell-panel {
    container-type: inline-size;
    container-name: spell-panel;
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 0;
    overflow: hidden;
  }

  /* Ensure child phases fill the available space */
  .spell-panel > :global(*) {
    flex: 1;
    min-height: 0;
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1.5px solid var(--semantic-error, #ef4444);
    border-radius: var(--settings-radius-md, 12px);
    margin: var(--settings-spacing-sm, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
  }

  .error-banner i:first-child {
    color: var(--semantic-error, #ef4444);
    flex-shrink: 0;
  }

  .error-message {
    flex: 1;
    line-height: 1.4;
  }

  .error-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    flex-shrink: 0;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .error-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, #ffffff);
  }

  .error-dismiss:focus-visible {
    outline: 2px solid var(--semantic-error, #ef4444);
    outline-offset: 2px;
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

  /* Results Controls - action buttons only, no preview */
  .results-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-lg, 24px);
    padding: var(--settings-spacing-lg, 24px);
    text-align: center;
  }

  .word-display {
    font-size: var(--font-size-xl, 24px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .step-count {
    margin: 0;
    font-size: var(--font-size-md, 16px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .action-buttons {
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

  .action-button:focus-visible {
    outline: 2px solid var(--theme-accent, rgba(139, 92, 246, 0.8));
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-button {
      transition: none;
    }

    .action-button.primary:hover {
      transform: none;
    }

    .spinner {
      animation: none;
    }
  }
</style>

<!--
SpellPanel.svelte - Word-to-Sequence Generation Panel (Container-Aware)

Adapts to available space:
- Tall viewport: Full accordion layout
- Constrained viewport: Horizontal chip bar with bottom sheet

Uses container queries to detect available height and switch layouts.
Same functionality, different density.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { SequenceState } from "$lib/features/create/shared/state/SequenceStateOrchestrator.svelte";
  import type { SpellTabState } from "../state/spell-tab-state.svelte";
  import { container as diContainer } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IVariationExplorationOrchestrator } from "../services/contracts/IVariationExplorationOrchestrator";
  import type { IRandomSequenceGenerator } from "../services/contracts/IRandomSequenceGenerator";
  import type { ISpellServiceLoader } from "../services/contracts/ISpellServiceLoader";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import WordInput from "./WordInput.svelte";
  import SpellSettingsBar from "./SpellSettingsBar.svelte";
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
  const deviceDetector = diContainer.items.deviceDetector as IDeviceDetector;
  const haptic = diContainer.items.hapticFeedback as IHapticFeedback;
  let hasTouchCapability = $state(false);
  let isInputFocused = $state(false);

  // Loop chip expansion state - when expanded, it takes over the full panel
  let isLoopExpanded = $state(false);

  // Keyboard state
  let hasVirtualKeyboard = $state(false);
  // Note: containerHeight ALREADY shrinks when keyboard opens (viewport pushes up)
  // We only need to account for the toolbar (60px fixed) sitting at the bottom

  // Container height tracking for smart layout decisions
  let panelElement: HTMLElement | null = $state(null);
  let containerHeight = $state(0);

  // The toolbar is 60px fixed height. When keyboard is open, we need to reserve
  // space for the toolbar since it sits above the keyboard.
  const TOOLBAR_HEIGHT = 60;

  // Calculate available height for content.
  // containerHeight = panel's offsetHeight (already reduced by keyboard on most browsers)
  // We only subtract toolbar height since that's the fixed overlay at the bottom
  const availableHeight = $derived(
    hasVirtualKeyboard ? containerHeight - TOOLBAR_HEIGHT : containerHeight
  );

  // Threshold: minimum height to show full layout (input + settings + generate button)
  // Below this, we collapse to input-only mode
  const FULL_LAYOUT_MIN_HEIGHT = 350; // ~350px fits word input + settings bar + generate button

  // Should we show the collapsed input-only layout?
  // Only collapse if: keyboard is visible AND not enough space for full layout
  const shouldCollapseLayout = $derived(
    isInputFocused && hasVirtualKeyboard && availableHeight < FULL_LAYOUT_MIN_HEIGHT
  );

  // Legacy name for backwards compatibility with parent layout notification
  const isInputMode = $derived(shouldCollapseLayout);

  // Get context
  const createModuleContext = tryGetCreateModuleContext();

  // Notify parent layout when input mode changes
  $effect(() => {
    createModuleContext?.layout?.setInputMode(isInputMode);
  });

  // Lazy-resolved services
  let orchestrator: IVariationExplorationOrchestrator | null = null;
  let serviceLoader: ISpellServiceLoader | null = null;
  let randomGenerator: IRandomSequenceGenerator | null = null;

  function getServiceLoader(): ISpellServiceLoader {
    if (!serviceLoader) {
      serviceLoader = diContainer.items.spellServiceLoader as ISpellServiceLoader;
    }
    return serviceLoader;
  }

  function getOrchestrator(): IVariationExplorationOrchestrator {
    if (!orchestrator) {
      orchestrator = diContainer.items.variationExplorationOrchestrator as IVariationExplorationOrchestrator;
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

  // Load persisted state on mount
  onMount(() => {
    hasTouchCapability = deviceDetector.isTouchDevice();

    const persisted = loadSpellState();
    if (persisted.inputWord) {
      spellState.setInputWord(persisted.inputWord);
    }
    if (persisted.expandedWord) {
      spellState.setExpandedWord(persisted.expandedWord);
    }
  });

  // Track container height for smart layout decisions
  $effect(() => {
    if (!panelElement) return;

    const updateHeight = () => {
      containerHeight = panelElement?.offsetHeight ?? 0;
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(panelElement);

    return () => resizeObserver.disconnect();
  });

  function handleInputFocusChange(focused: boolean) {
    isInputFocused = focused;
  }

  function handleToolbarDone() {
    isInputFocused = false;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function handleKeyboardHeightChange(height: number) {
    // Track keyboard visibility for smart layout decisions
    // Note: we only care IF keyboard is visible, not exact height
    // (container height already shrinks when keyboard opens)
    hasVirtualKeyboard = height > 0;
  }

  // Auto-save state when it changes
  $effect(() => {
    const word = spellState.inputWord;
    const expanded = spellState.expandedWord;
    const prefs = spellState.preferences;
    const hasGenerated = spellState.hasGeneratedOnce;

    saveSpellState({
      inputWord: word,
      expandedWord: expanded,
      preferences: prefs,
      hasGeneratedOnce: hasGenerated,
    });
  });

  // Derived
  const canGenerate = $derived(spellState.inputWord.trim().length > 0 && !spellState.isGenerating);

  // ============================================================================
  // HELPERS
  // ============================================================================

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
  // HANDLERS
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

  async function handleGenerate() {
    if (!spellState.inputWord.trim() || !sequenceState) return;

    haptic.trigger("selection");
    spellState.setGenerating(true);
    spellState.clearError();

    try {
      const orch = getOrchestrator();
      const generator = await getRandomGenerator();

      // Parse word WITH bridge letters (pass preferences for dash preference)
      const parseResult = await orch.parseWord(spellState.inputWord, {
        preferences: spellState.preferences,
      });
      if (!parseResult.success || !parseResult.expandedLetters) {
        haptic.trigger("error");
        spellState.setError(parseResult.error || "Could not parse word");
        return;
      }

      const letters = parseResult.expandedLetters;
      spellState.setExpandedWord(parseResult.expandedWord || spellState.inputWord);

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

      const constraintSet = createConstraintSet(spellState.preferences.constraintPreset, {
        handPathMode: spellState.preferences.handPathMode,
      });

      // Generate sequence
      const sequence = await generator.generateRandomSequence(
        letters,
        {
          gridMode: spellState.selectedGridMode,
          constraints,
          constraintSet,
          letterSources: parseResult.letterSources,
        }
      );

      if (!sequence) {
        haptic.trigger("error");
        spellState.setError("Could not generate a valid sequence. Try different settings.");
        return;
      }

      const sequenceWithStart = deriveStartPosition(sequence);

      // Check if LOOP was applied (sequence has extended data in metadata)
      const loopSpellData = sequenceWithStart.metadata?.spellData as {
        expandedWord?: string;
        letterSources?: typeof parseResult.letterSources;
        appliedLOOPType?: string;
      } | undefined;

      // Use LOOP-extended data if available, otherwise use parse results
      const finalExpandedWord = loopSpellData?.expandedWord || spellState.expandedWord || spellState.inputWord;
      const finalLetterSources = loopSpellData?.letterSources || parseResult.letterSources || [];

      // Update spell state with the final (possibly LOOP-extended) data
      spellState.setExpandedWord(finalExpandedWord);
      spellState.setLetterSources(finalLetterSources);

      sequenceState.setCurrentSequence({
        ...sequenceWithStart,
        name: spellState.inputWord,
        intendedWord: spellState.inputWord, // User's intended word (before bridges)
        word: finalExpandedWord,
        metadata: {
          ...sequenceWithStart.metadata,
          spellData: {
            originalWord: spellState.inputWord,
            expandedWord: finalExpandedWord,
            letterSources: finalLetterSources,
            ...(loopSpellData?.appliedLOOPType && { appliedLOOPType: loopSpellData.appliedLOOPType }),
          },
        },
      });

      if (sequenceWithStart.startPosition) {
        sequenceState.setSelectedStartPosition(sequenceWithStart.startPosition);
      }

      spellState.pushUndoSnapshot(UndoOperationType.SPELL_GENERATE, {
        word: spellState.inputWord,
      });

      spellState.markHasGeneratedOnce();
      haptic.trigger("success");

    } catch (error) {
      console.error("Failed to generate sequence:", error);
      haptic.trigger("error");
      spellState.setError(error instanceof Error ? error.message : "Generation failed");
    } finally {
      spellState.setGenerating(false);
    }
  }

  function handleDismissError() {
    haptic.trigger("selection");
    spellState.clearError();
  }

  function handleLoopExpandedChange(expanded: boolean) {
    isLoopExpanded = expanded;
  }
</script>

<div
  bind:this={panelElement}
  class="spell-panel"
  class:input-mode={shouldCollapseLayout}
  class:loop-expanded={isLoopExpanded}
  data-is-desktop={isDesktop}
>
  <!-- Error Banner - hidden in collapsed mode or when Loop is expanded -->
  {#if spellState.error && !shouldCollapseLayout && !isLoopExpanded}
    <div class="error-banner" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span class="error-message">{spellState.error}</span>
      <button
        class="error-dismiss"
        onclick={handleDismissError}
        aria-label="Dismiss error"
      >
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/if}

  <!-- Word Input - hidden when Loop chip is expanded (it takes over) -->
  {#if !isLoopExpanded}
    <section class="word-section">
      <WordInput
        value={spellState.inputWord}
        onInput={handleWordChange}
        onFocusChange={handleInputFocusChange}
        onSubmit={handleGenerate}
      />
    </section>
  {/if}

  <!-- Settings - hidden only when collapsed (small screen + keyboard) -->
  {#if !shouldCollapseLayout}
    <section class="settings-section" class:loop-expanded={isLoopExpanded}>
      <SpellSettingsBar
        gridMode={spellState.selectedGridMode}
        preferences={spellState.preferences}
        onGridModeChange={handleGridModeChange}
        onPreferenceChange={handlePreferenceChange}
        onLoopExpandedChange={handleLoopExpandedChange}
      />
    </section>

    <!-- Generate Button - hidden in input mode or when Loop expanded -->
    {#if !isLoopExpanded}
      <button
        class="generate-button"
        class:generating={spellState.isGenerating}
        onclick={handleGenerate}
        disabled={!canGenerate}
        aria-label={canGenerate ? "Generate sequence" : "Enter a word first"}
      >
        {#if spellState.isGenerating}
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
          <span>Generating...</span>
        {:else}
          <i class="fas fa-magic" aria-hidden="true"></i>
          <span>Generate</span>
        {/if}
      </button>
    {/if}
  {/if}

  <!-- Keyboard toolbar for touch devices - detects actual keyboard visibility -->
  <!-- Shows Generate+Done when collapsed, just Done when full layout visible -->
  {#if hasTouchCapability}
    <SpellInputToolbar
      visible={isInputFocused}
      word={spellState.inputWord}
      showGenerate={shouldCollapseLayout}
      canGenerate={spellState.inputWord.length > 0}
      isGenerating={spellState.isGenerating}
      onDone={handleToolbarDone}
      onGenerate={handleGenerate}
      onKeyboardHeightChange={handleKeyboardHeightChange}
    />
  {/if}
</div>

<style>
  .spell-panel {
    /* Query the parent tool-panel container, not self */
    container-type: inline-size;
    container-name: spell-panel;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    margin: 0 auto;
    height: 100%;
    min-height: 0;
    /* No scrolling - content must always fit via intelligent layout switching */
    overflow: hidden;

    /* Fluid spacing: 1vh scales naturally with viewport */
    --fluid-space: clamp(4px, 1vh, 12px);
    gap: var(--fluid-space);
    padding: var(--fluid-space);

    /* Scale factor for large screens - used by child components */
    --spell-scale: 1;

    /* Default max-width for mobile/small screens */
    max-width: 500px;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     INPUT MODE - Distraction-free typing on touch devices
     When virtual keyboard is present, hide settings and center the input
     in the available space ABOVE the toolbar (60px fixed height)
     ═══════════════════════════════════════════════════════════════════════════ */
  .spell-panel.input-mode {
    /* Center the word input in the available vertical space */
    justify-content: center;
    gap: 8px;
    /* Add bottom padding for the 60px toolbar so centering respects available space */
    padding-bottom: calc(var(--fluid-space) + 60px);
  }

  /* Medium height: expanded settings layout kicks in at 700px (matches SpellSettingsBar threshold) */
  @container tool-panel (min-height: 700px) {
    .spell-panel {
      max-width: 520px;
      --spell-scale: 1;
      --fluid-space: clamp(6px, 1vh, 12px);
    }
  }

  /* Large height: more room to breathe */
  @container tool-panel (min-height: 800px) {
    .spell-panel {
      max-width: 560px;
      --spell-scale: 1.02;
      --fluid-space: clamp(6px, 1.2vh, 14px);
    }
  }

  /* Sections */
  .word-section,
  .settings-section {
    flex-shrink: 0;
  }

  /* When Loop is expanded, settings section takes all available space */
  .settings-section.loop-expanded {
    flex: 1;
    min-height: 0;
    /* Center the content within the expanded section */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Panel state when Loop is expanded - use flex-start, section will fill via flex:1 */
  .spell-panel.loop-expanded {
    justify-content: flex-start;
  }

  /* Generate Button - scales with container */
  .generate-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: calc(8px * var(--spell-scale));
    width: 100%;
    min-height: calc(48px * var(--spell-scale));
    padding: calc(12px * var(--spell-scale)) calc(16px * var(--spell-scale));
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: calc(var(--settings-radius-md, 12px) * var(--spell-scale));
    color: white;
    font-size: calc(var(--font-size-min, 14px) * var(--spell-scale));
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .generate-button i {
    font-size: calc(16px * var(--spell-scale));
  }

  .generate-button:hover:not(:disabled) {
    background: var(--theme-accent-hover, #4f46e5);
  }

  /* Immediate press feedback */
  .generate-button:active:not(:disabled) {
    transform: scale(0.96);
    background: var(--theme-accent-hover, #4f46e5);
  }

  .generate-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 4px;
  }

  .generate-button:disabled {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    cursor: not-allowed;
  }

  /* Generating state - pulse animation for visual feedback */
  .generate-button.generating {
    animation: generatePulse 600ms ease-out;
    pointer-events: none;
  }

  @keyframes generatePulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5);
    }
    30% {
      transform: scale(0.97);
    }
    60% {
      box-shadow: 0 0 0 8px rgba(99, 102, 241, 0);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
    }
  }

  /* Error Banner - scales with container */
  .error-banner {
    display: flex;
    align-items: center;
    gap: calc(8px * var(--spell-scale));
    padding: calc(8px * var(--spell-scale)) calc(12px * var(--spell-scale));
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1.5px solid var(--semantic-error, #ef4444);
    border-radius: calc(var(--settings-radius-md, 12px) * var(--spell-scale));
    color: var(--theme-text, #ffffff);
    font-size: calc(var(--font-size-min, 14px) * var(--spell-scale));
    flex-shrink: 0;
  }

  .error-banner i:first-child {
    color: var(--semantic-error, #ef4444);
    flex-shrink: 0;
    font-size: calc(16px * var(--spell-scale));
  }

  .error-message {
    flex: 1;
    line-height: 1.4;
  }

  .error-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(48px * var(--spell-scale));
    height: calc(48px * var(--spell-scale));
    margin: calc(-8px * var(--spell-scale)) calc(-8px * var(--spell-scale)) calc(-8px * var(--spell-scale)) 0;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: var(--settings-radius-sm, 8px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    flex-shrink: 0;
    transition: all 150ms ease;
  }

  .error-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text, #ffffff);
  }

  .error-dismiss:focus-visible {
    outline: 2px solid var(--semantic-error, #ef4444);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .generate-button,
    .error-dismiss {
      transition: none;
    }
  }
</style>

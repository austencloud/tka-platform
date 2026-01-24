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
  import type { IVariationExplorationOrchestrator } from "../services/contracts/IVariationExplorationOrchestrator";
  import type { IRandomSequenceGenerator } from "../services/contracts/IRandomSequenceGenerator";
  import type { ISpellServiceLoader } from "../services/contracts/ISpellServiceLoader";
  import { startPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { UndoOperationType } from "$lib/features/create/shared/services/contracts/IUndoManager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/features/create/shared/domain/models/SequenceData";
  import WordInput from "./WordInput.svelte";
  import SettingsAccordion from "./SettingsAccordion.svelte";
  import SettingsChipBar from "./SettingsChipBar.svelte";
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
  let isTouchDevice = $state(false);
  let isInputFocused = $state(false);

  // Input mode for mobile keyboard
  const isInputMode = $derived(isInputFocused && isTouchDevice);

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
    isTouchDevice = deviceDetector.isTouchDevice();

    const persisted = loadSpellState();
    if (persisted.inputWord) {
      spellState.setInputWord(persisted.inputWord);
    }
    if (persisted.expandedWord) {
      spellState.setExpandedWord(persisted.expandedWord);
    }
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

      const constraintSet = createConstraintSet(spellState.preferences.constraintPreset);

      // Generate sequence
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
        return;
      }

      const sequenceWithStart = deriveStartPosition(sequence);

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

      if (sequenceWithStart.startPosition) {
        sequenceState.setSelectedStartPosition(sequenceWithStart.startPosition);
      }

      spellState.pushUndoSnapshot(UndoOperationType.SPELL_GENERATE, {
        word: spellState.inputWord,
      });

      spellState.markHasGeneratedOnce();

    } catch (error) {
      console.error("Failed to generate sequence:", error);
      spellState.setError(error instanceof Error ? error.message : "Generation failed");
    } finally {
      spellState.setGenerating(false);
    }
  }
</script>

<div class="spell-panel" data-is-desktop={isDesktop}>
  <!-- Error Banner -->
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

  <!-- Word Input -->
  <section class="word-section">
    <WordInput
      value={spellState.inputWord}
      onInput={handleWordChange}
      onFocusChange={handleInputFocusChange}
    />
  </section>

  <!-- Settings: Accordion for tall viewports, Chip bar for constrained -->
  <div class="settings-container">
    <div class="settings-accordion">
      <SettingsAccordion
        gridMode={spellState.selectedGridMode}
        preferences={spellState.preferences}
        onGridModeChange={handleGridModeChange}
        onPreferenceChange={handlePreferenceChange}
      />
    </div>
    <div class="settings-chips">
      <SettingsChipBar
        gridMode={spellState.selectedGridMode}
        preferences={spellState.preferences}
        onGridModeChange={handleGridModeChange}
        onPreferenceChange={handlePreferenceChange}
      />
    </div>
  </div>

  <!-- Generate Button -->
  <button
    class="generate-button"
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

  <!-- Keyboard toolbar for touch devices -->
  {#if isTouchDevice}
    <SpellInputToolbar
      visible={isInputFocused}
      canGenerate={spellState.inputWord.length > 0}
      isGenerating={spellState.isGenerating}
      word={spellState.inputWord}
      onDone={handleToolbarDone}
      onGenerate={handleGenerate}
    />
  {/if}
</div>

<style>
  .spell-panel {
    container-type: size;
    container-name: spell-panel;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    padding: 12px;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    height: 100%;
    min-height: 0;
    overflow-y: auto;
  }

  /* Mobile: add bottom nav padding */
  .spell-panel:not([data-is-desktop="true"]) {
    padding-bottom: calc(12px + 70px + env(safe-area-inset-bottom, 0px));
  }

  /* Word Section */
  .word-section {
    flex-shrink: 0;
  }

  /* Generate Button */
  .generate-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    flex-shrink: 0;
  }

  .generate-button:hover:not(:disabled) {
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

  /* Settings Container - switches between accordion and chips based on available height */
  .settings-container {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  /* Default: show accordion, hide chips */
  .settings-accordion {
    display: block;
  }

  .settings-chips {
    display: none;
  }

  /*
   * Container query: switch to chips only when height is severely constrained.
   *
   * Accordion minimum: 4 collapsed items × 48px + 3 gaps × 8px = 216px
   * Chips minimum: 2 rows × 56px + 1 gap × 8px = 120px
   *
   * Other panel content: input(~70px) + button(~60px) + gaps(~36px) = ~166px
   * Bottom padding for nav: ~82px (70px nav + 12px padding)
   *
   * Total for accordion: 166 + 216 + 82 = ~464px
   * Total for chips: 166 + 120 + 82 = ~368px
   *
   * Use chips only when container height < 400px
   * This accounts for the bottom nav padding in the container measurement.
   */
  @container spell-panel (max-height: 400px) {
    .settings-accordion {
      display: none;
    }

    .settings-chips {
      display: block;
    }
  }

  /* Error Banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1.5px solid var(--semantic-error, #ef4444);
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    flex-shrink: 0;
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
    width: 48px;
    height: 48px;
    margin: -8px -8px -8px 0;
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

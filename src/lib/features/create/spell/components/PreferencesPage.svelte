<!--
PreferencesPage.svelte - Single-page preference collection

Simplified preferences:
- Word input (primary focus)
- Grid mode (Diamond/Box)
- Motion style (dash preferences)
- Generation style (reversal/flow preferences)
- Loop toggle

Keyboard-aware input mode:
- On touch devices, focusing the input triggers "input mode"
- Header and other preferences collapse to give more room
- Keyboard toolbar appears above virtual keyboard
-->
<script lang="ts">
  import type { SpellPreferences } from "../domain/models/spell-models";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { CONSTRAINT_PRESETS } from "$lib/shared/sequence-engine/constraints";
  import WordInput from "./WordInput.svelte";

  let {
    word,
    onWordChange,
    gridMode,
    onGridModeChange,
    preferences,
    onPreferenceChange,
    onGenerate,
    estimatedCount = null,
    isEstimating = false,
    isInputMode = false,
    keyboardHeight = 0,
    onInputFocusChange,
  }: {
    word: string;
    onWordChange: (word: string) => void;
    gridMode: GridMode;
    onGridModeChange: (mode: GridMode) => void;
    preferences: SpellPreferences;
    onPreferenceChange: <K extends keyof SpellPreferences>(
      key: K,
      value: SpellPreferences[K]
    ) => void;
    onGenerate: () => void;
    estimatedCount?: number | null;
    isEstimating?: boolean;
    /** When true, form is in distraction-free input mode */
    isInputMode?: boolean;
    /** Keyboard height in pixels (for smart positioning) */
    keyboardHeight?: number;
    /** Called when input focus changes */
    onInputFocusChange?: (focused: boolean) => void;
  } = $props();

  // Calculate available space and center the input when keyboard is visible
  // Toolbar is ~60px, so total bottom inset = keyboardHeight + 60
  const toolbarHeight = 60;
  const bottomInset = $derived(keyboardHeight > 0 ? keyboardHeight + toolbarHeight : 0);

  // Grid mode options
  const gridModes: { value: GridMode; label: string }[] = [
    { value: "diamond" as GridMode, label: "Diamond" },
    { value: "box" as GridMode, label: "Box" },
  ];

  // Motion options - controls dash letter inclusion
  const motionOptions = [
    { value: null, label: "Any" },
    { value: "dash" as const, label: "Dashes Only" },
    { value: "no-dash" as const, label: "No Dashes" },
  ];

  const canGenerate = $derived(word.length > 0);
</script>

<div
  class="preferences-page"
  class:input-mode={isInputMode}
  style:--keyboard-bottom-inset="{bottomInset}px"
>
  <!-- Header - collapses in input mode -->
  <header class="page-header" class:collapsed={isInputMode}>
    <h2 class="page-title">Spell a Word</h2>
    <p class="page-subtitle">Enter your word and we'll generate a sequence</p>
  </header>

  <!-- Word Input Section - centered in available space when keyboard is up -->
  <section class="word-section" class:keyboard-active={isInputMode && keyboardHeight > 0}>
    <WordInput
      value={word}
      onInput={onWordChange}
      onFocusChange={onInputFocusChange}
    />
  </section>

  <!-- Options Card - collapses in input mode -->
  <div class="options-card" class:collapsed={isInputMode}>
    <!-- Grid Mode -->
    <section class="preference-section">
      <h3 class="section-title">Grid</h3>
      <div class="chip-group" role="radiogroup" aria-label="Grid mode">
        {#each gridModes as mode}
          <button
            class="chip"
            class:active={gridMode === mode.value}
            onclick={() => onGridModeChange(mode.value)}
            role="radio"
            aria-checked={gridMode === mode.value}
          >
            {mode.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- Motion Style -->
    <section class="preference-section">
      <h3 class="section-title">Dashes</h3>
      <div class="chip-group" role="radiogroup" aria-label="Dash preference">
        {#each motionOptions as option}
          <button
            class="chip"
            class:active={preferences.motionTypeFilter === option.value}
            onclick={() => onPreferenceChange("motionTypeFilter", option.value)}
            role="radio"
            aria-checked={preferences.motionTypeFilter === option.value}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- Generation Style (controls reversals) -->
    <section class="preference-section">
      <h3 class="section-title">Flow</h3>
      <div class="chip-group" role="radiogroup" aria-label="Flow style">
        {#each CONSTRAINT_PRESETS as preset}
          <button
            class="chip chip-with-icon"
            class:active={preferences.constraintPreset === preset.id}
            onclick={() => onPreferenceChange("constraintPreset", preset.id)}
            role="radio"
            aria-checked={preferences.constraintPreset === preset.id}
            title={preset.description}
          >
            <i class="fas {preset.icon}" aria-hidden="true"></i>
            <span>{preset.label}</span>
          </button>
        {/each}
      </div>
    </section>

    <!-- Loop Toggle -->
    <section class="preference-section">
      <button
        class="loop-toggle"
        class:active={preferences.makeCircular}
        onclick={() => onPreferenceChange("makeCircular", !preferences.makeCircular)}
        aria-pressed={preferences.makeCircular}
      >
        <span class="loop-icon" aria-hidden="true">
          {#if preferences.makeCircular}
            <i class="fas fa-check-circle"></i>
          {:else}
            <i class="far fa-circle"></i>
          {/if}
        </span>
        <span class="loop-label">Loop</span>
      </button>
    </section>
  </div>

  <!-- Generate Button - hidden in input mode (toolbar has it) -->
  {#if !isInputMode}
    <div class="generate-section">
      {#if estimatedCount !== null}
        <p class="estimate-text">
          {#if isEstimating}
            Estimating...
          {:else}
            ~{estimatedCount} variations
          {/if}
        </p>
      {/if}

      <button
        class="generate-button"
        onclick={onGenerate}
        disabled={!canGenerate}
        aria-label={canGenerate ? "Generate sequence" : "Enter a word first"}
      >
        <i class="fas fa-magic" aria-hidden="true"></i>
        <span>Generate</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .preferences-page {
    container-type: inline-size;
    container-name: preferences-page;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    padding: var(--settings-spacing-md, 16px);
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* Input mode - focused on word entry, intelligently positioned */
  .preferences-page.input-mode {
    /* Account for keyboard + toolbar at bottom */
    padding-bottom: var(--keyboard-bottom-inset, 0px);
    /* Center content in remaining space */
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  /* Header */
  .page-header {
    text-align: center;
    transition:
      max-height 150ms ease-out,
      opacity 150ms ease-out,
      margin 150ms ease-out;
    max-height: 100px;
    overflow: hidden;
  }

  .page-header.collapsed {
    max-height: 0;
    opacity: 0;
    margin: 0;
  }

  .page-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .page-subtitle {
    margin: 4px 0 0 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  /* Word Section - always visible and prominent */
  .word-section {
    flex-shrink: 0;
    transition: transform 200ms ease-out;
  }

  /* When keyboard is active, the word input is the star of the show */
  .word-section.keyboard-active {
    /* Slight scale up to emphasize focus */
    transform: scale(1.02);
  }

  /* Options Card */
  .options-card {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-lg, 16px);
    transition:
      max-height 150ms ease-out,
      opacity 150ms ease-out,
      padding 150ms ease-out,
      margin 150ms ease-out;
    max-height: 400px;
    overflow: hidden;
  }

  .options-card.collapsed {
    max-height: 0;
    opacity: 0;
    padding: 0;
    margin: 0;
    border-width: 0;
  }

  /* Preference Sections */
  .preference-section {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
  }

  .section-title {
    margin: 0;
    min-width: 60px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Chip Groups */
  .chip-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-xs, 4px);
    flex: 1;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    min-height: 48px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .chip.active:hover {
    background: var(--theme-accent-hover, #4f46e5);
    border-color: var(--theme-accent-hover, #4f46e5);
  }

  /* Chips with icons */
  .chip-with-icon {
    gap: 4px;
  }

  .chip-with-icon i {
    font-size: 11px;
    opacity: 0.7;
  }

  .chip-with-icon.active i {
    opacity: 1;
  }

  /* Loop Toggle - compact inline style */
  .loop-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    min-height: 48px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .loop-toggle:hover {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
  }

  .loop-toggle.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .loop-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .loop-icon {
    font-size: 14px;
  }

  .loop-label {
    font-weight: 600;
  }

  /* Generate Section */
  .generate-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    align-items: center;
    margin-top: auto;
    padding-top: var(--settings-spacing-md, 16px);
  }

  .estimate-text {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .generate-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 300px;
    min-height: 52px;
    padding: 14px 24px;
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    color: white;
    font-size: var(--font-size-md, 16px);
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .generate-button:hover:not(:disabled) {
    background: var(--theme-accent-hover, #4f46e5);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  }

  .generate-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .generate-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 4px;
  }

  .generate-button:disabled {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    cursor: not-allowed;
    opacity: 0.6;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .page-header,
    .options-card,
    .chip,
    .loop-toggle,
    .generate-button,
    .word-section {
      transition: none;
    }

    .generate-button:hover:not(:disabled),
    .word-section.keyboard-active {
      transform: none;
    }
  }
</style>

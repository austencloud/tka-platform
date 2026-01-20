<!--
PreferencesPage.svelte - Single-page preference collection

New "preferences-first" flow:
- User sets ALL preferences upfront before generation
- Word input + Grid mode + Length + Motion + Reversals + Loop
- "Generate Matching" button triggers constrained exploration
- Shows count of variations that will match (estimated)
-->
<script lang="ts">
  import type { SpellPreferences } from "../domain/models/spell-models";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import WordInput from "./WordInput.svelte";
  import QuickGreekBar from "./QuickGreekBar.svelte";
  import LetterPalette from "./LetterPalette.svelte";

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
    showGreekBar = true,
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
    showGreekBar?: boolean;
  } = $props();

  // Grid mode options
  const gridModes: { value: GridMode; label: string }[] = [
    { value: "diamond" as GridMode, label: "Diamond" },
    { value: "box" as GridMode, label: "Box" },
  ];

  // Length options - these will be populated from actual variation data
  const lengthOptions = [
    { value: null, label: "Any Length" },
    { value: 3, label: "3 steps" },
    { value: 6, label: "6 steps" },
    { value: 9, label: "9 steps" },
    { value: 12, label: "12 steps" },
  ];

  // Motion options
  const motionOptions = [
    { value: null, label: "Any Motion" },
    { value: "dash" as const, label: "Dashes Only" },
    { value: "no-dash" as const, label: "No Dashes" },
  ];

  // Reversal options
  const reversalOptions = [
    { value: null, label: "Any" },
    { value: 0, label: "None" },
    { value: 2, label: "Few (1-2)" },
  ];

  function handleLetterClick(letter: string) {
    onWordChange(word + letter);
  }

  const canGenerate = $derived(word.length > 0);
</script>

<div class="preferences-page">
  <!-- Header -->
  <div class="page-header">
    <h2 class="page-title">Set Your Preferences</h2>
    <p class="page-subtitle">
      Choose your word and constraints. We'll generate only matching variations.
    </p>
  </div>

  <!-- Content Card -->
  <div class="content-card">
    <!-- Word Input Section -->
    <section class="preference-section">
      <h3 class="section-title">Word</h3>
      <WordInput
        value={word}
        onInput={onWordChange}
      />

      {#if showGreekBar}
        <QuickGreekBar onSelect={handleLetterClick} />
      {/if}
    </section>

    <!-- Grid Mode Section -->
    <section class="preference-section">
      <h3 class="section-title">Grid Mode</h3>
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

    <!-- Length Section -->
    <section class="preference-section">
      <h3 class="section-title">Length</h3>
      <div class="chip-group" role="radiogroup" aria-label="Sequence length">
        {#each lengthOptions as option}
          <button
            class="chip"
            class:active={preferences.targetStepCount === option.value}
            onclick={() => onPreferenceChange("targetStepCount", option.value)}
            role="radio"
            aria-checked={preferences.targetStepCount === option.value}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- Motion Style Section -->
    <section class="preference-section">
      <h3 class="section-title">Motion Style</h3>
      <div class="chip-group" role="radiogroup" aria-label="Motion style">
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

    <!-- Reversals Section -->
    <section class="preference-section">
      <h3 class="section-title">Reversals</h3>
      <div class="chip-group" role="radiogroup" aria-label="Maximum reversals">
        {#each reversalOptions as option}
          <button
            class="chip"
            class:active={preferences.maxReversals === option.value}
            onclick={() => onPreferenceChange("maxReversals", option.value)}
            role="radio"
            aria-checked={preferences.maxReversals === option.value}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </section>

    <!-- Loop Toggle Section -->
    <section class="preference-section">
      <button
        class="loop-toggle"
        class:active={preferences.makeCircular}
        onclick={() =>
          onPreferenceChange("makeCircular", !preferences.makeCircular)}
        aria-pressed={preferences.makeCircular}
      >
        <span class="loop-icon" aria-hidden="true">
          {#if preferences.makeCircular}
            <i class="fas fa-check-circle"></i>
          {:else}
            <i class="fas fa-circle"></i>
          {/if}
        </span>
        <span class="loop-label">Make Loopable</span>
      </button>
      <p class="loop-hint">
        {#if preferences.makeCircular}
          Sequence will connect end to start
        {:else}
          Turn on to create a looping sequence
        {/if}
      </p>
    </section>
  </div>

  <!-- Generate Button Section -->
  <div class="generate-section">
    {#if estimatedCount !== null}
      <p class="estimate-text">
        {#if isEstimating}
          Estimating variations...
        {:else}
          ~{estimatedCount} variations match
        {/if}
      </p>
    {/if}

    <button
      class="generate-button"
      onclick={onGenerate}
      disabled={!canGenerate}
      aria-label={canGenerate
        ? "Generate matching variations"
        : "Enter a word to generate"}
    >
      <span class="button-icon" aria-hidden="true">
        <i class="fas fa-magic"></i>
      </span>
      <span class="button-text">Generate Matching</span>
    </button>
  </div>
</div>

<style>
  .preferences-page {
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

  /* Content Card */
  .content-card {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-lg, 24px);
    padding: var(--settings-spacing-lg, 24px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-lg, 16px);
  }

  /* Preference Sections */
  .preference-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .section-title {
    margin: 0;
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
  }

  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    min-height: 48px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 24px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
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

  /* Loop Toggle */
  .loop-toggle {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    min-height: 56px;
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
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

  .loop-hint {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    line-height: 1.4;
    padding-left: var(--settings-spacing-sm, 8px);
  }

  /* Generate Section */
  .generate-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    align-items: center;
  }

  .estimate-text {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-weight: 500;
  }

  .generate-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    max-width: 400px;
    min-height: 56px;
    padding: var(--settings-spacing-md, 16px) var(--settings-spacing-lg, 24px);
    background: var(--theme-accent, #6366f1);
    border: none;
    border-radius: var(--settings-radius-md, 12px);
    color: white;
    font-size: var(--font-size-md, 16px);
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
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
  }

  .button-icon {
    font-size: var(--font-size-lg, 18px);
  }

  .button-text {
    font-size: var(--font-size-md, 16px);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .preferences-page {
      padding: var(--settings-spacing-sm, 8px);
    }

    .content-card {
      padding: var(--settings-spacing-md, 16px);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chip,
    .loop-toggle,
    .generate-button {
      transition: none;
    }

    .generate-button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>

<!--
PreferencesPanel.svelte - Generation preferences controls

Modern chip-based UI for sequence generation preferences:
- Prominent LOOP toggle with helpful explanation (can be hidden when extracted to parent)
- Toggle chips for other boolean preferences
- Chip group for motion type preference
-->
<script lang="ts">
  import type { SpellPreferences } from "../domain/models/spell-models";

  let {
    preferences,
    onUpdate,
    showLoopToggle = true,
  }: {
    preferences: SpellPreferences;
    onUpdate: <K extends keyof SpellPreferences>(
      key: K,
      value: SpellPreferences[K]
    ) => void;
    /** Whether to show the Make Loopable toggle (can be hidden when extracted to parent) */
    showLoopToggle?: boolean;
  } = $props();

  // Motion preference options
  const motionOptions = [
    { value: null, label: "Any Motion" },
    { value: "dash" as const, label: "Favor Dashes" },
    { value: "no-dash" as const, label: "Avoid Dashes" },
  ];
</script>

<div class="preferences-panel">
  <!-- Prominent LOOP Toggle Section -->
  {#if showLoopToggle}
    <div class="loop-toggle-section">
      <button
        class="loop-toggle"
        class:active={preferences.makeCircular}
        onclick={() => onUpdate("makeCircular", !preferences.makeCircular)}
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
          Sequence will loop back to start. Choose bridge pictographs below.
        {:else}
          Turn on to create a sequence that connects end to start.
        {/if}
      </p>
    </div>
  {/if}

  <!-- Other preferences (shown without header when loop toggle is hidden) -->
  {#if showLoopToggle}
    <h4 class="section-title">Other Preferences</h4>
  {/if}

  <!-- Boolean toggles as chips -->
  <div class="toggle-chips">
    <button
      class="toggle-chip"
      class:active={preferences.minimizeReversals}
      onclick={() =>
        onUpdate("minimizeReversals", !preferences.minimizeReversals)}
      title="Prefer sequences without prop reversals"
      aria-pressed={preferences.minimizeReversals}
    >
      Minimize Reversals
    </button>

    <button
      class="toggle-chip"
      class:active={preferences.preferContinuous}
      onclick={() =>
        onUpdate("preferContinuous", !preferences.preferContinuous)}
      title="Favor smooth, flowing transitions"
      aria-pressed={preferences.preferContinuous}
    >
      Continuous Flow
    </button>
  </div>

  <!-- Motion type as chip group -->
  <div class="motion-section">
    <span class="motion-label">Motion Style</span>
    <div
      class="motion-chips"
      role="radiogroup"
      aria-label="Motion style preference"
    >
      {#each motionOptions as option}
        <button
          class="motion-chip"
          class:active={preferences.favorMotionType === option.value}
          onclick={() => onUpdate("favorMotionType", option.value)}
          role="radio"
          aria-checked={preferences.favorMotionType === option.value}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .preferences-panel {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-md, 16px);
  }

  /* Prominent LOOP Toggle Section */
  .loop-toggle-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-md, 16px);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 12px);
  }

  .loop-toggle {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    width: 100%;
    min-height: 48px;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 16px);
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-sm, 8px);
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
  }

  .section-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  /* Toggle chips for boolean preferences */
  .toggle-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-sm, 8px);
  }

  .toggle-chip {
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

  .toggle-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .toggle-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .toggle-chip.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .toggle-chip.active:hover {
    background: var(--theme-accent-hover, #4f46e5);
    border-color: var(--theme-accent-hover, #4f46e5);
  }

  /* Motion preference section */
  .motion-section {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .motion-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .motion-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--settings-spacing-xs, 4px);
  }

  .motion-chip {
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

  .motion-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .motion-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .motion-chip.active {
    background: var(--theme-accent, #6366f1);
    border-color: var(--theme-accent, #6366f1);
    color: white;
  }

  .motion-chip.active:hover {
    background: var(--theme-accent-hover, #4f46e5);
    border-color: var(--theme-accent-hover, #4f46e5);
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .loop-toggle,
    .toggle-chip,
    .motion-chip {
      transition: none;
    }
  }
</style>

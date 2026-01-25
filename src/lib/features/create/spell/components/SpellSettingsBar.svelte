<!--
SpellSettingsBar.svelte - Responsive settings UI

Container-aware responsive design:
- Mobile (<500px): Compact morphing chips
- Desktop (≥500px): Expanded sections with all options visible

Features:
- 48px minimum touch targets for WCAG AAA accessibility
- Design token system for consistent spacing/sizing
- Scales with --spell-scale from parent container
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { SpellPreferences } from "../domain/models/spell-models";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  let {
    gridMode,
    preferences,
    onGridModeChange,
    onPreferenceChange,
  }: {
    gridMode: GridMode;
    preferences: SpellPreferences;
    onGridModeChange: (mode: GridMode) => void;
    onPreferenceChange: <K extends keyof SpellPreferences>(
      key: K,
      value: SpellPreferences[K]
    ) => void;
  } = $props();

  const haptic = container.items.hapticFeedback as IHapticFeedback;

  // Which setting is expanded (null = all collapsed)
  let expandedId = $state<string | null>(null);

  // Setting definitions
  const settings = [
    {
      id: "dashes",
      label: "Dashes",
      expandedLabel: "Dashes",
      getValue: () => {
        if (preferences.motionTypeFilter === "no-dash") return "Low";
        if (preferences.motionTypeFilter === "prefer-dash") return "High";
        return "Mixed";
      },
      options: [
        { value: "no-dash", label: "Low" },
        { value: null, label: "Mixed" },
        { value: "prefer-dash", label: "High" },
      ],
      isSelected: (v: unknown) => preferences.motionTypeFilter === v,
      onSelect: (v: string | null) =>
        onPreferenceChange("motionTypeFilter", v as SpellPreferences["motionTypeFilter"]),
    },
    {
      id: "props",
      label: "Props",
      expandedLabel: "Prop Reversals",
      getValue: () => {
        if (preferences.constraintPreset === "smooth") return "Smooth";
        if (preferences.constraintPreset === "high-reversal") return "High";
        return "Mixed";
      },
      options: [
        { value: "smooth", label: "Smooth" },
        { value: "mixed", label: "Mixed" },
        { value: "high-reversal", label: "High" },
      ],
      isSelected: (v: unknown) => preferences.constraintPreset === v,
      onSelect: (v: string) => onPreferenceChange("constraintPreset", v as SpellPreferences["constraintPreset"]),
    },
    {
      id: "hands",
      label: "Hands",
      expandedLabel: "Hand Reversals",
      getValue: () => {
        if (preferences.handPathMode === "smooth") return "Smooth";
        if (preferences.handPathMode === "high") return "High";
        return "Mixed";
      },
      options: [
        { value: "smooth", label: "Smooth" },
        { value: "mixed", label: "Mixed" },
        { value: "high", label: "High" },
      ],
      isSelected: (v: unknown) => preferences.handPathMode === v,
      onSelect: (v: string) =>
        onPreferenceChange("handPathMode", v as SpellPreferences["handPathMode"]),
    },
  ];

  function handleSelect(setting: (typeof settings)[0], value: unknown) {
    haptic.trigger("selection");
    setting.onSelect(value as never);
    expandedId = null;
  }

  function handleChipExpand(settingId: string) {
    haptic.trigger("selection");
    expandedId = settingId;
  }

  function handleChipCollapse() {
    haptic.trigger("selection");
    expandedId = null;
  }

  function toggleLoop() {
    haptic.trigger("selection");
    onPreferenceChange("makeCircular", !preferences.makeCircular);
  }

  function toggleGridMode() {
    haptic.trigger("selection");
    const newMode = gridMode === "diamond" ? "box" : "diamond";
    onGridModeChange(newMode as GridMode);
  }
</script>

<div class="settings-container">
  <!-- ============================================================ -->
  <!-- MOBILE LAYOUT: Compact morphing chips -->
  <!-- ============================================================ -->
  <div class="mobile-layout">
    {#if expandedId === null}
      <!-- Collapsed: show both rows -->
      <div class="chips-row">
        {#each settings as setting}
          <button
            class="chip"
            onclick={() => handleChipExpand(setting.id)}
            aria-expanded={false}
            aria-haspopup="listbox"
          >
            <span class="chip-label">{setting.label}</span>
            <span class="chip-value">{setting.getValue()}</span>
          </button>
        {/each}
      </div>

      <div class="chips-row">
        <button
          class="chip grid-chip"
          onclick={toggleGridMode}
          aria-label="Toggle grid mode between Diamond and Box"
        >
          <span class="chip-label">Grid</span>
          <span class="chip-value">{gridMode === "diamond" ? "Diamond" : "Box"}</span>
        </button>

        <button
          class="chip loop-chip"
          class:loop-active={preferences.makeCircular}
          onclick={toggleLoop}
          aria-pressed={preferences.makeCircular}
        >
          <span class="chip-label">Loop</span>
          <span class="chip-value">{preferences.makeCircular ? "On" : "Off"}</span>
        </button>
      </div>
    {:else}
      <!-- Expanded: single overlay covers both rows -->
      {@const expandedSetting = settings.find(s => s.id === expandedId)}
      {#if expandedSetting}
        <div class="expanded-overlay">
          <button
            class="back-tap"
            onclick={handleChipCollapse}
            aria-label="Back to settings"
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
            <span>{expandedSetting.expandedLabel}</span>
          </button>
          <div class="options-row" role="radiogroup" aria-label="{expandedSetting.label} options">
            {#each expandedSetting.options as option}
              {@const selected = expandedSetting.isSelected(option.value)}
              <button
                class="option-btn"
                class:selected
                onclick={() => handleSelect(expandedSetting, option.value)}
                role="radio"
                aria-checked={selected}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- ============================================================ -->
  <!-- DESKTOP LAYOUT: Expanded sections with all options visible -->
  <!-- ============================================================ -->
  <div class="desktop-layout">
    {#each settings as setting}
      <div class="setting-section">
        <span class="section-label">{setting.expandedLabel}</span>
        <div class="section-options" role="radiogroup" aria-label="{setting.label} options">
          {#each setting.options as option}
            {@const selected = setting.isSelected(option.value)}
            <button
              class="section-option"
              class:selected
              onclick={() => handleSelect(setting, option.value)}
              role="radio"
              aria-checked={selected}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}

    <!-- Grid and Loop row -->
    <div class="setting-section toggles-section">
      <div class="toggle-group">
        <span class="section-label">Grid</span>
        <div class="section-options" role="radiogroup" aria-label="Grid mode">
          <button
            class="section-option"
            class:selected={gridMode === "diamond"}
            onclick={() => { haptic.trigger("selection"); onGridModeChange("diamond" as GridMode); }}
            role="radio"
            aria-checked={gridMode === "diamond"}
          >
            ◇ Diamond
          </button>
          <button
            class="section-option"
            class:selected={gridMode === "box"}
            onclick={() => { haptic.trigger("selection"); onGridModeChange("box" as GridMode); }}
            role="radio"
            aria-checked={gridMode === "box"}
          >
            ▢ Box
          </button>
        </div>
      </div>

      <div class="toggle-group">
        <span class="section-label">Loop</span>
        <div class="section-options" role="radiogroup" aria-label="Loop mode">
          <button
            class="section-option"
            class:selected={!preferences.makeCircular}
            onclick={() => { haptic.trigger("selection"); onPreferenceChange("makeCircular", false); }}
            role="radio"
            aria-checked={!preferences.makeCircular}
          >
            Off
          </button>
          <button
            class="section-option loop-on"
            class:selected={preferences.makeCircular}
            onclick={() => { haptic.trigger("selection"); onPreferenceChange("makeCircular", true); }}
            role="radio"
            aria-checked={preferences.makeCircular}
          >
            On
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-container {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);

    /* Inherit scale from parent spell-panel */
    --scale: var(--spell-scale, 1);
  }

  /* ============================================================ */
  /* LAYOUT SWITCHING: Mobile vs Desktop */
  /* ============================================================ */

  .mobile-layout {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
  }

  .desktop-layout {
    display: none;
  }

  /*
   * Switch to desktop layout based on HEIGHT (not width).
   * The expanded layout grows vertically, so we need sufficient height.
   * Width is less relevant - if we have the vertical space, show expanded.
   *
   * 500px height threshold = enough for all expanded sections without scrolling
   */
  @container tool-panel (min-height: 500px) {
    .mobile-layout {
      display: none;
    }

    .desktop-layout {
      display: flex;
      flex-direction: column;
      gap: calc(var(--settings-spacing-md, 12px) * var(--scale));
    }
  }

  /* ============================================================ */
  /* MOBILE: Compact morphing chips */
  /* ============================================================ */

  .chips-row {
    display: flex;
    gap: var(--settings-spacing-sm, 8px);
  }


  .chip {
    flex: 1;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-xs, 4px);
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 18px);
    color: var(--theme-text);
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .chip:hover:not(:disabled) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
    }
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip:disabled {
    cursor: default;
  }

  .chip-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-muted);
    white-space: nowrap;
  }

  .chip-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text);
    white-space: nowrap;
  }

  .loop-chip.loop-active {
    background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-card-bg));
    border-color: var(--theme-accent);
  }

  .loop-chip.loop-active .chip-value {
    color: var(--theme-accent-light, var(--theme-accent));
  }

  /* Expanded overlay: replaces row 1 when a setting is expanded */
  .expanded-overlay {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 48px;
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-accent);
    border-radius: var(--settings-radius-lg, 18px);
  }

  .expanded-overlay .option-btn {
    min-height: 48px;
    flex: 1;
  }

  .back-tap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--settings-spacing-xs, 4px);
    min-width: 48px;
    min-height: 48px;
    padding: var(--settings-spacing-xs, 4px) var(--settings-spacing-sm, 8px);
    background: transparent;
    border: none;
    color: var(--theme-accent);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--settings-radius-sm, 8px);
    flex-shrink: 0;
    transition: background 150ms ease;
    white-space: nowrap;
  }

  .back-tap:hover {
    background: var(--theme-card-hover-bg);
  }

  .back-tap:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .back-tap i {
    font-size: 10px;
  }

  .options-row {
    display: flex;
    gap: var(--settings-spacing-xs, 4px);
    flex: 1;
    min-width: 0;
  }

  .option-btn {
    flex: 1;
    min-height: 48px;
    padding: var(--settings-spacing-sm, 8px);
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: var(--settings-radius-md, 12px);
    color: var(--theme-text-muted);
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .option-btn:hover:not(.selected) {
      background: var(--theme-card-hover-bg);
      color: var(--theme-text);
    }
  }

  .option-btn:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .option-btn.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent);
    color: var(--theme-text);
  }

  /* ============================================================ */
  /* DESKTOP: Expanded sections with all options visible */
  /* ============================================================ */

  .setting-section {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
    padding: calc(16px * var(--scale));
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: calc(var(--settings-radius-lg, 18px) * var(--scale));
  }

  .section-label {
    font-size: calc(var(--font-size-compact, 12px) * var(--scale));
    font-weight: 600;
    color: var(--theme-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section-options {
    display: flex;
    gap: calc(8px * var(--scale));
  }

  .section-option {
    flex: 1;
    min-height: calc(56px * var(--scale));
    padding: calc(12px * var(--scale)) calc(16px * var(--scale));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke);
    border-radius: calc(var(--settings-radius-md, 12px) * var(--scale));
    color: var(--theme-text-muted);
    font-size: calc(var(--font-size-min, 14px) * var(--scale));
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .section-option:hover:not(.selected) {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
      color: var(--theme-text);
    }
  }

  .section-option:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .section-option.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent);
    color: var(--theme-text);
  }

  /* Loop "On" button special styling when selected */
  .section-option.loop-on.selected {
    background: color-mix(in srgb, var(--theme-accent) 30%, var(--theme-card-bg));
  }

  /* Grid and Loop side by side */
  .toggles-section {
    display: flex;
    flex-direction: row;
    gap: calc(16px * var(--scale));
    padding: calc(16px * var(--scale));
  }

  .toggle-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
  }

  .toggle-group .section-options {
    flex: 1;
  }

  /* ============================================================ */
  /* Reduced motion */
  /* ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .option-btn,
    .back-tap,
    .section-option {
      transition: none;
    }
  }
</style>

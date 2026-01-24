<!--
SpellSettingsBar.svelte - Morphing pill-based settings

The panel transforms organically:
- Default: All 4 chips shown in a row (taller, comfortable height)
- Expanded: Tapped chip stretches to fill row, others shrink to zero
- Loop: Direct toggle (no expansion needed)

No external drawers - everything morphs within the component.
-->
<script lang="ts">
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

  // Which setting is expanded (null = all collapsed)
  let expandedId = $state<string | null>(null);

  // Setting definitions
  const settings = [
    {
      id: "grid",
      label: "Grid",
      expandedLabel: "Grid Mode",
      getValue: () => (gridMode === "diamond" ? "Diamond" : "Box"),
      options: [
        { value: "diamond", label: "Diamond" },
        { value: "box", label: "Box" },
      ],
      isSelected: (v: unknown) => gridMode === v,
      onSelect: (v: string) => onGridModeChange(v as GridMode),
    },
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
        onPreferenceChange("motionTypeFilter", v as "prefer-dash" | "no-dash" | null),
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
      onSelect: (v: string) => onPreferenceChange("constraintPreset", v),
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
        onPreferenceChange("handPathMode", v as "smooth" | "mixed" | "high"),
    },
  ];

  function handleSelect(setting: (typeof settings)[0], value: unknown) {
    setting.onSelect(value as never);
    expandedId = null;
  }

  function toggleLoop() {
    onPreferenceChange("makeCircular", !preferences.makeCircular);
  }
</script>

<div class="morph-bar">
  {#each settings as setting}
    {@const isExpanded = expandedId === setting.id}
    {@const isHidden = expandedId !== null && expandedId !== setting.id}

    <div
      class="chip-slot"
      class:expanded={isExpanded}
      class:hidden={isHidden}
    >
      {#if isExpanded}
        <!-- Expanded: options inside the morphed chip -->
        <div class="expanded-content">
          <button
            class="back-tap"
            onclick={() => (expandedId = null)}
            aria-label="Back to settings"
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
            <span>{setting.expandedLabel}</span>
          </button>
          <div class="options-inline" role="radiogroup" aria-label="{setting.label} options">
            {#each setting.options as option}
              {@const selected = setting.isSelected(option.value)}
              <button
                class="option-btn"
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
      {:else}
        <!-- Default chip -->
        <button
          class="chip"
          onclick={() => (expandedId = setting.id)}
          disabled={isHidden}
          aria-expanded={isExpanded}
          aria-haspopup="listbox"
        >
          <span class="chip-label">{setting.label}</span>
          <span class="chip-value">{setting.getValue()}</span>
        </button>
      {/if}
    </div>
  {/each}

  <!-- Loop: always a toggle, shrinks when others expand -->
  <div class="chip-slot loop-slot" class:hidden={expandedId !== null}>
    <button
      class="chip loop-chip"
      class:loop-active={preferences.makeCircular}
      onclick={toggleLoop}
      disabled={expandedId !== null}
      aria-pressed={preferences.makeCircular}
    >
      <span class="chip-label">Loop</span>
      <span class="chip-value">{preferences.makeCircular ? "On" : "Off"}</span>
    </button>
  </div>
</div>

<style>
  .morph-bar {
    display: flex;
    gap: 8px;
    height: 72px; /* Base comfortable height */
  }

  /* Desktop: allow more height when there's room */
  @media (min-height: 700px) {
    .morph-bar {
      height: 80px;
    }
  }

  @media (min-height: 900px) {
    .morph-bar {
      height: 88px;
    }
  }

  .chip-slot {
    flex: 1;
    min-width: 0;
    transition: all 280ms cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
  }

  .chip-slot.expanded {
    flex: 100; /* Take all available space */
  }

  .chip-slot.hidden {
    flex: 0;
    min-width: 0;
    max-width: 0;
    opacity: 0;
    padding: 0;
    margin-left: -8px; /* Collapse the gap */
  }

  /* Default chip - fills its slot */
  .chip {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 14px;
    background: var(--chip-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--chip-border, rgba(255, 255, 255, 0.08));
    border-radius: 18px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) {
    .chip:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
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
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
  }

  .chip-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    white-space: nowrap;
  }

  /* Loop active state */
  .loop-chip.loop-active {
    --chip-bg: rgba(6, 182, 212, 0.2);
    --chip-border: rgba(6, 182, 212, 0.5);
    box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
  }

  .loop-chip.loop-active .chip-value {
    color: #67e8f9;
  }

  /* Expanded content - fills the morphed slot */
  .expanded-content {
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 18px;
    box-shadow: 0 0 16px rgba(99, 102, 241, 0.15);
  }

  .back-tap {
    display: flex;
    align-items: center;
    gap: 6px;
    height: calc(100% - 4px); /* Fill available height minus padding */
    padding: 0 14px;
    background: transparent;
    border: none;
    color: var(--theme-accent-light, #a5b4fc);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    border-radius: 12px;
    flex-shrink: 0;
    transition: background 150ms ease;
    white-space: nowrap;
  }

  .back-tap:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .back-tap:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .back-tap i {
    font-size: 11px;
  }

  .options-inline {
    display: flex;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .option-btn {
    flex: 1;
    height: calc(100% - 4px); /* Fill available height minus padding */
    padding: 0 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
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
      background: rgba(255, 255, 255, 0.08);
      color: var(--theme-text, #ffffff);
    }
  }

  .option-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .option-btn.selected {
    background: rgba(99, 102, 241, 0.25);
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, #ffffff);
    box-shadow: 0 0 12px rgba(99, 102, 241, 0.2);
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chip-slot,
    .chip,
    .option-btn,
    .back-tap {
      transition: none;
    }
  }
</style>

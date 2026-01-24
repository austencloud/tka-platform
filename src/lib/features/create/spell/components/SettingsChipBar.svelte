<!--
SettingsChipBar.svelte - Compact 2x2 grid settings for constrained viewports

Shows 4 tappable chips in a 2x2 grid. Tapping opens the system Drawer with options.
Used when container height is limited (mobile with beat grid visible).
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
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

  // Track which setting drawer is open
  let activeDrawer = $state<string | null>(null);

  // Setting definitions
  const settings = [
    {
      id: "grid",
      label: "Grid",
      getValue: () => gridMode === "diamond" ? "Diamond" : "Box",
      options: [
        { value: "diamond", label: "Diamond" },
        { value: "box", label: "Box" },
      ],
      onSelect: (v: string) => onGridModeChange(v as GridMode),
    },
    {
      id: "dashes",
      label: "Dashes",
      getValue: () => {
        if (preferences.motionTypeFilter === "prefer-dash") return "Prefer";
        if (preferences.motionTypeFilter === "no-dash") return "None";
        return "Any";
      },
      options: [
        { value: null, label: "Any" },
        { value: "prefer-dash", label: "Prefer Dashes" },
        { value: "no-dash", label: "No Dashes" },
      ],
      onSelect: (v: string | null) => onPreferenceChange("motionTypeFilter", v as "prefer-dash" | "no-dash" | null),
    },
    {
      id: "flow",
      label: "Flow",
      getValue: () => {
        if (preferences.constraintPreset === "smooth") return "Smooth";
        if (preferences.constraintPreset === "high-reversal") return "High Rev";
        return "Natural";
      },
      options: [
        { value: "smooth", label: "Smooth" },
        { value: "natural", label: "Natural" },
        { value: "high-reversal", label: "High Reversal" },
      ],
      onSelect: (v: string) => onPreferenceChange("constraintPreset", v),
    },
    {
      id: "loop",
      label: "Loop",
      getValue: () => preferences.makeCircular ? "On" : "Off",
      options: [
        { value: true, label: "On" },
        { value: false, label: "Off" },
      ],
      onSelect: (v: boolean) => onPreferenceChange("makeCircular", v),
    },
  ];

  function openDrawer(id: string) {
    activeDrawer = id;
  }

  function closeDrawer() {
    activeDrawer = null;
  }

  function handleSelect(setting: typeof settings[0], value: unknown) {
    setting.onSelect(value as never);
    closeDrawer();
  }

  function isSelected(setting: typeof settings[0], optionValue: unknown): boolean {
    if (setting.id === "grid") return gridMode === optionValue;
    if (setting.id === "dashes") return preferences.motionTypeFilter === optionValue;
    if (setting.id === "flow") return preferences.constraintPreset === optionValue;
    if (setting.id === "loop") return preferences.makeCircular === optionValue;
    return false;
  }

  const activeSetting = $derived(settings.find(s => s.id === activeDrawer));
</script>

<div class="chip-grid">
  {#each settings as setting}
    <button
      class="chip"
      class:active={activeDrawer === setting.id}
      onclick={() => openDrawer(setting.id)}
      aria-haspopup="dialog"
    >
      <span class="chip-label">{setting.label}</span>
      <span class="chip-value">{setting.getValue()}</span>
    </button>
  {/each}
</div>

<!-- Use system Drawer for each setting -->
{#each settings as setting}
  <Drawer
    isOpen={activeDrawer === setting.id}
    placement="bottom"
    showHandle={true}
    ariaLabel="{setting.label} options"
    onclose={closeDrawer}
    class="spell-settings-drawer"
  >
    <DrawerHeader title={setting.label} onClose={closeDrawer} />
    <div class="drawer-options">
      {#each setting.options as option}
        {@const selected = isSelected(setting, option.value)}
        <button
          class="drawer-option"
          class:selected
          onclick={() => handleSelect(setting, option.value)}
          role="option"
          aria-selected={selected}
        >
          <span class="option-check" aria-hidden="true">
            {#if selected}
              <i class="fas fa-check"></i>
            {/if}
          </span>
          <span class="option-label">{option.label}</span>
        </button>
      {/each}
    </div>
  </Drawer>
{/each}

<style>
  /* 2x2 Grid of chips */
  .chip-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: 56px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .chip.active {
    border-color: var(--theme-accent, #6366f1);
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
  }

  .chip-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .chip-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  /* Drawer options */
  .drawer-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 16px 16px;
  }

  .drawer-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 12px 16px;
    background: transparent;
    border: 1.5px solid transparent;
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-min, 14px);
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .drawer-option:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .drawer-option:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
  }

  .drawer-option.selected {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border-color: var(--theme-accent, #6366f1);
  }

  .option-check {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-accent, #6366f1);
    font-size: var(--font-size-compact, 12px);
  }

  .option-label {
    font-weight: 500;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chip,
    .drawer-option {
      transition: none;
    }
  }
</style>

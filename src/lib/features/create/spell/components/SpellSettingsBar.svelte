<!--
SpellSettingsBar.svelte - Settings using MorphChip Primitives

Uses the MorphChipGroup and MorphChip primitives for:
- Row 1: Dashes, Props, Hands (standard 3-option chips)
- Row 2: Grid toggle + Loop (Loop uses custom expanded content)

Container-aware responsive design:
- Mobile (<700px height): MorphChip expanding chips
- Desktop (≥700px height): Expanded sections with all options visible
-->
<script lang="ts">
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { SpellPreferences } from "../domain/models/spell-models";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { LOOPType, LOOP_TYPE_LABELS } from "$lib/features/create/generate/circular/domain/models/circular-models";
  import { LOOPComponent } from "$lib/features/create/generate/shared/domain/constants/loop-components";
  import { loopTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import LOOPExpandedOverlay from "$lib/features/create/generate/components/cards/LOOPExpandedOverlay.svelte";
  import MorphChipGroup from "$lib/shared/foundation/ui/morph-chip/MorphChipGroup.svelte";
  import MorphChip from "$lib/shared/foundation/ui/morph-chip/MorphChip.svelte";

  let {
    gridMode,
    preferences,
    onGridModeChange,
    onPreferenceChange,
    onLoopExpandedChange,
  }: {
    gridMode: GridMode;
    preferences: SpellPreferences;
    onGridModeChange: (mode: GridMode) => void;
    onPreferenceChange: <K extends keyof SpellPreferences>(
      key: K,
      value: SpellPreferences[K]
    ) => void;
    /** Notifies parent when Loop chip expansion state changes (for full-panel takeover) */
    onLoopExpandedChange?: (expanded: boolean) => void;
  } = $props();

  const haptic = container.items.hapticFeedback as IHapticFeedback;

  // ============================================================
  // EXPANSION STATE
  // ============================================================

  // Row 1 expansion (Dashes, Props, Hands)
  let row1ExpandedId = $state<string | null>(null);

  // Row 2 expansion (Grid, Loop) - Loop needs special handling for panel takeover
  let row2ExpandedId = $state<string | null>(null);

  // Track when Loop is expanded for parent notification
  $effect(() => {
    onLoopExpandedChange?.(row2ExpandedId === "loop");
  });

  // LOOP full overlay state
  let showFullLoopOverlay = $state(false);

  // ============================================================
  // CHIP OPTIONS & VALUES
  // ============================================================

  // Dashes
  let dashValue = $derived.by(() => {
    if (preferences.motionTypeFilter === "no-dash") return "no-dash";
    if (preferences.motionTypeFilter === "prefer-dash") return "prefer-dash";
    return "mixed";
  });
  const dashOptions = [
    { value: "no-dash", label: "Low" },
    { value: "mixed", label: "Mixed" },
    { value: "prefer-dash", label: "High" },
  ];

  function handleDashChange(v: string) {
    haptic.trigger("selection");
    const mapped = v === "mixed" ? null : v;
    onPreferenceChange("motionTypeFilter", mapped as SpellPreferences["motionTypeFilter"]);
  }

  // Props
  let propsValue = $derived(preferences.constraintPreset ?? "mixed");
  const propsOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high-reversal", label: "High" },
  ];

  function handlePropsChange(v: string) {
    haptic.trigger("selection");
    onPreferenceChange("constraintPreset", v as SpellPreferences["constraintPreset"]);
  }

  // Hands
  let handsValue = $derived(preferences.handPathMode ?? "mixed");
  const handsOptions = [
    { value: "smooth", label: "Smooth" },
    { value: "mixed", label: "Mixed" },
    { value: "high", label: "High" },
  ];

  function handleHandsChange(v: string) {
    haptic.trigger("selection");
    onPreferenceChange("handPathMode", v as SpellPreferences["handPathMode"]);
  }

  // Display values for chips
  const dashDisplayValue = $derived.by(() => {
    if (preferences.motionTypeFilter === "no-dash") return "Low";
    if (preferences.motionTypeFilter === "prefer-dash") return "High";
    return "Mixed";
  });

  const propsDisplayValue = $derived.by(() => {
    if (preferences.constraintPreset === "smooth") return "Smooth";
    if (preferences.constraintPreset === "high-reversal") return "High";
    return "Mixed";
  });

  const handsDisplayValue = $derived.by(() => {
    if (preferences.handPathMode === "smooth") return "Smooth";
    if (preferences.handPathMode === "high") return "High";
    return "Mixed";
  });

  // ============================================================
  // LOOP OPTIONS
  // ============================================================

  const loopQuickOptions: Array<{ type: LOOPType | null; label: string; icon?: string; color?: string }> = [
    { type: null, label: "Off" },
    { type: LOOPType.REWOUND, label: "Rewound", icon: "backward", color: "#ff6b9d" },
    { type: LOOPType.STRICT_ROTATED, label: "Rotated", icon: "rotate", color: "#36c3ff" },
    { type: LOOPType.STRICT_MIRRORED, label: "Mirrored", icon: "left-right", color: "#6F2DA8" },
    { type: LOOPType.STRICT_SWAPPED, label: "Swapped", icon: "shuffle", color: "#26e600" },
    { type: LOOPType.STRICT_INVERTED, label: "Inverted", icon: "yin-yang", color: "#eb7d00" },
  ];

  const loopDisplayValue = $derived.by(() => {
    if (!preferences.makeCircular) return "Off";
    if (!preferences.selectedLOOPType) return "On";
    return LOOP_TYPE_LABELS[preferences.selectedLOOPType] ?? "Custom";
  });

  const selectedLoopComponents = $derived.by(() => {
    if (!preferences.selectedLOOPType) return new Set<LOOPComponent>();
    return loopTypeResolver.parseComponents(preferences.selectedLOOPType);
  });

  // Dummy value for Loop chip (we use custom content, not options)
  let loopValue = $state("loop");

  function handleLoopQuickSelect(option: typeof loopQuickOptions[0], collapse: () => void) {
    haptic.trigger("selection");

    if (option.type === null) {
      onPreferenceChange("makeCircular", false);
      onPreferenceChange("selectedLOOPType", null);
    } else {
      onPreferenceChange("makeCircular", true);
      onPreferenceChange("selectedLOOPType", option.type);
    }

    setTimeout(collapse, 150);
  }

  function openFullLoopOverlay() {
    haptic.trigger("selection");
    showFullLoopOverlay = true;
  }

  function handleFullLoopChange(newType: LOOPType) {
    onPreferenceChange("makeCircular", true);
    onPreferenceChange("selectedLOOPType", newType);
  }

  function handleFullLoopClose() {
    showFullLoopOverlay = false;
    row2ExpandedId = null;
  }

  // ============================================================
  // GRID TOGGLE
  // ============================================================

  function toggleGridMode() {
    haptic.trigger("selection");
    const newMode = gridMode === "diamond" ? "box" : "diamond";
    onGridModeChange(newMode as GridMode);
  }
</script>

<div class="settings-container">
  <!-- ============================================================ -->
  <!-- MOBILE LAYOUT: MorphChip expanding chips -->
  <!-- ============================================================ -->
  <div class="mobile-layout" class:loop-expanded={row2ExpandedId === "loop"}>
    <!-- Row 1: Dashes, Props, Hands (hide when Loop is expanded) -->
    {#if row2ExpandedId !== "loop"}
      <MorphChipGroup bind:expandedId={row1ExpandedId}>
        <MorphChip
          id="dashes"
          label="Dashes"
          bind:value={dashValue}
          options={dashOptions}
          displayValue={dashDisplayValue}
          onchange={handleDashChange}
        />
        <MorphChip
          id="props"
          label="Props"
          expandedLabel="Prop Reversals"
          bind:value={propsValue}
          options={propsOptions}
          displayValue={propsDisplayValue}
          onchange={handlePropsChange}
        />
        <MorphChip
          id="hands"
          label="Hands"
          expandedLabel="Hand Reversals"
          bind:value={handsValue}
          options={handsOptions}
          displayValue={handsDisplayValue}
          onchange={handleHandsChange}
        />
      </MorphChipGroup>
    {/if}

    <!-- Row 2: Grid + Loop (side by side, but Loop can expand to take over) -->
    <div class="row-2" class:loop-expanded={row2ExpandedId === "loop"}>
      <!-- Grid chip (simple toggle, no expansion) - hidden when Loop expands -->
      {#if row2ExpandedId !== "loop"}
        <button class="grid-chip" onclick={toggleGridMode}>
          <span class="chip-label">Grid</span>
          <span class="chip-value">{gridMode === "diamond" ? "Diamond" : "Box"}</span>
        </button>
      {/if}

      <!-- Loop chip in its own MorphChipGroup (single chip that can expand) -->
      {#snippet loopExpandedContent({ collapse, morphProgress }: { collapse: () => void; morphProgress: number })}
        <div class="loop-expanded-content">
          <div class="loop-options-grid">
            {#each loopQuickOptions as option}
              {@const isSelected = preferences.makeCircular
                ? preferences.selectedLOOPType === option.type
                : option.type === null}
              <button
                class="loop-option-btn"
                class:selected={isSelected}
                onclick={() => handleLoopQuickSelect(option, collapse)}
                style:--option-color={option.color ?? "var(--theme-text-muted)"}
              >
                {#if option.icon}
                  <i class="fas fa-{option.icon}" aria-hidden="true" style:color={option.color}></i>
                {/if}
                <span>{option.label}</span>
              </button>
            {/each}
          </div>
          <button class="customize-btn" onclick={openFullLoopOverlay}>
            <i class="fas fa-sliders" aria-hidden="true"></i>
            <span>Customize Combo...</span>
          </button>
        </div>
      {/snippet}

      <MorphChipGroup
        bind:expandedId={row2ExpandedId}
        expandedHeight={280}
      >
        <MorphChip
          id="loop"
          label="Loop"
          bind:value={loopValue}
          options={[]}
          displayValue={loopDisplayValue}
          expandedContent={loopExpandedContent}
        />
      </MorphChipGroup>
    </div>
  </div>

  <!-- ============================================================ -->
  <!-- DESKTOP LAYOUT: Expanded sections with all options visible -->
  <!-- ============================================================ -->
  <div class="desktop-layout">
    <div class="setting-section">
      <span class="section-label">Dashes</span>
      <div class="section-options" role="radiogroup">
        {#each dashOptions as option}
          <button
            class="section-option"
            class:selected={dashValue === option.value}
            onclick={() => handleDashChange(option.value)}
            role="radio"
            aria-checked={dashValue === option.value}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="setting-section">
      <span class="section-label">Prop Reversals</span>
      <div class="section-options" role="radiogroup">
        {#each propsOptions as option}
          <button
            class="section-option"
            class:selected={propsValue === option.value}
            onclick={() => handlePropsChange(option.value)}
            role="radio"
            aria-checked={propsValue === option.value}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="setting-section">
      <span class="section-label">Hand Reversals</span>
      <div class="section-options" role="radiogroup">
        {#each handsOptions as option}
          <button
            class="section-option"
            class:selected={handsValue === option.value}
            onclick={() => handleHandsChange(option.value)}
            role="radio"
            aria-checked={handsValue === option.value}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Grid and Loop row -->
    <div class="setting-section toggles-section">
      <div class="toggle-group">
        <span class="section-label">Grid</span>
        <div class="section-options" role="radiogroup">
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

      <div class="toggle-group loop-toggle-group">
        <span class="section-label">Loop</span>
        <div class="section-options loop-desktop-options" role="listbox">
          {#each loopQuickOptions.slice(0, 4) as option}
            {@const isSelected = preferences.makeCircular
              ? preferences.selectedLOOPType === option.type
              : option.type === null}
            <button
              class="section-option loop-desktop-option"
              class:selected={isSelected}
              onclick={() => {
                haptic.trigger("selection");
                if (option.type === null) {
                  onPreferenceChange("makeCircular", false);
                  onPreferenceChange("selectedLOOPType", null);
                } else {
                  onPreferenceChange("makeCircular", true);
                  onPreferenceChange("selectedLOOPType", option.type);
                }
              }}
              role="option"
              aria-selected={isSelected}
              style:--option-color={option.color ?? "var(--theme-accent)"}
            >
              {#if option.icon}
                <i class="fas fa-{option.icon}" aria-hidden="true" style:color={option.color}></i>
              {/if}
              {option.label}
            </button>
          {/each}
          <button
            class="section-option loop-desktop-more"
            onclick={openFullLoopOverlay}
          >
            <i class="fas fa-ellipsis" aria-hidden="true"></i>
            More
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Full LOOP overlay for multi-select combos -->
{#if showFullLoopOverlay}
  <div
    class="overlay-backdrop"
    onclick={handleFullLoopClose}
    onkeydown={(e) => e.key === "Escape" && handleFullLoopClose()}
    role="dialog"
    aria-modal="true"
    aria-label="LOOP type selection"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="overlay-container"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <LOOPExpandedOverlay
        currentType={preferences.selectedLOOPType ?? LOOPType.STRICT_ROTATED}
        selectedComponents={selectedLoopComponents}
        onChange={handleFullLoopChange}
        onClose={handleFullLoopClose}
      />
    </div>
  </div>
{/if}

<style>
  .settings-container {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    --scale: var(--spell-scale, 1);
    width: 100%;
  }

  /* ============================================================ */
  /* LAYOUT SWITCHING */
  /* ============================================================ */

  .mobile-layout {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 132px;
  }

  .mobile-layout.loop-expanded {
    min-height: 280px;
  }

  .desktop-layout {
    display: none;
  }

  @container tool-panel (min-height: 700px) {
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
  /* ROW 2: Grid + Loop side by side */
  /* ============================================================ */

  .row-2 {
    display: flex;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 56px;
  }

  .row-2.loop-expanded {
    min-height: 280px;
  }

  /* Grid chip takes half width normally */
  .row-2 > .grid-chip {
    flex: 1;
  }

  /* MorphChipGroup (containing Loop) takes half width normally, full when expanded */
  .row-2 > :global(.morph-chip-group) {
    flex: 1;
  }

  .row-2.loop-expanded > :global(.morph-chip-group) {
    flex: 1;
  }

  .grid-chip {
    min-height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 18px;
    color: var(--theme-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .grid-chip:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .grid-chip:active {
    transform: scale(0.97);
  }

  .grid-chip .chip-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-text-muted);
  }

  .grid-chip .chip-value {
    font-size: 14px;
    font-weight: 600;
  }

  /* ============================================================ */
  /* LOOP EXPANDED CONTENT */
  /* ============================================================ */

  .loop-expanded-content {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    height: 100%;
  }

  .loop-options-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(2, 1fr);
    gap: var(--settings-spacing-sm, 8px);
    flex: 1;
    min-height: 0; /* Allow grid to shrink below content size for proper 1fr distribution */
  }

  .loop-option-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 100%; /* Fill the grid cell */
    min-height: 56px;
    padding: 8px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-muted);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .loop-option-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .loop-option-btn:active {
    transform: scale(0.96);
  }

  .loop-option-btn.selected {
    background: color-mix(in srgb, var(--option-color, var(--theme-accent)) 20%, var(--theme-card-bg));
    border-color: var(--option-color, var(--theme-accent));
    color: var(--theme-text);
  }

  .loop-option-btn i {
    font-size: 18px;
  }

  .customize-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    background: transparent;
    border: 1.5px dashed var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .customize-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-accent);
    border-style: solid;
    color: var(--theme-accent);
  }

  /* ============================================================ */
  /* DESKTOP: Expanded sections */
  /* ============================================================ */

  .setting-section {
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
    padding: calc(16px * var(--scale));
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: calc(18px * var(--scale));
  }

  .section-label {
    font-size: calc(12px * var(--scale));
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
    border-radius: calc(12px * var(--scale));
    color: var(--theme-text-muted);
    font-size: calc(14px * var(--scale));
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .section-option:active {
    transform: scale(0.97);
  }

  .section-option:hover:not(.selected) {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .section-option.selected {
    background: color-mix(in srgb, var(--theme-accent) 25%, var(--theme-card-bg));
    border-color: var(--theme-accent);
    color: var(--theme-text);
  }

  .toggles-section {
    display: flex;
    flex-direction: row;
    gap: calc(16px * var(--scale));
  }

  .toggle-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: calc(8px * var(--scale));
  }

  .loop-toggle-group {
    flex: 2;
  }

  .loop-desktop-options {
    flex-wrap: wrap;
  }

  .loop-desktop-option {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .loop-desktop-option.selected {
    background: color-mix(in srgb, var(--option-color, var(--theme-accent)) 20%, var(--theme-card-bg));
    border-color: var(--option-color, var(--theme-accent));
  }

  .loop-desktop-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  /* ============================================================ */
  /* LOOP OVERLAY */
  /* ============================================================ */

  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fadeIn 200ms ease forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .overlay-container {
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    position: relative;
  }

  /* ============================================================ */
  /* Reduced motion */
  /* ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .grid-chip,
    .loop-option-btn,
    .customize-btn,
    .section-option,
    .overlay-backdrop {
      transition: none;
      animation: none;
    }
  }
</style>

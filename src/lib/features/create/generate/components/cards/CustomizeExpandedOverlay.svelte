<!--
CustomizeExpandedOverlay.svelte - Accordion-based customize panel
Three collapsible sections: Style, Rhythm, Start Position
Only one section open at a time. All content renders inline (no drawer-hopping).
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { getTemplateById } from "$lib/features/create/shared/domain/templates/duration-templates";
  import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { GridMode, type GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import {
    detectPresetFromBlocked,
    getAllPositions,
    getAllowedPositions,
    getBlockedPositionsForPreset,
    StartPositionPreset,
  } from "../../shared/domain/start-position-presets";
  import StyleExpandPanel from "../StyleExpandPanel.svelte";
  import PatternItemCard from "$lib/features/create/shared/components/sequence-actions/PatternItemCard.svelte";
  import {
    getTemplatesByCategory,
    getCategoryInfo,
    type DurationCategory,
  } from "$lib/features/create/shared/domain/templates/duration-templates";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { getLetterBorderColorSafe } from "$lib/shared/pictograph/shared/utils/letter-border-utils";
  import { startPositionManager } from "$lib/features/create/construct/start-position-picker/services/implementations/StartPositionManager";

  type AccordionSection = "style" | "rhythm" | "startEnd";
  type StartPosMode = "all" | "classic" | "specific";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    durationTemplateId,
    stepCount,
    startEndOptions,
    gridMode = GridMode.DIAMOND,
    isFreeformMode = true,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    onDurationTemplateSelect,
    onStartEndChange,
    onClose,
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "high-reversal";
    handPathMode: "smooth" | "mixed" | "high";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    durationTemplateId: string | null;
    stepCount: number;
    startEndOptions: StartEndOptions | null;
    gridMode?: GridMode;
    isFreeformMode?: boolean;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "high-reversal") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "high") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    onDurationTemplateSelect: (id: string | null) => void;
    onStartEndChange: ((options: StartEndOptions) => void) | null;
    onClose: () => void;
  }>();

  let hapticService: IHapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Accordion state — Style open by default
  let activeSection = $state<AccordionSection | null>("style");

  function toggleSection(section: AccordionSection) {
    hapticService?.trigger("selection");
    activeSection = activeSection === section ? null : section;
  }

  // ─── Local state for rhythm (instant UI feedback) ───
  let localDurationTemplateId = $state<string | null>(durationTemplateId);

  // ─── Rhythm display ───
  const rhythmDisplay = $derived.by(() => {
    if (!localDurationTemplateId) return "Off";
    const template = getTemplateById(localDurationTemplateId);
    return template?.name ?? "Off";
  });

  // ─── Local state for start positions (instant UI feedback) ───
  let localBlockedPositions = $state<GridPosition[]>(
    startEndOptions?.blockedStartPositions ?? []
  );

  // Determine current mode from blocked positions
  function detectMode(blocked: GridPosition[]): StartPosMode {
    if (blocked.length === 0) return "all";
    const preset = detectPresetFromBlocked(blocked, gridMode);
    if (preset === StartPositionPreset.CLASSIC) return "classic";
    return "specific";
  }

  let startPosMode = $state<StartPosMode>(
    detectMode(startEndOptions?.blockedStartPositions ?? [])
  );

  // For "specific" mode: which single position is selected
  const selectedSpecificPosition = $derived.by((): GridPosition | null => {
    if (startPosMode !== "specific") return null;
    const allowed = getAllowedPositions(localBlockedPositions, gridMode);
    return allowed.length === 1 ? allowed[0]! : null;
  });

  // ─── Start/End display ───
  const startEndDisplay = $derived.by(() => {
    if (!startEndOptions) return "Any";
    if (startPosMode === "all") return "Any";
    if (startPosMode === "classic") return "Classic 3";
    if (selectedSpecificPosition) {
      // Show the position name (e.g., "α1")
      return selectedSpecificPosition;
    }
    return "Pick one";
  });

  // ─── Style summary ───
  const styleSummary = $derived.by(() => {
    const isDefault =
      constraintPreset === "smooth" &&
      handPathMode === "smooth" &&
      (motionTypeFilter === null || motionTypeFilter === "no-dash");
    return isDefault ? "Default" : "Custom";
  });

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  // ─── Rhythm section state ───
  const CATEGORIES: Array<DurationCategory | "all"> = ["all", "accent", "meter", "feel", "world"];
  let categoryFilter = $state<DurationCategory | "all">("accent");

  let filteredTemplates = $derived(
    getTemplatesByCategory(stepCount, categoryFilter)
  );

  function handleTemplateSelect(templateId: string) {
    hapticService?.trigger("selection");
    if (templateId === localDurationTemplateId) {
      localDurationTemplateId = null;
      onDurationTemplateSelect(null);
    } else {
      localDurationTemplateId = templateId;
      onDurationTemplateSelect(templateId);
    }
  }

  function handleClearRhythm() {
    hapticService?.trigger("selection");
    localDurationTemplateId = null;
    onDurationTemplateSelect(null);
  }

  // ─── Start Position handlers ───
  function applyBlockedPositions(blocked: GridPosition[]) {
    if (!startEndOptions || !onStartEndChange) return;
    localBlockedPositions = blocked;
    onStartEndChange({
      ...startEndOptions,
      blockedStartPositions: blocked,
      startPosition: null,
    });
  }

  function handleStartPosModeChange(mode: StartPosMode) {
    if (!startEndOptions || !onStartEndChange) return;
    hapticService?.trigger("selection");
    startPosMode = mode;

    if (mode === "all") {
      applyBlockedPositions([]);
    } else if (mode === "classic") {
      const blocked = getBlockedPositionsForPreset(StartPositionPreset.CLASSIC, gridMode);
      applyBlockedPositions(blocked);
    }
    // "specific" — don't change blocked yet, wait for user to pick a position
  }

  function handleSpecificPositionSelect(position: GridPosition) {
    hapticService?.trigger("selection");
    const allPositions = getAllPositions(gridMode);
    const blocked = allPositions.filter((p) => p !== position);
    applyBlockedPositions(blocked);
  }

  // ─── Position grid data ───
  let positionVariations = $state<PictographData[]>([]);

  onMount(() => {
    positionVariations = startPositionManager.getAllStartPositionVariations(gridMode);
  });
</script>

<div
  class="customize-expanded-overlay"
  transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}
>
  <!-- Header -->
  <div class="overlay-header">
    <h3 class="overlay-title">Customize</h3>
    <button
      class="close-button"
      onclick={handleClose}
      aria-label="Close customize panel"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>

  <!-- Scrollable accordion content -->
  <div class="overlay-content themed-scrollbar">
    <!-- ═══ Style Section ═══ -->
    <div class="accordion-section">
      <button
        class="accordion-header"
        class:active={activeSection === "style"}
        onclick={() => toggleSection("style")}
        aria-expanded={activeSection === "style"}
        aria-controls="section-style"
      >
        <span class="accordion-label">Style</span>
        <span class="accordion-value">{styleSummary}</span>
        <svg
          class="accordion-chevron"
          class:open={activeSection === "style"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {#if activeSection === "style"}
        <div class="accordion-content" id="section-style">
          <StyleExpandPanel
            {constraintPreset}
            {handPathMode}
            {motionTypeFilter}
            haptic={hapticService}
            onPropsChange={onConstraintPresetChange}
            onHandsChange={onHandPathModeChange}
            onDashesChange={onMotionTypeFilterChange}
          />
        </div>
      {/if}
    </div>

    <!-- ═══ Rhythm Section ═══ -->
    <div class="accordion-section">
      <button
        class="accordion-header"
        class:active={activeSection === "rhythm"}
        onclick={() => toggleSection("rhythm")}
        aria-expanded={activeSection === "rhythm"}
        aria-controls="section-rhythm"
      >
        <span class="accordion-label">Rhythm</span>
        <span class="accordion-value">{rhythmDisplay}</span>
        <svg
          class="accordion-chevron"
          class:open={activeSection === "rhythm"}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {#if activeSection === "rhythm"}
        <div class="accordion-content" id="section-rhythm">
          <!-- Category filter -->
          <div class="category-filter" role="tablist" aria-label="Rhythm categories">
            {#each CATEGORIES as cat}
              {@const info = cat === "all" ? { label: "All", color: "#94a3b8" } : getCategoryInfo(cat)}
              <button
                class="category-chip"
                class:active={categoryFilter === cat}
                style:--cat-color={info.color}
                onclick={() => { categoryFilter = cat; }}
                role="tab"
                aria-selected={categoryFilter === cat}
              >
                {info.label}
              </button>
            {/each}
          </div>

          <!-- Template grid -->
          <div class="rhythm-templates">
            <!-- "None" option -->
            <PatternItemCard
              name="None"
              description="No rhythm applied"
              selected={localDurationTemplateId === null}
              glassColor="#94a3b8"
              isTemplate
              onclick={handleClearRhythm}
            />

            <div class="template-grid">
              {#each filteredTemplates as template (template.id)}
                {@const catInfo = getCategoryInfo(template.category)}
                <PatternItemCard
                  name={template.name}
                  description={template.description}
                  selected={localDurationTemplateId === template.id}
                  glassColor={catInfo.color}
                  isTemplate
                  onclick={() => handleTemplateSelect(template.id)}
                />
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- ═══ Start Position Section ═══ -->
    {#if startEndOptions && onStartEndChange}
      <div class="accordion-section">
        <button
          class="accordion-header"
          class:active={activeSection === "startEnd"}
          onclick={() => toggleSection("startEnd")}
          aria-expanded={activeSection === "startEnd"}
          aria-controls="section-start-end"
        >
          <span class="accordion-label">Start Pos.</span>
          <span class="accordion-value">{startEndDisplay}</span>
          <svg
            class="accordion-chevron"
            class:open={activeSection === "startEnd"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {#if activeSection === "startEnd"}
          <div class="accordion-content" id="section-start-end">
            <!-- Mode buttons: All / Classic 3 / Specific -->
            <div class="presets-row">
              <button
                class="preset-button"
                class:active={startPosMode === "all"}
                onclick={() => handleStartPosModeChange("all")}
                aria-pressed={startPosMode === "all"}
              >
                <span class="preset-label">All</span>
                <span class="preset-description">Any position</span>
              </button>
              <button
                class="preset-button"
                class:active={startPosMode === "classic"}
                onclick={() => handleStartPosModeChange("classic")}
                aria-pressed={startPosMode === "classic"}
              >
                <span class="preset-label">Classic 3</span>
                <span class="preset-description">α1, β5, γ11</span>
              </button>
              <button
                class="preset-button"
                class:active={startPosMode === "specific"}
                onclick={() => handleStartPosModeChange("specific")}
                aria-pressed={startPosMode === "specific"}
              >
                <span class="preset-label">Specific</span>
                <span class="preset-description">Pick one</span>
              </button>
            </div>

            <!-- Single-select position grid (only when "Specific" is chosen) -->
            {#if startPosMode === "specific"}
              <div class="specific-grid">
                {#each positionVariations as pos (pos.id)}
                  {@const gridPos = pos.startPosition as GridPosition}
                  {@const isSelected = selectedSpecificPosition === gridPos}
                  <button
                    class="specific-cell"
                    class:selected={isSelected}
                    onclick={() => handleSpecificPositionSelect(gridPos)}
                    style:--letter-border-color={getLetterBorderColorSafe(pos.letter)}
                    aria-label="Start at {gridPos}"
                    aria-pressed={isSelected}
                  >
                    <div class="pictograph-wrapper">
                      <PictographContainer pictographData={pos} />
                    </div>
                    {#if isSelected}
                      <div class="selected-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .customize-expanded-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;

    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;

    background: linear-gradient(
      135deg,
      color-mix(in srgb, #06b6d4 20%, #1a1a2e) 0%,
      color-mix(in srgb, #0891b2 12%, #1a1a2e) 50%,
      color-mix(in srgb, #06b6d4 16%, #1a1a2e) 100%
    );
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, #06b6d4 40%, transparent);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, #06b6d4 20%, transparent);

    overflow: hidden;
  }

  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .overlay-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  .close-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: var(--theme-text, white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    width: 48px;
    height: 48px;
    transition: all var(--duration-normal) ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  .overlay-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    container-type: size;
    container-name: overlay;
  }

  /* ─── Accordion ─── */

  .accordion-section {
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.15);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
  }

  /* The active/expanded section fills remaining space */
  .accordion-section:has(.accordion-header.active) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    font-family: inherit;
    min-height: 48px;
    transition: background var(--duration-normal) ease;
  }

  .accordion-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .accordion-header.active {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .accordion-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.5);
    min-width: 70px;
    text-align: left;
  }

  .accordion-value {
    flex: 1;
    text-align: right;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .accordion-chevron {
    width: 16px;
    height: 16px;
    opacity: 0.5;
    flex-shrink: 0;
    transition: transform var(--duration-normal) ease;
  }

  .accordion-chevron.open {
    transform: rotate(180deg);
  }

  .accordion-content {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* ─── Rhythm: Category filter ─── */

  .category-filter {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    flex-shrink: 0;
  }

  .category-filter::-webkit-scrollbar {
    display: none;
  }

  .category-chip {
    flex-shrink: 0;
    padding: 6px 12px;
    min-height: 36px;
    border-radius: 18px;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.6);
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .category-chip.active {
    background: color-mix(in srgb, var(--cat-color) 25%, transparent);
    border-color: color-mix(in srgb, var(--cat-color) 60%, transparent);
    color: var(--theme-text, #ffffff);
    box-shadow: 0 0 8px color-mix(in srgb, var(--cat-color) 20%, transparent);
  }

  .category-chip:hover:not(.active) {
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--theme-text, #ffffff);
  }

  .category-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  /* ─── Rhythm: Template grid ─── */

  .rhythm-templates {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  /* ─── Start Position: Mode buttons ─── */

  .presets-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }

  .preset-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px 6px;
    min-height: 48px;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid transparent;
    border-radius: 10px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    color: white;
    font-family: inherit;
  }

  .preset-button:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .preset-button.active {
    background: rgba(100, 200, 255, 0.15);
    border-color: rgba(100, 200, 255, 0.6);
    box-shadow: 0 0 12px rgba(100, 200, 255, 0.2);
  }

  .preset-button:active {
    transform: scale(0.97);
  }

  .preset-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .preset-description {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
  }

  /* ─── Start Position: Specific single-select grid ─── */

  .specific-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  .specific-cell {
    position: relative;
    aspect-ratio: 1 / 1;
    /*
     * Cell height is container-driven: the grid flex-fills remaining space,
     * 4 rows divide it evenly, and aspect-ratio keeps cells square.
     * On very wide containers the width could exceed height, so cap
     * each cell to its row height to stay square.
     */
    max-width: 100%;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    cursor: pointer;
    padding: 3px;
    background: rgba(0, 0, 0, 0.15);
    transition: all var(--duration-normal) ease;
    overflow: hidden;
    color: white;
    font-family: inherit;
  }

  .specific-cell:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .specific-cell.selected {
    border-color: var(--letter-border-color, rgba(100, 200, 255, 0.8));
    background: rgba(100, 200, 255, 0.12);
    box-shadow: 0 0 10px rgba(100, 200, 255, 0.2);
  }

  .specific-cell:active {
    transform: scale(0.95);
  }

  .pictograph-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pictograph-wrapper :global(.pictograph) {
    width: 100%;
    height: 100%;
  }

  .pictograph-wrapper :global(.pictograph svg) {
    width: 100%;
    height: 100%;
  }

  .selected-indicator {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 16px;
    height: 16px;
    background: rgba(100, 200, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .selected-indicator svg {
    width: 11px;
    height: 11px;
    color: white;
  }

  /* ─── Reduced motion ─── */

  @media (prefers-reduced-motion: reduce) {
    .accordion-header,
    .close-button,
    .accordion-chevron,
    .category-chip,
    .preset-button,
    .specific-cell {
      transition: none;
    }
  }
</style>

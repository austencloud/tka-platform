<!--
CustomizeExpandedOverlay.svelte - Accordion-based customize panel
Two collapsible sections: Style, Start Position.
Only one section open at a time. All content renders inline (no drawer-hopping).
(Rhythm was removed pending a finished rhythm-preset design.)
-->
<script module lang="ts">
  // Persist which accordion section was last open across sessions.
  // Without this, reopening the customize panel in a new session always
  // defaults to "style" even if the user's last change was to start positions.
  const SECTION_STORAGE_KEY = "tka-customize-active-section";
  type AccordionSectionPersisted = "style" | "startEnd" | null;

  function loadPersistedSection(): AccordionSectionPersisted {
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      if (raw === "style" || raw === "startEnd") return raw;
      return "style";
    } catch {
      return "style";
    }
  }

  function savePersistedSection(section: AccordionSectionPersisted): void {
    try {
      if (section) {
        localStorage.setItem(SECTION_STORAGE_KEY, section);
      } else {
        localStorage.removeItem(SECTION_STORAGE_KEY);
      }
    } catch {
      // Silently ignore storage errors (private browsing, quota exceeded)
    }
  }

  let persistedSection: AccordionSectionPersisted = loadPersistedSection();
</script>

<script lang="ts">
  import "../customize-accent.css";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { scale, slide } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { onMount, untrack } from "svelte";
  import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
  import { GridMode, type GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import {
    detectPresetFromBlocked,
    getAllowedPositions,
    getBlockedPositionsForPreset,
    PRESET_LABELS,
    StartPositionPreset,
  } from "../../shared/domain/start-position-presets";
  import StyleExpandPanel from "../StyleExpandPanel.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import MultiSelectPositionPicker from "$lib/shared/components/position-picker/MultiSelectPositionPicker.svelte";
  import PositionSection from "$lib/shared/components/position-picker/PositionSection.svelte";
  import PropOrientationControl from "../../../shared/components/sequence-actions/PropOrientationControl.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { buildStartEndOptions } from "./customize-start-end-options";

  type AccordionSection = "style" | "startEnd";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    startEndOptions,
    gridMode = GridMode.DIAMOND,
    isFreeformMode = true,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    onStartEndChange,
    onClose,
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "choppy";
    handPathMode: "smooth" | "mixed" | "choppy";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    startEndOptions: StartEndOptions | null;
    gridMode?: GridMode;
    isFreeformMode?: boolean;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "choppy") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "choppy") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    onStartEndChange: ((options: StartEndOptions) => void) | null;
    onClose: () => void;
  }>();

  let hapticService: HapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Accordion state - restore last-open section across drawer open/close cycles
  let activeSection = $state<AccordionSection | null>(persistedSection);

  function toggleSection(section: AccordionSection) {
    hapticService?.trigger("selection");
    activeSection = activeSection === section ? null : section;
    persistedSection = activeSection;
    savePersistedSection(activeSection);
  }

  // ─── Local state for style (instant UI feedback) ───
  let localConstraintPreset = $state<"smooth" | "mixed" | "choppy">(untrack(() => constraintPreset));
  let localHandPathMode = $state<"smooth" | "mixed" | "choppy">(untrack(() => handPathMode));
  let localMotionTypeFilter = $state<"no-dash" | "prefer-dash" | null>(untrack(() => motionTypeFilter));

  // ─── Local state for start positions (instant UI feedback) ───
  let localBlockedPositions = $state<GridPosition[]>(
    untrack(() => startEndOptions)?.blockedStartPositions ?? []
  );
  let localEndPosition = $state<PictographData | null>(
    untrack(() => startEndOptions)?.endPosition ?? null
  );

  // ─── Local state for start orientation (blue + red, default In/In) ───
  let localBlueOri = $state<Orientation>(
    untrack(() => startEndOptions)?.blueStartOrientation ?? Orientation.IN
  );
  let localRedOri = $state<Orientation>(
    untrack(() => startEndOptions)?.redStartOrientation ?? Orientation.IN
  );

  // Compact orientation suffix for the section header — empty when In/In so the
  // default reads clean. flex:1 right-aligned value grows toward the fixed
  // chevron, so a wider string never shifts siblings (no-layout-shift rule).
  const ORI_SHORT: Record<string, string> = {
    [Orientation.IN]: "In",
    [Orientation.CLOCK]: "CW",
    [Orientation.OUT]: "Out",
    [Orientation.COUNTER]: "CCW",
  };
  const oriDisplay = $derived.by(() => {
    const b = localBlueOri ?? Orientation.IN;
    const r = localRedOri ?? Orientation.IN;
    if (b === Orientation.IN && r === Orientation.IN) return "";
    return ` · ${ORI_SHORT[b] ?? b}/${ORI_SHORT[r] ?? r}`;
  });

  // Current preset (All / Classic 3 / Custom) derived from the blocked list.
  const currentPreset = $derived(
    detectPresetFromBlocked(localBlockedPositions, gridMode)
  );

  // How many positions are enabled (for the section summary).
  const enabledCount = $derived(
    getAllowedPositions(localBlockedPositions, gridMode).length
  );

  // Single-select preset options for the SegmentedControl.
  const startPresetOptions = [
    StartPositionPreset.ANY,
    StartPositionPreset.CLASSIC,
    StartPositionPreset.CUSTOM,
  ].map((p) => ({ value: p, label: PRESET_LABELS[p] }));

  // ─── Start/End display ───
  const startEndDisplay = $derived.by(() => {
    if (!startEndOptions) return "Any";
    if (currentPreset === StartPositionPreset.ANY) return "Any";
    if (currentPreset === StartPositionPreset.CLASSIC) return "Classic 3";
    return enabledCount === 1 ? "1 pos" : `${enabledCount} pos`;
  });

  // ─── Style summary ───
  const styleSummary = $derived.by(() => {
    const isDefault =
      localConstraintPreset === "smooth" &&
      localHandPathMode === "smooth" &&
      (localMotionTypeFilter === null || localMotionTypeFilter === "no-dash");
    return isDefault ? "Default" : "Custom";
  });

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  // Emit a COMPLETE, internally-consistent options object built from the
  // overlay's live local state. The engine's setOptions() does a full replace,
  // so emitting anything less (e.g. the frozen open-time snapshot + one field)
  // reverts every field the user isn't currently touching. See
  // buildStartEndOptions for the full rationale.
  function emitStartEndChange() {
    if (!startEndOptions || !onStartEndChange) return;
    onStartEndChange(
      buildStartEndOptions(startEndOptions, {
        blockedStartPositions: localBlockedPositions,
        endPosition: localEndPosition,
        blueStartOrientation: localBlueOri,
        redStartOrientation: localRedOri,
      })
    );
  }

  // ─── Start Position handlers ───
  function applyBlockedPositions(blocked: GridPosition[]) {
    if (!startEndOptions || !onStartEndChange) return;
    localBlockedPositions = blocked;
    emitStartEndChange();
  }

  // Preset segment: All clears the blocklist, Classic 3 blocks all but the
  // classic three, Custom is auto-detected from manual grid toggles (clicking
  // it directly is a no-op — the grid drives the custom state).
  function handlePresetSelect(preset: StartPositionPreset) {
    if (preset === StartPositionPreset.CUSTOM) return;
    hapticService?.trigger("selection");
    if (preset === StartPositionPreset.ANY) {
      applyBlockedPositions([]);
    } else if (preset === StartPositionPreset.CLASSIC) {
      applyBlockedPositions(
        getBlockedPositionsForPreset(StartPositionPreset.CLASSIC, gridMode)
      );
    }
  }

  // Manual multi-select toggles from the shared grid primitive.
  function handleBlockedChange(blocked: GridPosition[]) {
    applyBlockedPositions(blocked);
  }

  // End position (freeform only).
  function handleEndPositionChange(position: PictographData | null) {
    if (!startEndOptions || !onStartEndChange) return;
    hapticService?.trigger("selection");
    localEndPosition = position;
    emitStartEndChange();
  }

  // Start orientation per prop. Feeds the engine's blue/redStartOrientation
  // override so the generated sequence begins from the chosen orientation.
  function handleBlueOriChange(ori: string) {
    if (!startEndOptions || !onStartEndChange) return;
    hapticService?.trigger("selection");
    localBlueOri = ori as Orientation;
    emitStartEndChange();
  }

  function handleRedOriChange(ori: string) {
    if (!startEndOptions || !onStartEndChange) return;
    hapticService?.trigger("selection");
    localRedOri = ori as Orientation;
    emitStartEndChange();
  }
</script>

<div
  class="customize-expanded-overlay customize-accent-scope"
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
        <div class="accordion-content" id="section-style" transition:slide={{ duration: 200, easing: quintOut }} onintroend={(e) => (e.target as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}>
          <StyleExpandPanel
            constraintPreset={localConstraintPreset}
            handPathMode={localHandPathMode}
            motionTypeFilter={localMotionTypeFilter}
            haptic={hapticService}
            onPropsChange={(v) => { localConstraintPreset = v; onConstraintPresetChange(v); }}
            onHandsChange={(v) => { localHandPathMode = v; onHandPathModeChange(v); }}
            onDashesChange={(v) => { localMotionTypeFilter = v === "mixed" ? null : v; onMotionTypeFilterChange(v); }}
          />
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
          <span class="accordion-value">{startEndDisplay}{oriDisplay}</span>
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
          <div class="accordion-content" id="section-start-end" transition:slide={{ duration: 200, easing: quintOut }} onintroend={(e) => (e.target as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}>
            <!-- Preset: All / Classic 3 / Custom (single-select) -->
            <SegmentedControl
              options={startPresetOptions}
              value={currentPreset}
              onchange={handlePresetSelect}
              color="accent"
              size="sm"
            />

            <!-- Multi-select position grid (shared primitive) -->
            <MultiSelectPositionPicker
              blockedPositions={localBlockedPositions}
              onBlockedChange={handleBlockedChange}
              blueStartOrientation={localBlueOri}
              redStartOrientation={localRedOri}
              {gridMode}
            />

            <!-- End position (freeform only) -->
            {#if isFreeformMode}
              <PositionSection
                title="End Position"
                description="Where the sequence ends (optional)"
                currentPosition={localEndPosition}
                onPositionChange={handleEndPositionChange}
                {gridMode}
              />
            {/if}

            <!-- Start orientation (blue + red, default In/In) -->
            <div class="ori-section">
              <span class="ori-heading">Start Orientation</span>
              <div class="ori-row">
                <span class="ori-color-label ori-blue">Blue</span>
                <PropOrientationControl
                  color="blue"
                  orientation={localBlueOri}
                  onOrientationChange={handleBlueOriChange}
                />
              </div>
              <div class="ori-row">
                <span class="ori-color-label ori-red">Red</span>
                <PropOrientationControl
                  color="red"
                  orientation={localRedOri}
                  onOrientationChange={handleRedOriChange}
                />
              </div>
            </div>
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

    /* Palette hoisted to ../customize-accent.css (shared with CustomizeDrawer) */
    background: var(--customize-surface-gradient);
    border-radius: 16px;
    border: 2px solid color-mix(in srgb, var(--customize-accent) 40%, transparent);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 24px color-mix(in srgb, var(--customize-accent) 20%, transparent);

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
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    transition:
      background var(--duration-normal) ease,
      border-color var(--duration-normal) ease;
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
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ─── Accordion ─── */

  .accordion-section {
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.15);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
  }

  /* The active/expanded section gets column layout but doesn't stretch */
  .accordion-section:has(.accordion-header.active) {
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    min-height: var(--min-touch-target);
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
  }


  /* Start Position controls (SegmentedControl + MultiSelectPositionPicker +
     PositionSection) bring their own styling from the shared primitives. */

  /* ─── Start orientation (blue + red cyclers) ─── */
  .ori-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ori-heading {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.5);
  }

  .ori-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ori-color-label {
    flex-shrink: 0;
    width: 44px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  .ori-blue {
    color: var(--prop-blue, #3b82f6);
  }

  .ori-red {
    color: var(--prop-red, #ef4444);
  }

  /* ─── Reduced motion ─── */

  @media (prefers-reduced-motion: reduce) {
    .accordion-header,
    .close-button,
    .accordion-chevron {
      transition: none;
    }
  }
</style>

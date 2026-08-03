<!--
CustomizeExpandedOverlay.svelte - Customize panel, one decision at a time.

A SettingsDrillPanel over four settings: Style, Start Position, End Position,
Start Orientation. The root list shows each one's current value; choosing a row
gives that setting the whole panel. Above 840px of panel width the drill panel
goes two-pane on its own.

Replaced an accordion that put start position and end position on the same
screen (end position nested INSIDE start position) and, because the expanded
section flex-shrank below its content against its own `overflow: hidden`,
clipped 415px of that content instead of scrolling.
Spec: docs/superpowers/specs/2026-08-02-customize-panel-drilldown-design.md
-->
<script module lang="ts">
  // Persist which setting was last open across sessions. Widened from the
  // accordion's "style" | "startEnd" to the four drill ids; anything else
  // (including the retired "startEnd") falls back to style.
  const SECTION_STORAGE_KEY = "tka-customize-active-section";
  const DRILL_IDS = ["style", "startPos", "endPos", "startOri"] as const;
  type DrillId = (typeof DRILL_IDS)[number];

  function isDrillId(v: unknown): v is DrillId {
    return DRILL_IDS.includes(v as DrillId);
  }

  function loadPersistedSection(): DrillId {
    try {
      const raw = localStorage.getItem(SECTION_STORAGE_KEY);
      return isDrillId(raw) ? raw : "style";
    } catch {
      return "style";
    }
  }

  function savePersistedSection(section: DrillId | null): void {
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

  let persistedSection: DrillId = loadPersistedSection();
</script>

<script lang="ts">
  import "../customize-accent.css";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { scale } from "svelte/transition";
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
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import SettingsDrillPanel, {
    type SettingsDrillItem,
  } from "$lib/shared/ui/components/settings-drill/SettingsDrillPanel.svelte";
  import MultiSelectPositionPicker from "$lib/shared/components/position-picker/MultiSelectPositionPicker.svelte";
  import PositionPickerGrid from "$lib/shared/components/position-picker/PositionPickerGrid.svelte";
  import PropOrientationControl from "../../../shared/components/sequence-actions/PropOrientationControl.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { buildStartEndOptions } from "./customize-start-end-options";
  import {
    buildCustomizeSummary,
    ORIENTATION_SHORT,
    PRODUCTION_STYLE_BASELINE,
    type CustomizeStyleBaseline,
  } from "./customize-summary";
  import { GENERATE_DEFAULT_CONFIG } from "../../state/generate-config.svelte";
  import ConfirmDialog from "$lib/shared/foundation/ui/ConfirmDialog.svelte";
  import {
    clampStartOrientationToLevel,
    startOrientationsForLevel,
  } from "../../domain/level-orientation-policy";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    startEndOptions,
    level = 3,
    gridMode = GridMode.DIAMOND,
    isFreeformMode = true,
    styleBaseline = PRODUCTION_STYLE_BASELINE,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    onStartEndChange,
    onResetAll = null,
    onClose,
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "choppy";
    handPathMode: "smooth" | "mixed" | "choppy";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    startEndOptions: StartEndOptions | null;
    level?: number;
    gridMode?: GridMode;
    isFreeformMode?: boolean;
    styleBaseline?: CustomizeStyleBaseline;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "choppy") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "choppy") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    onStartEndChange: ((options: StartEndOptions) => void) | null;
    onResetAll?: (() => void) | null;
    onClose: () => void;
  }>();

  let hapticService: HapticFeedback | null = $state(null);

  onMount(() => {
    hapticService = getHapticFeedback();
  });

  // Drill state. One-column mode opens on the root list — picking WHICH factor
  // to change is itself the first decision. Two-pane mode restores the last
  // setting, because the list stays on screen there either way and an empty
  // detail pane next to a full list is just wasted space. The drill panel
  // reports its own mode via onWide.
  let selected = $state<string | null>(null);

  function handleSelect(id: string | null) {
    hapticService?.trigger("selection");
    if (isDrillId(id)) {
      persistedSection = id;
      savePersistedSection(id);
    }
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
    clampStartOrientationToLevel(
      untrack(() => startEndOptions)?.blueStartOrientation,
      level
    )
  );
  let localRedOri = $state<Orientation>(
    clampStartOrientationToLevel(
      untrack(() => startEndOptions)?.redStartOrientation,
      level
    )
  );
  const availableStartOrientations = $derived(
    startOrientationsForLevel(level)
  );

  // Abbreviations come from the summary resolver so the row and the collapsed
  // card can't drift into two vocabularies.
  const oriDisplay = $derived.by(() => {
    const b = localBlueOri ?? Orientation.IN;
    const r = localRedOri ?? Orientation.IN;
    return `${ORIENTATION_SHORT[b] ?? b} · ${ORIENTATION_SHORT[r] ?? r}`;
  });

  // Current preset (All / Classic 3 / Custom) derived from the blocked list.
  const currentPreset = $derived(
    detectPresetFromBlocked(localBlockedPositions, gridMode)
  );

  // How many positions are enabled (for the row summary).
  const enabledCount = $derived(
    getAllowedPositions(localBlockedPositions, gridMode).length
  );

  // Single-select preset options for the SegmentedControl.
  const startPresetOptions = [
    StartPositionPreset.ANY,
    StartPositionPreset.CLASSIC,
    StartPositionPreset.CUSTOM,
  ].map((p) => ({ value: p, label: PRESET_LABELS[p] }));

  // ─── Row values ───
  const startPosDisplay = $derived.by(() => {
    if (!startEndOptions) return "Any";
    if (currentPreset === StartPositionPreset.ANY) return "Any";
    if (currentPreset === StartPositionPreset.CLASSIC) return "Classic 3";
    return enabledCount === 1 ? "1 pos" : `${enabledCount} pos`;
  });

  const endPosDisplay = $derived(
    localEndPosition?.startPosition || localEndPosition?.letter || "Any"
  );

  // Names the axes that differ instead of saying "Custom". The bare word left
  // the collapsed card ("Props: Mixed") looking like it had singled out one of
  // three axes at random, when Props was simply the only one off its default.
  // Same resolver the card uses, so the two can't disagree.
  const styleSummary = $derived.by(() => {
    const { isDefault, facts } = buildCustomizeSummary(
      {
        constraintPreset: localConstraintPreset,
        handPathMode: localHandPathMode,
        motionTypeFilter: localMotionTypeFilter,
        startEndOptions: null,
      },
      styleBaseline
    );
    return isDefault ? "Default" : facts.join(" · ");
  });

  // The four rows. End Position stays present and locked when LOOP owns it —
  // dropping the row would change the list length and move the row below it,
  // and leave a user who saw the setting once with no explanation.
  const drillItems = $derived<SettingsDrillItem[]>([
    { id: "style", label: "Style", value: styleSummary },
    { id: "startPos", label: "Start Position", value: startPosDisplay },
    {
      id: "endPos",
      label: "End Position",
      value: endPosDisplay,
      disabled: !isFreeformMode,
      disabledReason: "Set by LOOP",
    },
    { id: "startOri", label: "Start Orientation", value: oriDisplay },
  ]);

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  // Reset every persisted generation setting. Confirmed first because there's
  // no undo: this overlay's props are a snapshot frozen at open time, so a
  // restore could reach the config but not the local mirrors below, and the
  // panel would sit there reading "Default" over restored values.
  let resetConfirmOpen = $state(false);

  function performResetAll() {
    resetConfirmOpen = false;
    if (!onResetAll) return;
    hapticService?.trigger("selection");
    onResetAll();
    localConstraintPreset = GENERATE_DEFAULT_CONFIG.constraintPreset;
    localHandPathMode = GENERATE_DEFAULT_CONFIG.handPathMode;
    localMotionTypeFilter = GENERATE_DEFAULT_CONFIG.motionTypeFilter;
    localBlockedPositions = [];
    localEndPosition = null;
    localBlueOri = Orientation.IN;
    localRedOri = Orientation.IN;
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
  <!-- Pinned above the drill panel, not inside its list: drilling into a
       setting must never take Close and Reset all off screen. -->
  <div class="overlay-header">
    <h3 class="overlay-title">Customize</h3>
    {#if onResetAll}
      <button
        class="reset-button"
        onclick={() => {
          hapticService?.trigger("selection");
          resetConfirmOpen = true;
        }}
        aria-label="Reset all generation settings to their defaults"
      >
        Reset all
      </button>
    {/if}
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

  <SettingsDrillPanel
    items={drillItems}
    bind:selected
    onSelect={handleSelect}
    onWide={(wide) => {
      // Entering two-pane with nothing chosen would show an empty detail pane
      // beside a full list. Fill it with the last setting the user touched.
      if (wide && selected === null) selected = persistedSection;
    }}
  >
    {#snippet listHeader()}
      <!-- These settings persist across sessions, which is what made a saved
           Choppy props value look like a broken generator. Say so up front. -->
      <p class="overlay-note">These settings stick until you change them again.</p>
    {/snippet}

    {#snippet detail(id)}
      {#if id === "style"}
        <StyleExpandPanel
          constraintPreset={localConstraintPreset}
          handPathMode={localHandPathMode}
          motionTypeFilter={localMotionTypeFilter}
          baseline={styleBaseline}
          haptic={hapticService}
          onPropsChange={(v) => { localConstraintPreset = v; onConstraintPresetChange(v); }}
          onHandsChange={(v) => { localHandPathMode = v; onHandPathModeChange(v); }}
          onDashesChange={(v) => { localMotionTypeFilter = v === "mixed" ? null : v; onMotionTypeFilterChange(v); }}
        />
      {:else if id === "startPos"}
        <SegmentedControl
          options={startPresetOptions}
          value={currentPreset}
          onchange={handlePresetSelect}
          color="accent"
          size="sm"
        />
        <MultiSelectPositionPicker
          blockedPositions={localBlockedPositions}
          onBlockedChange={handleBlockedChange}
          blueStartOrientation={localBlueOri}
          redStartOrientation={localRedOri}
          {gridMode}
        />
      {:else if id === "endPos"}
        <p class="detail-note">Where the sequence ends. Optional.</p>
        <PositionPickerGrid
          currentPosition={localEndPosition}
          onPositionChange={handleEndPositionChange}
          {gridMode}
        />
      {:else if id === "startOri"}
        <p class="detail-note">Level {level}</p>
        <div class="ori-row">
          <span class="ori-color-label ori-blue">Blue</span>
          <PropOrientationControl
            color="blue"
            orientation={localBlueOri}
            allowedOrientations={availableStartOrientations}
            onOrientationChange={handleBlueOriChange}
          />
        </div>
        <div class="ori-row">
          <span class="ori-color-label ori-red">Red</span>
          <PropOrientationControl
            color="red"
            orientation={localRedOri}
            allowedOrientations={availableStartOrientations}
            onOrientationChange={handleRedOriChange}
          />
        </div>
      {/if}
    {/snippet}
  </SettingsDrillPanel>
</div>

<ConfirmDialog
  bind:isOpen={resetConfirmOpen}
  title="Reset all settings?"
  message="Style, start positions, level, length and LOOP settings all go back to their defaults. This can't be undone."
  confirmText="Reset"
  cancelText="Keep"
  variant="danger"
  onConfirm={performResetAll}
  onCancel={() => (resetConfirmOpen = false)}
/>

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
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 4px;
  }

  .overlay-title {
    margin: 0;
    /* Takes the slack so Reset all and Close stay pinned right, and neither
       moves when the title or note changes. */
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: 0.3px;
  }

  /* A real button, not a text link — it's a standalone action. */
  .reset-button {
    flex-shrink: 0;
    min-height: var(--min-touch-target);
    padding: 0 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, white);
    font-family: inherit;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--duration-normal) ease,
      border-color var(--duration-normal) ease;
  }

  .reset-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .reset-button:focus-visible {
    outline: 2px solid var(--customize-accent);
    outline-offset: 2px;
  }

  .overlay-note {
    margin: 0 0 8px;
    flex-shrink: 0;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.55);
  }

  .close-button {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
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
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.3));
  }

  .close-button svg {
    width: 20px;
    height: 20px;
  }

  /* ─── Detail bodies ─── */

  .detail-note {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.55);
  }

  /* Capped: the cycler is a compact control, and letting the row stretch to a
     wide detail pane parked the Blue/Red label a third of a pane away from the
     buttons it names. */
  .ori-row {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 26rem;
  }

  .ori-color-label {
    flex-shrink: 0;
    width: 44px;
    font-size: var(--font-size-sm, 14px);
    font-weight: 700;
    letter-spacing: 0.3px;
  }

  /* Lightened off the raw prop colors: #3b82f6 as text on the panel's dark
     blue gradient was barely readable. Keeps the prop identity, wins the
     contrast. */
  .ori-blue {
    color: color-mix(in srgb, var(--prop-blue, #3b82f6) 55%, white);
  }

  .ori-red {
    color: color-mix(in srgb, var(--prop-red, #ef4444) 75%, white);
  }

  /* ─── Reduced motion ─── */

  @media (prefers-reduced-motion: reduce) {
    .close-button,
    .reset-button {
      transition: none;
    }
  }
</style>

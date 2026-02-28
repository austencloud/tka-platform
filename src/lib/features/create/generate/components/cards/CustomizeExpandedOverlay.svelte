<!--
CustomizeExpandedOverlay.svelte - Expanded overlay covering the card grid
Contains Style (3-axis), Rhythm selector, and Start/End position launcher
Same pattern as LOOPExpandedOverlay: position absolute, inset 0, z-index 100
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount, getContext } from "svelte";
  import { getTemplateById } from "$lib/features/create/shared/domain/templates/duration-templates";
  import type { StartEndOptions, PanelCoordinationState } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    detectPresetFromBlocked,
    getAllPositions,
    StartPositionPreset,
  } from "../../shared/domain/start-position-presets";
  import StyleExpandPanel from "../StyleExpandPanel.svelte";

  let {
    constraintPreset,
    handPathMode,
    motionTypeFilter,
    durationTemplateId,
    startEndOptions,
    gridMode = GridMode.DIAMOND,
    isFreeformMode = true,
    onConstraintPresetChange,
    onHandPathModeChange,
    onMotionTypeFilterChange,
    onOpenDurationPanel,
    onStartEndChange,
    onClose,
  } = $props<{
    constraintPreset: "smooth" | "mixed" | "high-reversal";
    handPathMode: "smooth" | "mixed" | "high";
    motionTypeFilter: "no-dash" | "prefer-dash" | null;
    durationTemplateId: string | null;
    startEndOptions: StartEndOptions | null;
    gridMode?: GridMode;
    isFreeformMode?: boolean;
    onConstraintPresetChange: (v: "smooth" | "mixed" | "high-reversal") => void;
    onHandPathModeChange: (v: "smooth" | "mixed" | "high") => void;
    onMotionTypeFilterChange: (v: "no-dash" | "mixed" | "prefer-dash") => void;
    onOpenDurationPanel: () => void;
    onStartEndChange: ((options: StartEndOptions) => void) | null;
    onClose: () => void;
  }>();

  let hapticService: IHapticFeedback | null = $state(null);
  const panelState = getContext<PanelCoordinationState>("panelState");

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // Rhythm display
  const rhythmDisplay = $derived.by(() => {
    if (!durationTemplateId) return "Off";
    const template = getTemplateById(durationTemplateId);
    return template?.name ?? "Off";
  });

  // Start/End display
  const startEndDisplay = $derived.by(() => {
    if (!startEndOptions) return "Any";
    const blocked = startEndOptions.blockedStartPositions ?? [];
    if (blocked.length === 0) return "Any";

    const allPositions = getAllPositions(gridMode);
    const enabledCount = allPositions.length - blocked.length;
    const preset = detectPresetFromBlocked(blocked, gridMode);

    if (preset === StartPositionPreset.CLASSIC) return "Classic";
    if (enabledCount === 1) return "1 position";
    return `${enabledCount} positions`;
  });

  function handleClose() {
    hapticService?.trigger("selection");
    onClose();
  }

  function handleOpenRhythm() {
    hapticService?.trigger("selection");
    onOpenDurationPanel();
  }

  function handleOpenStartEnd() {
    hapticService?.trigger("selection");
    if (startEndOptions && onStartEndChange) {
      panelState?.openStartEndPanel?.(
        startEndOptions,
        onStartEndChange,
        isFreeformMode,
        gridMode
      );
    }
  }
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

  <!-- Scrollable content -->
  <div class="overlay-content">
    <!-- Style section (3-axis) -->
    <div class="section">
      <div class="section-label">Style</div>
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

    <!-- Rhythm section -->
    <div class="section">
      <button class="section-row" onclick={handleOpenRhythm} aria-label="Configure rhythm: {rhythmDisplay}">
        <span class="section-label">Rhythm</span>
        <span class="section-value">{rhythmDisplay}</span>
        <span class="section-chevron">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </button>
    </div>

    <!-- Start/End section (only when handler available) -->
    {#if startEndOptions && onStartEndChange}
      <div class="section">
        <button class="section-row" onclick={handleOpenStartEnd} aria-label="Configure start position: {startEndDisplay}">
          <span class="section-label">Start Pos.</span>
          <span class="section-value">{startEndDisplay}</span>
          <span class="section-chevron">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
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
    gap: 12px;
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
    gap: 10px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .section-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(255, 255, 255, 0.5);
    padding-left: 2px;
  }

  .section-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.2);
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    color: white;
    cursor: pointer;
    font-family: inherit;
    transition: all var(--duration-normal) ease;
    min-height: 48px;
  }

  .section-row:hover {
    background: rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .section-row:active {
    transform: scale(0.98);
  }

  .section-row .section-label {
    padding-left: 0;
    min-width: 70px;
    text-align: left;
  }

  .section-value {
    flex: 1;
    text-align: right;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .section-chevron {
    width: 16px;
    height: 16px;
    opacity: 0.5;
    flex-shrink: 0;
  }

  .section-chevron svg {
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .section-row,
    .close-button {
      transition: none;
    }
  }
</style>

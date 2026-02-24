<!--
StartEndExpandPanel.svelte - Start/End position configuration panel for the compact toolbar.

Manages pending options state internally. Changes are committed to startEndState
immediately as the user interacts (preset select, position toggle, etc.).
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { StartEndOptionsState } from "../state/start-end-options-state.svelte";
  import type { StartEndOptions } from "$lib/features/create/shared/state/panel-coordination-state.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    detectPresetFromBlocked,
    getAllPositions,
    getBlockedPositionsForPreset,
    StartPositionPreset,
    PRESET_LABELS,
    PRESET_DESCRIPTIONS,
  } from "../shared/domain/start-position-presets";
  import MultiSelectPositionPicker from "$lib/shared/components/position-picker/MultiSelectPositionPicker.svelte";
  import PositionSection from "./modals/customize/PositionSection.svelte";

  let {
    startEndState,
    gridMode,
    isFreeformMode,
    haptic,
  }: {
    startEndState: StartEndOptionsState;
    gridMode: GridMode;
    isFreeformMode: boolean;
    haptic: IHapticFeedback | null;
  } = $props();

  // ============================================================================
  // PENDING OPTIONS STATE (local copy for editing)
  // ============================================================================
  let pendingStartEndOptions = $state<StartEndOptions>({
    blockedStartPositions: [],
    startPosition: null,
    endPosition: null,
    mustContainLetters: [],
    mustNotContainLetters: [],
  });

  // Sync from startEndState (initial + re-sync on external changes)
  $effect.pre(() => {
    pendingStartEndOptions = { ...startEndState.options };
  });

  // ============================================================================
  // DERIVED STATE
  // ============================================================================
  const currentStartPreset = $derived(
    detectPresetFromBlocked(pendingStartEndOptions.blockedStartPositions, gridMode)
  );

  const startEnabledCount = $derived(
    getAllPositions(gridMode).length - pendingStartEndOptions.blockedStartPositions.length
  );

  const startTotalPositions = $derived(getAllPositions(gridMode).length);

  const hasAnyStartEndOptions = $derived(
    pendingStartEndOptions.blockedStartPositions.length > 0 ||
    (isFreeformMode && pendingStartEndOptions.endPosition !== null)
  );

  const availablePresets = [
    StartPositionPreset.ANY,
    StartPositionPreset.CLASSIC,
    StartPositionPreset.CUSTOM,
  ];

  // ============================================================================
  // HANDLERS
  // ============================================================================
  function handlePresetSelect(preset: StartPositionPreset) {
    haptic?.trigger("selection");
    const blockedPositions = getBlockedPositionsForPreset(preset, gridMode);
    pendingStartEndOptions = {
      ...pendingStartEndOptions,
      blockedStartPositions: blockedPositions,
      startPosition: null,
    };
    startEndState.updateOptions(pendingStartEndOptions);
  }

  function handleBlockedChange(blocked: GridPosition[]) {
    pendingStartEndOptions = {
      ...pendingStartEndOptions,
      blockedStartPositions: blocked,
      startPosition: null,
    };
    startEndState.updateOptions(pendingStartEndOptions);
  }

  function handleEndPositionChange(position: PictographData | null) {
    haptic?.trigger("selection");
    pendingStartEndOptions = { ...pendingStartEndOptions, endPosition: position };
    startEndState.updateOptions(pendingStartEndOptions);
  }

  function handleClearAll() {
    haptic?.trigger("selection");
    pendingStartEndOptions = {
      blockedStartPositions: [],
      startPosition: null,
      endPosition: null,
      mustContainLetters: [],
      mustNotContainLetters: [],
    };
    startEndState.updateOptions(pendingStartEndOptions);
  }
</script>

<div class="start-end-panel">
  <!-- Header actions -->
  {#if hasAnyStartEndOptions}
    <button class="se-clear-btn" onclick={handleClearAll}>
      Clear All
    </button>
  {/if}

  <!-- Preset buttons -->
  <div class="se-presets-row">
    {#each availablePresets as preset}
      <button
        class="se-preset-btn"
        class:active={currentStartPreset === preset}
        onclick={() => handlePresetSelect(preset)}
        aria-pressed={currentStartPreset === preset}
      >
        <span class="se-preset-label">{PRESET_LABELS[preset]}</span>
        <span class="se-preset-desc">{PRESET_DESCRIPTIONS[preset]}</span>
      </button>
    {/each}
  </div>

  <!-- Custom indicator -->
  {#if currentStartPreset === StartPositionPreset.CUSTOM}
    <div class="se-custom-indicator">
      <span class="se-custom-badge">Custom</span>
      <span class="se-custom-text">{startEnabledCount} of {startTotalPositions}</span>
    </div>
  {/if}

  <!-- Position picker grid -->
  <MultiSelectPositionPicker
    blockedPositions={pendingStartEndOptions.blockedStartPositions}
    onBlockedChange={handleBlockedChange}
    {gridMode}
  />

  <!-- End Position (freeform only) -->
  {#if isFreeformMode}
    <div class="se-end-section">
      <PositionSection
        title="End Position"
        description="Where the sequence ends"
        currentPosition={pendingStartEndOptions.endPosition}
        onPositionChange={handleEndPositionChange}
        {gridMode}
      />
    </div>
  {/if}
</div>

<style>
  .start-end-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    max-height: 100%;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .se-clear-btn {
    align-self: flex-end;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 14px;
    color: var(--theme-text, white);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 100ms ease;
  }

  .se-clear-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .se-presets-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
  }

  .se-preset-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 6px 4px;
    min-height: 40px;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 100ms ease;
  }

  .se-preset-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .se-preset-btn.active {
    background: rgba(100, 200, 255, 0.15);
    border-color: rgba(100, 200, 255, 0.6);
    box-shadow: 0 0 8px rgba(100, 200, 255, 0.2);
  }

  .se-preset-btn:active {
    transform: scale(0.97);
  }

  .se-preset-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .se-preset-desc {
    font-size: 9px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-align: center;
  }

  .se-custom-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(255, 200, 100, 0.1);
    border: 1px solid rgba(255, 200, 100, 0.3);
    border-radius: 6px;
  }

  .se-custom-badge {
    font-size: 10px;
    font-weight: 600;
    color: rgba(255, 200, 100, 0.9);
    padding: 1px 6px;
    background: rgba(255, 200, 100, 0.15);
    border-radius: 4px;
  }

  .se-custom-text {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  .se-end-section {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 8px;
  }
</style>

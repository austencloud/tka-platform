<!--
  BeatGridSection.svelte

  Beat grid display section for SequenceActionsPanel.
  Includes shift-mode banner when in shift start mode.
-->
<script lang="ts">
  import BeatGrid from "../../workspace-panel/sequence-display/components/BeatGrid.svelte";
  import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
  import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";

  interface Props {
    beats: readonly BeatData[];
    startPosition: BeatData | StartPositionData | null;
    selectedBeatNumber: number | null;
    isShiftMode: boolean;
    onBeatClick: (beatNumber: number) => void;
    onStartClick: () => void;
    onBeatLongPress?: (beatNumber: number) => void;
    onCancelShiftMode: () => void;
  }

  const {
    beats,
    startPosition,
    selectedBeatNumber,
    isShiftMode,
    onBeatClick,
    onStartClick,
    onBeatLongPress,
    onCancelShiftMode,
  }: Props = $props();
</script>

<div class="beat-grid-section" class:shift-mode={isShiftMode}>
  {#if isShiftMode}
    <div class="shift-mode-banner">
      <span>Tap the beat to play first — it becomes Beat 1</span>
      <button class="cancel-btn" onclick={onCancelShiftMode}>Cancel</button>
    </div>
  {/if}
  <BeatGrid
    {beats}
    {startPosition}
    {selectedBeatNumber}
    {onBeatClick}
    {onStartClick}
    onBeatLongPress={isShiftMode ? undefined : onBeatLongPress}
  />
</div>

<style>
  .beat-grid-section {
    flex: 0 0 40%;
    min-height: 0;
    border-top: 1px solid var(--theme-stroke);
    border-bottom: 1px solid var(--theme-stroke);
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .beat-grid-section.shift-mode {
    border-color: rgba(6, 182, 212, 0.5);
    background: rgba(6, 182, 212, 0.05);
  }

  .shift-mode-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: rgba(6, 182, 212, 0.15);
    border-bottom: 1px solid rgba(6, 182, 212, 0.3);
    color: #06b6d4;
    font-size: 0.85rem;
    font-weight: 500;
    flex-shrink: 0;
  }

  .shift-mode-banner .cancel-btn {
    padding: 4px 12px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .shift-mode-banner .cancel-btn:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .shift-mode-banner .cancel-btn {
      transition: none;
    }
  }
</style>

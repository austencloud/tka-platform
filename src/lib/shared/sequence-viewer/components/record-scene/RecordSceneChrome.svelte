<script lang="ts">
  /**
   * RecordSceneChrome
   *
   * Overlay chrome for 3D Record Scene mode. Mounts on top of the full-bleed
   * canvas area (pointer-events: none on the root so clicks reach the canvas
   * by default; individual controls opt back in with pointer-events: auto).
   *
   * Layout:
   *   top-left   : 2D/3D RenderModeToggle
   *   top-right  : Playback popover + Export popover
   *                (sits LEFT of the existing Viewer3DGearPopover that lives
   *                 inside Viewer3DCanvas at top:12, right:12)
   *   bottom-right: Floating Record button
   *
   * The existing NavModeToggle (orbit/fly) and Viewer3DGearPopover (Scene)
   * are NOT reimplemented here — they live inside Viewer3DCanvas and remain
   * visible during Record Scene mode.
   */

  import type { ExportOptionsStateManager } from "../../state/export-options-state.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import RecordScenePlaybackPopover from "./RecordScenePlaybackPopover.svelte";
  import RecordSceneExportPopover from "./RecordSceneExportPopover.svelte";
  import RecordSceneRecordButton from "./RecordSceneRecordButton.svelte";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    bpm: number;
    isPlaying: boolean;
    playbackMode: PlaybackMode;
    singlePlayDuration: number;
    isExporting: boolean;
    canvasReady: boolean;
    onBpmChange: (bpm: number) => void;
    onPlaybackToggle: () => void;
    onPlaybackModeChange: (mode: PlaybackMode) => void;
    onExport: () => void;
  }

  let {
    exportOptions,
    bpm,
    isPlaying,
    playbackMode,
    singlePlayDuration,
    isExporting,
    canvasReady,
    onBpmChange,
    onPlaybackToggle,
    onPlaybackModeChange,
    onExport,
  }: Props = $props();
</script>

<div class="chrome-root">
  <div class="top-right">
    <RecordScenePlaybackPopover
      {exportOptions}
      {bpm}
      {isPlaying}
      {playbackMode}
      {onBpmChange}
      {onPlaybackToggle}
      {onPlaybackModeChange}
    />
    <RecordSceneExportPopover
      {exportOptions}
      {singlePlayDuration}
    />
  </div>

  <div class="bottom-right">
    <RecordSceneRecordButton
      {onExport}
      {isExporting}
      {canvasReady}
    />
  </div>
</div>

<style>
  .chrome-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 5;
  }

  .top-right,
  .bottom-right {
    position: absolute;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    pointer-events: auto;
  }

  /*
   * Offset the right edge past the Viewer3DGearPopover's gear button
   * (36px wide + 12px right padding inside Viewer3DCanvas = 48px). A
   * little more breathing room = 56px.
   */
  .top-right {
    top: 12px;
    right: 56px;
  }

  .bottom-right {
    bottom: 16px;
    right: 16px;
  }

  @media (max-width: 600px) {
    .top-right {
      top: 8px;
      right: 52px;
      gap: 6px;
    }

    .bottom-right {
      bottom: 12px;
      right: 12px;
    }
  }
</style>

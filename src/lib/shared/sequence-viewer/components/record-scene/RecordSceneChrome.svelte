<script lang="ts">
  /**
   * RecordSceneChrome
   *
   * Overlay chrome for 3D Record Scene mode. Mounts on top of the full-bleed
   * canvas area (pointer-events: none on the root so clicks reach the canvas
   * by default; individual controls opt back in with pointer-events: auto).
   *
   * Layout:
   *   bottom-right: Floating Record button
   *
   * Tempo and Export popovers now live on the right rail (see RightRail.svelte).
   * The Viewer3DGearPopover (Scene) lives inside Viewer3DCanvas and remains
   * visible during Record Scene mode.
   */

  import RecordSceneRecordButton from "./RecordSceneRecordButton.svelte";

  interface Props {
    isExporting: boolean;
    canvasReady: boolean;
    onExport: () => void;
  }

  let { isExporting, canvasReady, onExport }: Props = $props();
</script>

<div class="chrome-root">
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

  .bottom-right {
    position: absolute;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    pointer-events: auto;
    bottom: 68px;
    right: 16px;
  }

  @media (max-width: 600px) {
    .bottom-right {
      bottom: 60px;
      right: 12px;
    }
  }
</style>

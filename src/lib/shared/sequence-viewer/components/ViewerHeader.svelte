<!--
  ViewerHeader.svelte

  Three-region floating overlay header for the sequence viewer.
  Per spec §6.1: left = Back + 2D/3D toggle, center = VIEWER badge + title, right = info chip.
-->
<script lang="ts">
  import DestinationBadge from "./DestinationBadge.svelte";
  import InfoChipPopover from "./InfoChipPopover.svelte";
  import RenderModeToggle from "./RenderModeToggle.svelte";

  interface Props {
    sequenceTitle: string;
    renderMode: "2d" | "3d";
    onRenderModeChange: (mode: "2d" | "3d") => void;
    onClose: () => void;
  }
  let { sequenceTitle, renderMode, onRenderModeChange, onClose }: Props = $props();
</script>

<header class="viewer-header">
  <div class="header-left">
    <button class="icon-btn" onclick={onClose} aria-label="Close">
      <i class="fas fa-times"></i>
    </button>
    <RenderModeToggle {renderMode} onchange={onRenderModeChange} />
  </div>

  <div class="header-center">
    <DestinationBadge label="VIEWER" />
    <span class="seq-title">{sequenceTitle}</span>
  </div>

  <div class="header-right">
    <InfoChipPopover />
  </div>
</header>

<style>
  .viewer-header {
    position: absolute;
    top: 12px; left: 12px; right: 12px;
    height: var(--min-touch-target);
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 8px 0 6px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    z-index: 10;
  }
  .header-left, .header-right { display: flex; align-items: center; gap: 6px; }
  .header-center {
    display: flex; align-items: center; gap: 10px;
    position: absolute; left: 50%; transform: translateX(-50%);
  }
  .icon-btn {
    height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    padding: 0 12px;
    background: transparent; border: none; border-radius: 10px;
    color: rgba(255,255,255,0.62);
    font-size: 13px; font-weight: 500;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .icon-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.95); }
  .seq-title { color: rgba(255,255,255,0.95); font-size: 14px; font-weight: 600; }
</style>

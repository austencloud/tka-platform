<script lang="ts">
  import { getViewer3DContext } from "../context/viewer-3d-context";
  import Viewer3DViewPresets from "./Viewer3DViewPresets.svelte";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "camera");
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="camera-popover"
    role="dialog"
    aria-label="Camera presets"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
    out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">Camera</span>
    </div>
    <div class="pop-body">
      <Viewer3DViewPresets grid />
    </div>
  </div>
{/if}

<style>
  .camera-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 300px;
    border-radius: 18px;
    transform-origin: top right;
    background: rgba(20, 22, 32, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(24px) saturate(150%);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }

  .pop-header {
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .pop-title {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.88);
    letter-spacing: 0.03em;
  }

  .pop-body {
    padding: 12px 14px 14px;
  }
</style>

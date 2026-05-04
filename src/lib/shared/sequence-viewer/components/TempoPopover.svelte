<script lang="ts">
  import { getViewer3DContext } from "$lib/shared/3d/context/viewer-3d-context";
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";
  import { scale } from "svelte/transition";
  import { backOut, cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "tempo");

  interface Props {
    bpm: number;
    onBpmChange: (bpm: number) => void;
  }
  let { bpm, onBpmChange }: Props = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="pop"
    role="dialog"
    aria-label="Tempo"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">Tempo</div>
    <div class="pop-body">
      <BpmChips {bpm} variant="full" {onBpmChange} />
    </div>
  </div>
{/if}

<style>
  .pop {
    position: absolute; right: calc(100% + 10px); top: 0;
    width: 340px;
    background: rgba(20, 22, 32, 0.82);
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 18px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    z-index: 100;
  }
  .pop-header { padding: 14px 16px 10px; border-bottom: 1px solid rgba(255,255,255,0.10); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.42); }
  .pop-body { padding: 14px 16px 16px; }
</style>

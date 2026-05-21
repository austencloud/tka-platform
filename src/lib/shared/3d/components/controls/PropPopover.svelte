<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import PropSizeControl from "$lib/shared/sequence-viewer/components/PropSizeControl.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { getPerformerColor } from "../../constants/performer-colors";
  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const open = $derived(viewer.activePopover === "prop");
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));
  const performerLabel = $derived(selectedIndex !== null ? `Performer ${selectedIndex + 1}` : "");

  const selected = $derived.by(() => {
    if (selectedIndex === null) return null;
    return viewer.performerManager.performers[selectedIndex] ?? null;
  });
</script>

{#if open && selected}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="prop-popover"
    role="dialog"
    aria-label="Prop for performer {(selectedIndex ?? 0) + 1}"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onpointerdown={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') viewer.closePopover(); }}
    in:scale={{ duration: 220, start: 0.92, opacity: 0, easing: backOut }}
    out:scale={{ duration: 160, start: 0.95, opacity: 0, easing: cubicOut }}
  >
    <div class="pop-header">
      <span class="pop-title">{performerLabel}</span>
      <span class="pop-badge" style:background={performerColor}></span>
    </div>
    <div class="pop-body">
      <BentoPropGrid
        selectedPropType={selected.settings.prop ?? PropType.STAFF}
        color={performerColor}
        variant="inline"
        onSelect={(p) => selected.setProp(p)}
      />
      <div class="size-section">
        <PropSizeControl performer={selected} />
      </div>
    </div>
  </div>
{/if}

<style>
  .prop-popover {
    position: absolute;
    right: calc(100% + 10px);
    top: 0;
    z-index: 100;
    width: 420px;
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
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pop-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.42);
  }
  .pop-badge {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pop-body {
    padding: 12px 14px 14px;
    max-height: 70vh;
    overflow-y: auto;
  }
  .size-section {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>

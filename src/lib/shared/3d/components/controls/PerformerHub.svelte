<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";
  import { createSheetDismiss } from "./BottomSheet.svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  interface Props {
    onSettingChange?: ViewerControlSink;
  }
  let { onSettingChange }: Props = $props();

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performers = $derived(viewer.performerManager.performers);
  const performerColor = $derived(
    selectedIndex !== null
      ? getPerformerColor(selectedIndex)
      : "var(--theme-accent)"
  );

  let detailCollapsed = $state(true);
  let hasInteracted = $state(false);

  function handleSpineInteract() {
    const previous = !detailCollapsed;
    hasInteracted = true;
    detailCollapsed = false;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "detail_open",
      previous,
      true,
      { count: false }
    );
  }

  function collapseDetail() {
    const previous = !detailCollapsed;
    detailCollapsed = true;
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "detail_open",
      previous,
      false
    );
  }

  let hubEl = $state<HTMLElement | null>(null);

  // Top-layer/portalled modals opened from inside the dock - the sequence
  // picker's native <dialog>, and Bits UI dialogs (e.g. the "Remove
  // performer?" ConfirmDialog) that portal their content to document.body as
  // a plain div - must not dismiss the dock behind them. `contains()` alone
  // misses the portalled case since that content never lives inside hubEl.
  function isModalTarget(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      target.closest(
        "dialog, [role='dialog'], [role='alertdialog'], [data-dialog-content]"
      ) !== null
    );
  }

  const dismiss = createSheetDismiss(collapseDetail, () => hubEl, isModalTarget);
</script>

<svelte:window
  onpointerdowncapture={(e) => {
    if (!detailCollapsed) dismiss.onBackdropPointerDown(e);
  }}
  onkeydown={(e) => {
    if (!detailCollapsed) dismiss.onKeydown(e);
  }}
/>

{#if performers.length >= 1}
  <div
    class="hub-anchor"
    class:detail-open={!detailCollapsed}
    bind:this={hubEl}
    style:--panel-color={performerColor}
  >
    <div class="spine-panel" class:has-detail={!detailCollapsed}>
      <PerformerSpine
        onInteract={handleSpineInteract}
        {hasInteracted}
        {onSettingChange}
      />
    </div>

    {#if !detailCollapsed}
      <div
        class="detail-panel"
        transition:slide={{ axis: "x", duration: 260, easing: cubicOut }}
      >
        <button
          class="close-tab"
          aria-label="Close controls"
          onclick={collapseDetail}
        >
          <i class="fas fa-times"></i>
        </button>
        <PerformerHubDetail {onSettingChange} />
      </div>
    {/if}
  </div>
{/if}

<style>
  div.hub-anchor {
    position: absolute;
    top: 12px;
    bottom: 90px;
    left: 16px;
    right: 16px;
    z-index: 20;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    container-type: inline-size;
    /* The anchor spans the scene height so the detail panel can cap to it.
       It must not intercept scene input in the empty area above the panels. */
    pointer-events: none;
  }

  .hub-anchor.detail-open {
    /* One control surface owns the foreground at a time. On phones the detail
       panel reaches beneath the scene rail, so it must sit above that rail
       until the user closes the performer editor. */
    z-index: 40;
  }

  .spine-panel {
    padding: 8px 6px;
    /* --theme-panel-bg is translucent in dark mode; the identical-stop gradient
       is an image layer stacked over the opaque black underlay. Do not collapse
       to a plain background-color - that loses opacity against the 3D scene. */
    background:
      linear-gradient(
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg)),
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg))
      ),
      black;
    border: 1px solid
      color-mix(in srgb, var(--panel-color) 22%, var(--theme-stroke));
    border-radius: 14px;
    box-shadow:
      var(--theme-panel-shadow),
      0 1px 0 inset color-mix(in srgb, var(--theme-text) 4%, transparent);
    flex-shrink: 0;
    pointer-events: auto;
    transition:
      border-radius 220ms ease,
      border-color 220ms ease,
      background 220ms ease;
  }

  .spine-panel.has-detail {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right-color: transparent;
  }

  .detail-panel {
    position: relative;
    background:
      linear-gradient(
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg)),
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg))
      ),
      black;
    border: 1px solid
      color-mix(in srgb, var(--panel-color) 28%, var(--theme-stroke));
    border-left: 1px solid
      color-mix(in srgb, var(--panel-color) 14%, transparent);
    border-radius: 0 14px 14px 0;
    box-shadow:
      var(--theme-panel-shadow),
      0 1px 0 inset color-mix(in srgb, var(--theme-text) 4%, transparent),
      inset 1px 0 0 color-mix(in srgb, var(--theme-text) 3%, transparent);
    overflow: hidden;
    max-width: calc(100vw - 140px);
    pointer-events: auto;
    display: flex;
    /* The dock is a control surface over the stage, never a modal: cap it to
       half the scene column and a fixed tall-screen ceiling so the performer
       stays visible behind it. Width resolves against the anchor, which now
       spans the column (left+right), not the viewport. */
    width: clamp(32.5rem, 50%, 68.75rem);
    max-height: min(100%, 48rem);
  }

  @container (max-width: 767px) {
    .detail-panel {
      width: calc(100cqw - 62px);
      max-width: none;
    }
  }

  .close-tab {
    position: absolute;
    top: -1px;
    right: -1px;
    z-index: 5;
    width: 44px;
    height: 44px;
    border-radius: 0 14px 0 14px;
    border: none;
    background: color-mix(
      in srgb,
      var(--panel-color) 15%,
      var(--surface-darker)
    );
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background 140ms ease,
      color 140ms ease,
      transform 140ms ease;
  }

  .close-tab:hover {
    background: color-mix(
      in srgb,
      var(--panel-color) 30%,
      var(--surface-darker)
    );
    color: var(--theme-text);
    transform: scale(1.08);
  }

  .close-tab i {
    font-size: 12px;
  }

  /* ─── Focus-visible ─── */
  button:focus-visible {
    outline: 2px solid var(--panel-color, var(--theme-accent));
    outline-offset: 2px;
  }

  /* ─── Reduced motion ─── */
  @media (prefers-reduced-motion: reduce) {
    .spine-panel {
      transition: none;
    }
  }
</style>

<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";
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

  function handleOutsidePointer(event: PointerEvent) {
    if (detailCollapsed) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (hubEl?.contains(target)) return;
    // Modals launched from the hub (avatar select, sequence picker, confirm
    // dialogs) render in top-layer <dialog> elements outside the hub subtree;
    // interacting with them must not dismiss the dock behind them.
    if (target instanceof Element && target.closest("dialog")) return;
    collapseDetail();
  }
</script>

<svelte:window onpointerdowncapture={handleOutsidePointer} />

{#if performers.length >= 1}
  <div class="hub-anchor" bind:this={hubEl} style:--panel-color={performerColor}>
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
  .hub-anchor {
    position: absolute;
    top: 12px;
    bottom: 90px;
    left: 16px;
    z-index: 20;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    /* The anchor spans the scene height so the detail panel can cap to it.
       It must not intercept scene input in the empty area above the panels. */
    pointer-events: none;
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
    max-height: 100%;
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

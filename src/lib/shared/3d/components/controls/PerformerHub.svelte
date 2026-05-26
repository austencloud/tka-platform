<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const performers = $derived(viewer.performerManager.performers);
  const performerColor = $derived(
    selectedIndex !== null ? getPerformerColor(selectedIndex) : "#4a9eff",
  );

  let detailCollapsed = $state(true);
  let hasInteracted = $state(false);

  function handleSpineInteract() {
    hasInteracted = true;
    detailCollapsed = false;
  }

  function collapseDetail() {
    detailCollapsed = true;
  }
</script>

{#if performers.length >= 1}
  <div class="hub-anchor" style:--panel-color={performerColor}>
    <div class="spine-panel" class:has-detail={!detailCollapsed}>
      <PerformerSpine onInteract={handleSpineInteract} {hasInteracted} />
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
        <PerformerHubDetail />
      </div>
    {/if}
  </div>
{/if}

<style>
  .hub-anchor {
    position: absolute;
    bottom: 90px;
    left: 16px;
    z-index: 20;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
  }

  .spine-panel {
    padding: 8px 6px;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--panel-color) 10%, rgba(20, 22, 32, 0.85)),
      color-mix(in srgb, var(--panel-color) 4%, rgba(20, 22, 32, 0.85))
    );
    backdrop-filter: blur(28px) saturate(160%);
    border: 1px solid
      color-mix(in srgb, var(--panel-color) 22%, rgba(255, 255, 255, 0.07));
    border-radius: 14px;
    box-shadow:
      0 6px 32px rgba(0, 0, 0, 0.55),
      0 1px 0 inset rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
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
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--panel-color) 12%, rgba(20, 22, 32, 0.85)),
      color-mix(in srgb, var(--panel-color) 4%, rgba(20, 22, 32, 0.85))
    );
    backdrop-filter: blur(28px) saturate(160%);
    border: 1px solid
      color-mix(in srgb, var(--panel-color) 28%, rgba(255, 255, 255, 0.07));
    border-left: none;
    border-radius: 0 14px 14px 0;
    box-shadow:
      0 6px 32px rgba(0, 0, 0, 0.55),
      0 1px 0 inset rgba(255, 255, 255, 0.04),
      inset 1px 0 0 rgba(255, 255, 255, 0.03);
    overflow: hidden;
    max-width: calc(100vw - 140px);
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
    background: color-mix(in srgb, var(--panel-color) 15%, rgba(0, 0, 0, 0.4));
    color: rgba(255, 255, 255, 0.4);
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
    background: color-mix(in srgb, var(--panel-color) 30%, rgba(0, 0, 0, 0.5));
    color: white;
    transform: scale(1.08);
  }

  .close-tab i {
    font-size: 12px;
  }

  /* ─── Focus-visible ─── */
  button:focus-visible {
    outline: 2px solid var(--panel-color, #4a9eff);
    outline-offset: 2px;
  }

  /* ─── Reduced motion ─── */
  @media (prefers-reduced-motion: reduce) {
    .spine-panel {
      transition: none;
    }
  }
</style>

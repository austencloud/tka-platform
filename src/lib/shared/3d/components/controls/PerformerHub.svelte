<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { getPerformerColor } from "../../constants/performer-colors";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const hasSelection = $derived(selectedIndex !== null);
  const performers = $derived(viewer.performerManager.performers);
  const performerColor = $derived(selectedIndex !== null ? getPerformerColor(selectedIndex) : "#6b7280");

  let detailCollapsed = $state(false);
  let prevIndex = $state<number | null>(null);

  $effect(() => {
    if (selectedIndex !== prevIndex) {
      detailCollapsed = false;
      prevIndex = selectedIndex;
    }
  });

  function collapseDetail() {
    detailCollapsed = true;
  }
</script>

{#if performers.length >= 1}
  <div class="hub-anchor" style:--panel-color={performerColor}>
    <div class="spine-panel" class:has-detail={hasSelection && !detailCollapsed}>
      <PerformerSpine />
    </div>

    {#if hasSelection && !detailCollapsed}
      <div
        class="detail-panel"
        transition:slide={{ axis: "x", duration: 250, easing: cubicOut }}
      >
        <button class="close-btn" aria-label="Close controls" onclick={collapseDetail}>
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
    gap: 0;
  }

  .spine-panel {
    padding: 8px 6px;
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--panel-color) 10%, rgba(20, 22, 32, 0.82)),
        color-mix(in srgb, var(--panel-color) 5%, rgba(20, 22, 32, 0.82))
      );
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid color-mix(in srgb, var(--panel-color) 25%, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
    transition: border-radius 200ms ease, border-color 200ms ease, background 200ms ease;
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
        135deg,
        color-mix(in srgb, var(--panel-color) 12%, rgba(20, 22, 32, 0.82)),
        color-mix(in srgb, var(--panel-color) 5%, rgba(20, 22, 32, 0.82))
      );
    backdrop-filter: blur(24px) saturate(150%);
    border: 1px solid color-mix(in srgb, var(--panel-color) 30%, rgba(255, 255, 255, 0.08));
    border-left: none;
    border-radius: 0 14px 14px 0;
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 color-mix(in srgb, var(--panel-color) 10%, transparent);
    overflow: hidden;
    max-width: calc(100vw - 140px);
  }

  .close-btn {
    position: absolute;
    top: -1px;
    right: -1px;
    z-index: 5;
    width: 30px;
    height: 30px;
    border-radius: 0 14px 0 10px;
    border: none;
    background: color-mix(in srgb, var(--panel-color) 18%, rgba(0, 0, 0, 0.5));
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 140ms ease;
  }

  .close-btn:hover {
    background: color-mix(in srgb, var(--panel-color) 30%, rgba(0, 0, 0, 0.5));
    color: white;
  }

  .close-btn i {
    font-size: 11px;
  }
</style>

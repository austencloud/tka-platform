<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const hasSelection = $derived(selectedIndex !== null);
  const performers = $derived(viewer.performerManager.performers);
</script>

{#if performers.length >= 1}
  <div class="hub-anchor">
    <div class="spine-panel">
      <PerformerSpine />
    </div>

    {#if hasSelection}
      <div
        class="detail-panel"
        transition:slide={{ axis: "x", duration: 250, easing: cubicOut }}
      >
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
    gap: 8px;
  }

  .spine-panel {
    padding: 8px 6px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    flex-shrink: 0;
  }

  .detail-panel {
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    max-width: calc(100vw - 180px);
  }
</style>

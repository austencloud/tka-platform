<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import PerformerSpine from "./PerformerSpine.svelte";
  import PerformerHubDetail from "./PerformerHubDetail.svelte";

  const viewer = getViewer3DContext();
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const hasSelection = $derived(selectedIndex !== null);
  const performers = $derived(viewer.performerManager.performers);
</script>

{#if performers.length >= 1}
  <div class="performer-hub" class:has-selection={hasSelection}>
    <div class="spine-wrap">
      <PerformerSpine />
    </div>

    {#if hasSelection}
      <div class="detail-wrap">
        <PerformerHubDetail />
      </div>
    {/if}
  </div>
{/if}

<style>
  .performer-hub {
    position: absolute;
    bottom: 16px;
    left: 16px;
    z-index: 20;
    max-width: calc(100% - 100px);

    display: flex;
    flex-direction: row;
    align-items: stretch;

    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);

    overflow: hidden;
  }

  .spine-wrap {
    padding: 8px 6px;
    flex-shrink: 0;
  }

  .detail-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
</style>

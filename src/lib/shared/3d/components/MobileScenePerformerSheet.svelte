<!-- src/lib/shared/3d/components/MobileScenePerformerSheet.svelte -->
<script lang="ts">
  /**
   * Performer controls for the mobile bottom sheet. Wraps the same
   * PerformerSpine (selection chips) + PerformerHubDetail (Avatar/Seq/Prop/
   * Planes/Effort/FX tabs) the desktop PerformerHub uses, re-flowed to the
   * sheet width.
   */
  import PerformerSpine from "./controls/PerformerSpine.svelte";
  import PerformerHubDetail from "./controls/PerformerHubDetail.svelte";
</script>

<div class="mobile-performer-sheet">
  <div class="spine-row">
    <PerformerSpine hasInteracted={true} />
  </div>
  <div class="detail-wrap">
    <PerformerHubDetail />
  </div>
</div>

<style>
  .mobile-performer-sheet {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  /* Selection chips run horizontally in the sheet, not the vertical spine. */
  .spine-row :global(.performer-spine) {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }
  .spine-row :global(.separator) {
    width: 1px;
    height: 32px;
  }
  /* Let the 440px desktop detail shrink to the sheet. */
  .detail-wrap :global(.hub-detail) {
    width: 100%;
  }
</style>

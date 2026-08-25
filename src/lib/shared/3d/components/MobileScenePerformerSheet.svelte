<!-- src/lib/shared/3d/components/MobileScenePerformerSheet.svelte -->
<script lang="ts">
  import type { ViewerControlSink } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import PerformerHubDetail from "./controls/PerformerHubDetail.svelte";
  import PerformerSpine from "./controls/PerformerSpine.svelte";
  import type { PerformerEditSink } from "./controls/performer-hub-types";

  interface Props {
    onSettingChange?: ViewerControlSink;
    /** Forwarded to the detail panel — see PerformerHubDetail's Props. */
    onPerformerEdit?: PerformerEditSink;
  }

  let { onSettingChange, onPerformerEdit }: Props = $props();
</script>

<!--
  A compact workspace has no rail and no stage performer bar, so the sheet
  carries the same selection strip the stage shows on wider screens. Both are
  the one PerformerSpine; only the surface around it differs.
-->
<div class="performer-sheet">
  <div class="scope-row">
    <PerformerSpine {onSettingChange} />
  </div>
  <PerformerHubDetail {onSettingChange} {onPerformerEdit} />
</div>

<style>
  .performer-sheet {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .scope-row {
    flex: none;
    min-width: 0;
  }
</style>

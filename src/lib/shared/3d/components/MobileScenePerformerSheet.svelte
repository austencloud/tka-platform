<!-- src/lib/shared/3d/components/MobileScenePerformerSheet.svelte -->
<script lang="ts">
  import type { ViewerControlSink } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import PerformerInspectorContent from "./controls/PerformerInspectorContent.svelte";
  import type { PerformerEditSink } from "./controls/performer-hub-types";

  interface Props {
    onSettingChange?: ViewerControlSink;
    /** Forwarded to the detail panel — see PerformerHubDetail's Props. */
    onPerformerEdit?: PerformerEditSink;
  }

  let { onSettingChange, onPerformerEdit }: Props = $props();
</script>

<PerformerInspectorContent compact {onSettingChange} {onPerformerEdit} />

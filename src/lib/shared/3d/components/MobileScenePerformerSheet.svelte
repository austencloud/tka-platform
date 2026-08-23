<!-- src/lib/shared/3d/components/MobileScenePerformerSheet.svelte -->
<script lang="ts">
  import type { ViewerControlSink } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";
  import PerformerInspectorContent from "./controls/PerformerInspectorContent.svelte";

  interface Props {
    onSettingChange?: ViewerControlSink;
  }

  let { onSettingChange }: Props = $props();
</script>

<PerformerInspectorContent compact {onSettingChange} />

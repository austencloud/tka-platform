<!--
PositionPickerGrid.svelte - Re-exports from shared for backwards compatibility
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import SharedPositionPickerGrid from "$lib/shared/components/position-picker/PositionPickerGrid.svelte";

  let {
    currentPosition = null,
    onPositionChange,
    gridMode = GridMode.DIAMOND,
  } = $props<{
    currentPosition: PictographData | null;
    onPositionChange: (position: PictographData | null) => void;
    gridMode?: GridMode;
  }>();
</script>

<SharedPositionPickerGrid {currentPosition} {onPositionChange} {gridMode} />

<!--
PositionSection.svelte - Re-exports from shared for backwards compatibility
-->
<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import SharedPositionSection from "$lib/shared/components/position-picker/PositionSection.svelte";

  let {
    title,
    description,
    currentPosition,
    onPositionChange,
    gridMode = GridMode.DIAMOND,
    disabled = false,
    disabledReason = "",
  } = $props<{
    title: string;
    description: string;
    currentPosition: PictographData | null;
    onPositionChange: (position: PictographData | null) => void;
    gridMode?: GridMode;
    disabled?: boolean;
    disabledReason?: string;
  }>();
</script>

<SharedPositionSection
  {title}
  {description}
  {currentPosition}
  {onPositionChange}
  {gridMode}
  {disabled}
  {disabledReason}
/>

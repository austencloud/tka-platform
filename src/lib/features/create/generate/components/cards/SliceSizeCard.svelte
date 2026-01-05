<!--
SliceSizeCard.svelte - Card for selecting slice size (circular mode)
Shows BOTH slice size options vertically with clear active/inactive states
-->
<script lang="ts">
  import { SliceSize } from "../../circular/domain/models/circular-models";
  import ToggleCard from "./ToggleCard.svelte";

  let {
    currentSliceSize,
    onSliceSizeChange,
    // 🎨 Vibrant pink gradient
    color = "linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)",
    shadowColor = "330deg 75% 55%", // Pink-matched shadow
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentSliceSize: SliceSize;
    onSliceSizeChange: (sliceSize: SliceSize) => void;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();
</script>

<ToggleCard
  title="Slice"
  option1={{
    value: SliceSize.QUARTERED,
    label: "Quartered",
    icon: "circle-quarter-custom",
  }}
  option2={{
    value: SliceSize.HALVED,
    label: "Halved",
    icon: "circle-half-stroke",
  }}
  activeOption={currentSliceSize}
  onToggle={onSliceSizeChange}
  {color}
  {shadowColor}
  {gridColumnSpan}
  {cardIndex}
  {headerFontSize}
/>

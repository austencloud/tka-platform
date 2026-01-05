<!--
PropContinuityCard.svelte - Card for toggling prop continuity
Shows BOTH continuity options vertically with clear active/inactive states
-->
<script lang="ts">
  import { PropContinuity } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import ToggleCard from "./ToggleCard.svelte";

  let {
    currentContinuity,
    onContinuityChange,
    // 🎨 Luminance-aware cyan gradient - adapts to background brightness
    color = "linear-gradient(135deg, var(--card-cyan, #06b6d4) 0%, var(--card-cyan-end, #0891b2) 100%)",
    shadowColor = "190deg 80% 50%", // Cyan-matched shadow
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentContinuity: PropContinuity;
    onContinuityChange: (continuity: PropContinuity) => void;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();
</script>

<ToggleCard
  title="Continuity"
  option1={{
    value: PropContinuity.CONTINUOUS,
    label: "Continuous",
    icon: "link",
  }}
  option2={{
    value: PropContinuity.RANDOM,
    label: "Reversals",
    icon: "left-right",
  }}
  activeOption={currentContinuity}
  onToggle={onContinuityChange}
  {color}
  {shadowColor}
  {gridColumnSpan}
  {cardIndex}
  {headerFontSize}
/>

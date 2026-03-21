<!--
PresetCard - Shows active preset name or opens drawer to browse presets
-->
<script lang="ts">
  import BaseCard from "./BaseCard.svelte";
  import type { GenerationPreset } from "../../state/preset.svelte";

  let {
    activePreset = null,
    onOpenDrawer,
    color = "",
    shadowColor = "",
    cardIndex = 0,
  } = $props<{
    activePreset?: GenerationPreset | null;
    onOpenDrawer?: () => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
  }>();

  const title = "Preset";
  const displayValue = $derived(
    activePreset ? `${activePreset.icon ?? ""} ${activePreset.name}`.trim() : "Browse"
  );
</script>

<BaseCard
  {title}
  currentValue={displayValue}
  {color}
  {shadowColor}
  {cardIndex}
  clickable
  onClick={onOpenDrawer}
/>

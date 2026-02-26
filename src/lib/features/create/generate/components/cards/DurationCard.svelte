<!--
DurationCard.svelte - Card for rhythm/duration template selection
Shows current template name and opens duration rhythm panel when clicked
-->
<script lang="ts">
  import { getTemplateById } from "$lib/features/create/shared/domain/templates/duration-templates";
  import BaseCard from "./BaseCard.svelte";

  let {
    durationTemplateId,
    onOpenDurationPanel,
    color = "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    shadowColor = "38deg 75% 50%",
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    durationTemplateId: string | null;
    onOpenDurationPanel: () => void;
    color?: string;
    shadowColor?: string;
    cardIndex?: number;
    headerFontSize?: string;
  }>();

  let displayValue = $derived.by(() => {
    if (!durationTemplateId) return "Off";
    const template = getTemplateById(durationTemplateId);
    return template?.name ?? "Off";
  });
</script>

<BaseCard
  title="Rhythm"
  currentValue={displayValue}
  {color}
  {shadowColor}
  clickable={true}
  {cardIndex}
  {headerFontSize}
  onClick={onOpenDurationPanel}
/>

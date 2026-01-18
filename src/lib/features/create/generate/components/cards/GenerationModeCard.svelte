<!--
GenerationModeCard.svelte - Card for toggling generation mode
Shows BOTH Freeform and Circular options vertically with clear active/inactive states
-->
<script lang="ts">
  import { GenerationMode } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import ToggleCard from "./ToggleCard.svelte";

  let {
    currentMode,
    onModeChange,
    // 🎨 Vibrant purple gradient
    color = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)",
    shadowColor = "270deg 70% 55%", // Purple-matched shadow
    gridColumnSpan = 2,
    cardIndex = 0,
    headerFontSize = "9px",
  } = $props<{
    currentMode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    cardIndex?: number;
    headerFontSize?: string;
  }>();
</script>

<ToggleCard
  title={t("generator_mode")}
  option1={{
    value: GenerationMode.CIRCULAR,
    label: t("generator_mode_loop"),
    icon: "arrows-rotate",
  }}
  option2={{
    value: GenerationMode.FREEFORM,
    label: t("generator_mode_freeform"),
    icon: "bullseye",
  }}
  activeOption={currentMode}
  onToggle={onModeChange}
  {color}
  {shadowColor}
  {gridColumnSpan}
  {cardIndex}
  {headerFontSize}
/>

<!--
LengthCard.svelte - Card for selecting sequence length
Shows current length with +/- stepper controls for quick adjustment
-->
<script lang="ts">
  import { GenerationMode } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import StepperCard from "./StepperCard/StepperCard.svelte";

  let {
    currentLength,
    currentMode,
    loopEnabled = false,
    locked = false,
    onLengthChange,
    // 🎨 Luminance-aware blue gradient - uses CSS variables that adapt to background brightness
    color = "radial-gradient(ellipse at top left, var(--card-blue, #3b82f6) 0%, var(--card-blue, #3b82f6) 40%, var(--card-blue-end, #1d4ed8) 100%)",
    shadowColor = "220deg 80% 55%", // Blue-matched shadow
    gridColumnSpan = 2,
    headerFontSize = "9px",
  } = $props<{
    currentLength: number;
    currentMode: GenerationMode;
    loopEnabled?: boolean;
    /** When true, length is determined by word and cannot be changed */
    locked?: boolean;
    onLengthChange: (length: number) => void;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    headerFontSize?: string;
  }>();

  // Length constraints - LOOP-dependent (LOOP needs even lengths)
  const MAX_LENGTH = 64;

  const MIN_LENGTH = $derived(loopEnabled ? 2 : 1);
  const STEP = $derived(loopEnabled ? 2 : 1);

  function handleIncrement() {
    if (locked) return;
    const newLength = Math.min(currentLength + STEP, MAX_LENGTH);
    onLengthChange(newLength);
  }

  function handleDecrement() {
    if (locked) return;
    const newLength = Math.max(currentLength - STEP, MIN_LENGTH);
    onLengthChange(newLength);
  }

  function formatValue(value: number): string {
    // When locked to a word, show "6+" to hint that bridges will increase the actual beat count
    if (locked) return `${value}+`;
    return value.toString();
  }
</script>

{#if locked}
  <div class="locked-wrapper">
    <StepperCard
      title="Length (word)"
      currentValue={currentLength}
      minValue={MIN_LENGTH}
      maxValue={MAX_LENGTH}
      onIncrement={handleIncrement}
      onDecrement={handleDecrement}
      {formatValue}
      {color}
      {shadowColor}
      {gridColumnSpan}
      {headerFontSize}
    />
  </div>
{:else}
  <StepperCard
    title={t("generator_length")}
    currentValue={currentLength}
    minValue={MIN_LENGTH}
    maxValue={MAX_LENGTH}
    onIncrement={handleIncrement}
    onDecrement={handleDecrement}
    {formatValue}
    {color}
    {shadowColor}
    {gridColumnSpan}
    {headerFontSize}
  />
{/if}

<style>
  .locked-wrapper {
    width: 100%;
    height: 100%;
    opacity: 0.6;
    pointer-events: none;
  }
</style>

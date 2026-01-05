<!--
LengthCard.svelte - Card for selecting sequence length
Shows current length with +/- stepper controls for quick adjustment
-->
<script lang="ts">
  import { GenerationMode } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import StepperCard from "./StepperCard/StepperCard.svelte";

  let {
    currentLength,
    currentMode,
    onLengthChange,
    // 🎨 Luminance-aware blue gradient - uses CSS variables that adapt to background brightness
    color = "radial-gradient(ellipse at top left, var(--card-blue, #3b82f6) 0%, var(--card-blue, #3b82f6) 40%, var(--card-blue-end, #1d4ed8) 100%)",
    shadowColor = "220deg 80% 55%", // Blue-matched shadow
    gridColumnSpan = 2,
    headerFontSize = "9px",
  } = $props<{
    currentLength: number;
    currentMode: GenerationMode;
    onLengthChange: (length: number) => void;
    color?: string;
    shadowColor?: string;
    gridColumnSpan?: number;
    headerFontSize?: string;
  }>();

  // Length constraints - mode-dependent
  const MAX_LENGTH = 64;

  // Derived values based on generation mode
  const isCircularMode = $derived(currentMode === GenerationMode.CIRCULAR);
  const MIN_LENGTH = $derived(isCircularMode ? 2 : 1); // Circular: 2, Freeform: 1
  const STEP = $derived(isCircularMode ? 2 : 1); // Circular: 2, Freeform: 1

  function handleIncrement() {
    const newLength = Math.min(currentLength + STEP, MAX_LENGTH);
    onLengthChange(newLength);
  }

  function handleDecrement() {
    const newLength = Math.max(currentLength - STEP, MIN_LENGTH);
    onLengthChange(newLength);
  }

  function formatValue(value: number): string {
    return value.toString();
  }
</script>

<StepperCard
  title="Length"
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

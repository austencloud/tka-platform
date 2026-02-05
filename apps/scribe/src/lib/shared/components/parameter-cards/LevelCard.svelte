<!--
LevelCard.svelte - Unified difficulty level selection card
Uses shared StepperCard for consistent styling with Generate module
-->
<script lang="ts">
  import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
  import {
    type DifficultyLevel,
    DIFFICULTY_LEVELS,
  } from "$lib/shared/domain/models/sequence-parameters";

  let {
    value = null,
    allowNull = true,
    disabled = false,
    gridColumnSpan = 2,
    cardIndex = 0,
    onChange,
  }: {
    value?: DifficultyLevel | null;
    allowNull?: boolean;
    disabled?: boolean;
    gridColumnSpan?: number;
    cardIndex?: number;
    onChange: (level: DifficultyLevel | null) => void;
  } = $props();

  // Convert null to 0 for stepper, 1-3 for actual levels
  const currentValue = $derived(value ?? 0);
  const minValue = $derived(allowNull ? 0 : 1);

  function handleIncrement() {
    if (disabled) return;
    if (value === null) {
      onChange(1);
    } else if (value < 3) {
      onChange((value + 1) as DifficultyLevel);
    } else if (allowNull) {
      onChange(null);
    }
  }

  function handleDecrement() {
    if (disabled) return;
    if (value === null) {
      onChange(3);
    } else if (value > 1) {
      onChange((value - 1) as DifficultyLevel);
    } else if (allowNull) {
      onChange(null);
    }
  }

  function formatValue(val: number): string {
    if (val === 0) return "All";
    return val.toString();
  }

  const currentConfig = $derived(value ? DIFFICULTY_LEVELS[value] : null);
  const color = $derived(
    currentConfig?.gradient ??
      "radial-gradient(ellipse at top left, var(--semantic-info) 0%, var(--semantic-info) 40%, #1d4ed8 100%)"
  );
  const shadowColor = $derived(currentConfig?.shadowColor ?? "220deg 80% 55%");
  const textColor = $derived(currentConfig?.textColor ?? "white");
  const description = $derived(currentConfig?.name ?? "Any difficulty");
</script>

{#if disabled}
  <div
    class="level-card-disabled"
    style="grid-column: span {gridColumnSpan};"
    role="group"
    aria-label="Difficulty level (disabled)"
  >
    <span class="disabled-text">Level: {value ?? "All"}</span>
  </div>
{:else}
  <StepperCard
    title="Level"
    {currentValue}
    {minValue}
    maxValue={3}
    onIncrement={handleIncrement}
    onDecrement={handleDecrement}
    {formatValue}
    {description}
    {color}
    {shadowColor}
    {textColor}
    {gridColumnSpan}
    {cardIndex}
  />
{/if}

<style>
  .level-card-disabled {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 80px;
    padding: 12px;
    border-radius: 16px;
    background: rgba(100, 100, 100, 0.3);
    opacity: 0.5;
  }

  .disabled-text {
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }
</style>

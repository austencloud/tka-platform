<!--
LOOPTypeFilterCard.svelte - Card for filtering by LOOP type (Continuous Assembly Pattern)
Uses shared StepperCard for consistent styling
Options: All → Non-Circular → Circular → specific LOOP types
-->
<script lang="ts">
  import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
  import {
    LOOPType,
    LOOP_TYPE_LABELS,
  } from "$lib/features/create/generate/circular/domain/models/circular-models";

  let {
    currentValue = null,
    onValueChange,
    loopTypeCounts = {} as Record<string, number>,
    gridColumnSpan = 2,
    cardIndex = 0,
  } = $props<{
    currentValue: string | null;
    onValueChange: (value: string | null) => void;
    loopTypeCounts: Record<string, number>;
    gridColumnSpan?: number;
    cardIndex?: number;
  }>();

  // Build ordered list of options with their display info
  interface FilterOption {
    value: string | null;
    label: string;
    count: number;
  }

  const options = $derived.by(() => {
    const opts: FilterOption[] = [];
    const total = loopTypeCounts["_total"] ?? 0;
    const circular = loopTypeCounts["_circular"] ?? 0;
    const nonCircular = loopTypeCounts["_non_circular"] ?? 0;

    // "All Sequences" (no filter)
    opts.push({
      value: null,
      label: "All",
      count: total,
    });

    // "Non-Circular" option (sequences that don't loop)
    if (nonCircular > 0) {
      opts.push({
        value: "non_circular",
        label: "Non-Circular",
        count: nonCircular,
      });
    }

    // Add specific LOOP types (these ARE circular by definition)
    // Sorted by count descending so most popular patterns appear first
    const loopTypes = Object.values(LOOPType)
      .filter((type) => loopTypeCounts[type] && loopTypeCounts[type] > 0)
      .sort((a, b) => {
        const countA = loopTypeCounts[a] ?? 0;
        const countB = loopTypeCounts[b] ?? 0;
        return countB - countA; // Descending by count
      });

    for (const loopType of loopTypes) {
      opts.push({
        value: loopType,
        label: LOOP_TYPE_LABELS[loopType] ?? loopType,
        count: loopTypeCounts[loopType] ?? 0,
      });
    }

    // If there are circular sequences without a specific LOOP type detected,
    // add an "Other Circular" option for them
    const typedCircularCount = loopTypes.reduce(
      (sum, type) => sum + (loopTypeCounts[type] ?? 0),
      0
    );
    const untypedCircularCount = circular - typedCircularCount;

    if (untypedCircularCount > 0) {
      opts.push({
        value: "circular_untyped",
        label: "Other Circular",
        count: untypedCircularCount,
      });
    }

    return opts;
  });

  // Current index in the options array
  const currentIndex = $derived(
    Math.max(
      0,
      options.findIndex((opt) => opt.value === currentValue)
    )
  );

  const currentOption = $derived(options[currentIndex]);

  // Color schemes based on selection
  const colorConfig = $derived.by(() => {
    if (currentValue === null) {
      // All - blue
      return {
        color:
          "radial-gradient(ellipse at top left, var(--semantic-info) 0%, var(--semantic-info) 40%, #1d4ed8 100%)",
        shadowColor: "217deg 91% 60%",
      };
    }
    if (currentValue === "non_circular") {
      // Non-Circular - slate/neutral
      return {
        color:
          "radial-gradient(ellipse at top left, #94a3b8 0%, #64748b 40%, #475569 100%)",
        shadowColor: "215deg 16% 47%",
      };
    }
    if (currentValue === "circular_untyped") {
      // Other Circular (untyped) - teal
      return {
        color:
          "radial-gradient(ellipse at top left, #5eead4 0%, #14b8a6 40%, #0d9488 100%)",
        shadowColor: "173deg 80% 40%",
      };
    }
    // Specific LOOP type - purple (circular patterns)
    return {
      color:
        "radial-gradient(ellipse at top left, #a78bfa 0%, var(--theme-accent-strong) 40%, #6d28d9 100%)",
      shadowColor: "263deg 70% 50%",
    };
  });

  function handleIncrement() {
    const newIndex = currentIndex >= options.length - 1 ? 0 : currentIndex + 1;
    onValueChange(options[newIndex]?.value ?? null);
  }

  function handleDecrement() {
    const newIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
    onValueChange(options[newIndex]?.value ?? null);
  }

  function formatValue(_val: number): string {
    return currentOption?.label ?? "All";
  }

  const description = $derived(
    currentOption?.count !== undefined ? `(${currentOption.count})` : ""
  );
</script>

<StepperCard
  title="Pattern"
  currentValue={currentIndex}
  minValue={0}
  maxValue={options.length - 1}
  onIncrement={handleIncrement}
  onDecrement={handleDecrement}
  {formatValue}
  {description}
  color={colorConfig.color}
  shadowColor={colorConfig.shadowColor}
  textColor="white"
  {gridColumnSpan}
  {cardIndex}
/>

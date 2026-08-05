<!--
  PropOrientationControl.svelte

  Cycles or directly selects a prop orientation. The normal three-part row uses
  PropCycleControl so Location and Orientation share one interaction language.
-->
<script lang="ts">
  import PropCycleControl from "./PropCycleControl.svelte";

  interface Props {
    color: "blue" | "red";
    orientation: string;
    onOrientationChange: (orientation: string) => void;
    /** Enable interradial orientations (Level 6). */
    showInterradial?: boolean;
    /** Restrict the control to the vocabulary allowed by its host. */
    allowedOrientations?: readonly string[];
    compact?: boolean;
    disabled?: boolean;
  }

  let {
    color,
    orientation,
    onOrientationChange,
    showInterradial = false,
    allowedOrientations,
    compact = false,
    disabled = false,
  }: Props = $props();

  let popoverOpen = $state(false);

  interface OrientationOption {
    value: string;
    label: string;
    icon: string;
  }

  const cardinalOptions: OrientationOption[] = [
    { value: "in", label: "In", icon: "fa-arrow-down" },
    { value: "out", label: "Out", icon: "fa-arrow-up" },
    { value: "clock", label: "CW", icon: "fa-rotate-right" },
    { value: "counter", label: "CCW", icon: "fa-rotate-left" },
  ];

  const interradialOptions: OrientationOption[] = [
    { value: "clockIn", label: "CW·In", icon: "fa-arrow-down-long" },
    { value: "clockOut", label: "CW·Out", icon: "fa-arrow-up-long" },
    { value: "counterIn", label: "CCW·In", icon: "fa-arrow-down-long" },
    { value: "counterOut", label: "CCW·Out", icon: "fa-arrow-up-long" },
  ];

  const allOrientationOptions = $derived(
    showInterradial
      ? [...cardinalOptions, ...interradialOptions]
      : cardinalOptions
  );
  const orientationOptions = $derived(
    allowedOrientations
      ? allOrientationOptions.filter((option) =>
          allowedOrientations.includes(option.value)
        )
      : allOrientationOptions
  );
  const visibleCardinalOptions = $derived(
    cardinalOptions.filter((option) =>
      orientationOptions.some((available) => available.value === option.value)
    )
  );
  const visibleInterradialOptions = $derived(
    interradialOptions.filter((option) =>
      orientationOptions.some((available) => available.value === option.value)
    )
  );

  const defaultOption: OrientationOption = {
    value: "in",
    label: "In",
    icon: "fa-arrow-down",
  };

  const currentOption = $derived(
    orientationOptions.find((option) => option.value === orientation) ??
      defaultOption
  );

  const cardinalCycleOrder = ["in", "counter", "out", "clock"];
  const fullCycleOrder = [
    "in",
    "clockIn",
    "clock",
    "clockOut",
    "out",
    "counterOut",
    "counter",
    "counterIn",
  ];

  $effect(() => {
    if (disabled) popoverOpen = false;
  });

  function cycleOrientation(direction: "prev" | "next"): string {
    const fullOrder = showInterradial ? fullCycleOrder : cardinalCycleOrder;
    const order = fullOrder.filter((value) =>
      orientationOptions.some((option) => option.value === value)
    );
    if (order.length === 0) return orientation;

    const currentIndex = Math.max(0, order.indexOf(orientation));
    const offset = direction === "next" ? 1 : -1;
    return order[(currentIndex + offset + order.length) % order.length]!;
  }

  function selectOrientation(event: MouseEvent, value: string) {
    event.stopPropagation();
    onOrientationChange(value);
    popoverOpen = false;
  }
</script>

<div class="orientation-control" class:compact>
  {#if !popoverOpen}
    <PropCycleControl
      valueLabel={currentOption.label}
      iconClass={currentOption.icon}
      previousLabel="Previous {color} orientation"
      nextLabel="Next {color} orientation"
      selectLabel="Select {color} orientation"
      {compact}
      {disabled}
      onPrevious={() => onOrientationChange(cycleOrientation("prev"))}
      onNext={() => onOrientationChange(cycleOrientation("next"))}
      onSelect={() => (popoverOpen = true)}
    />
  {:else}
    <div
      class="options-grid"
      class:expanded={visibleInterradialOptions.length > 0}
    >
      {#each visibleCardinalOptions as option}
        <button
          type="button"
          class="option-button"
          class:active={orientation === option.value}
          aria-label="Set {color} orientation to {option.label}"
          onclick={(event) => selectOrientation(event, option.value)}
        >
          <i class="fas {option.icon}" aria-hidden="true"></i>
          <span>{option.label}</span>
        </button>
      {/each}
      {#each visibleInterradialOptions as option}
        <button
          type="button"
          class="option-button interradial"
          class:active={orientation === option.value}
          aria-label="Set {color} orientation to {option.label}"
          onclick={(event) => selectOrientation(event, option.value)}
        >
          <i class="fas {option.icon}" aria-hidden="true"></i>
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .orientation-control {
    width: 100%;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
    animation: options-fade-in var(--duration-fast) ease;
  }

  .orientation-control.compact .options-grid {
    gap: 6px;
  }

  .options-grid.expanded {
    grid-template-columns: repeat(4, 1fr);
  }

  .option-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-height: var(--min-touch-target, 44px);
    padding: 8px;
    border: 1px solid rgba(var(--prop-color-rgb, 59, 130, 246), 0.35);
    border-radius: 10px;
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.14);
    color: color-mix(in srgb, var(--prop-color, #60a5fa) 64%, white);
    cursor: pointer;
    transition:
      background var(--duration-fast) ease,
      border-color var(--duration-fast) ease,
      color var(--duration-fast) ease,
      transform var(--duration-fast) ease;
  }

  .option-button:hover {
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.28);
    color: var(--theme-text, #fff);
  }

  .option-button.active {
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.7);
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.34);
    color: var(--theme-text, #fff);
  }

  .option-button:active {
    transform: scale(0.96);
  }

  .option-button:focus-visible {
    outline: 2px solid var(--theme-accent, #8b6cff);
    outline-offset: 2px;
  }

  .option-button.interradial {
    border-style: dashed;
  }

  .option-button i {
    font-size: 1rem;
  }

  .option-button span {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @keyframes options-fade-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .options-grid {
      animation: none;
    }

    .option-button {
      transition: none;
    }

    .option-button:active {
      transform: none;
    }
  }
</style>

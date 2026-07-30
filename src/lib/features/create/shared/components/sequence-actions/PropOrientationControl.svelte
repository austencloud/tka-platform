<!--
  PropOrientationControl.svelte

  Internal controls for adjusting orientation of a single prop.
  Designed to be used inside PropControlPair which provides the card styling.
  Uses CSS custom properties from parent card for color theming.
-->
<script lang="ts">
  interface Props {
    color: "blue" | "red";
    orientation: string;
    onOrientationChange: (orientation: string) => void;
    /** Enable interradial orientations (Level 6) */
    showInterradial?: boolean;
    /** Restrict the control to the vocabulary allowed by its host. */
    allowedOrientations?: readonly string[];
    compact?: boolean;
  }

  let {
    color,
    orientation,
    onOrientationChange,
    showInterradial = false,
    allowedOrientations,
    compact = false,
  }: Props = $props();

  // Popover state for this prop
  let popoverOpen = $state(false);

  interface OrientationOpt {
    value: string;
    label: string;
    icon: string;
  }

  const cardinalOptions: OrientationOpt[] = [
    { value: "in", label: "In", icon: "fa-arrow-down" },
    { value: "out", label: "Out", icon: "fa-arrow-up" },
    { value: "clock", label: "CW", icon: "fa-rotate-right" },
    { value: "counter", label: "CCW", icon: "fa-rotate-left" },
  ];

  const interradialOptions: OrientationOpt[] = [
    { value: "clockIn", label: "CW·In", icon: "fa-arrow-down-long" },
    { value: "clockOut", label: "CW·Out", icon: "fa-arrow-up-long" },
    { value: "counterIn", label: "CCW·In", icon: "fa-arrow-down-long" },
    { value: "counterOut", label: "CCW·Out", icon: "fa-arrow-up-long" },
  ];

  const allOrientationOptions = $derived(
    showInterradial ? [...cardinalOptions, ...interradialOptions] : cardinalOptions
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

  const defaultOption: OrientationOpt = { value: "in", label: "In", icon: "fa-arrow-down" };

  const getOrientationOption = (value: string): OrientationOpt => {
    return (
      orientationOptions.find((opt) => opt.value === value) ??
      defaultOption
    );
  };

  // Cycle order follows the 8-point radial cycle
  const cardinalCycleOrder: string[] = ["in", "counter", "out", "clock"];
  const fullCycleOrder: string[] = [
    "in", "clockIn", "clock", "clockOut",
    "out", "counterOut", "counter", "counterIn",
  ];

  function cycleOrientation(direction: "prev" | "next"): string {
    const fullOrder = showInterradial ? fullCycleOrder : cardinalCycleOrder;
    const order = fullOrder.filter((value) =>
      orientationOptions.some((option) => option.value === value)
    );
    if (order.length === 0) return orientation;

    const currentIndex = Math.max(0, order.indexOf(orientation));
    const len = order.length;
    if (direction === "next") {
      return order[(currentIndex + 1) % len]!;
    } else {
      return order[(currentIndex - 1 + len) % len]!;
    }
  }

  function handleOrientationClick(e: MouseEvent, value: string) {
    e.stopPropagation();
    onOrientationChange(value);
    popoverOpen = false;
  }

  function handleCycle(e: MouseEvent, direction: "prev" | "next") {
    e.stopPropagation();
    onOrientationChange(cycleOrientation(direction));
  }

  function togglePopover(e: MouseEvent) {
    e.stopPropagation();
    popoverOpen = !popoverOpen;
  }
</script>

<div
  class="orientation-controls"
  class:blue={color === "blue"}
  class:red={color === "red"}
  class:compact
>
  {#if !popoverOpen}
    <!-- Normal view: toggle controls -->
    <div class="toggle-row">
      <button
        class="arrow-btn"
        onclick={(e) => handleCycle(e, "prev")}
        aria-label="Previous {color} orientation"
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>

      <button
        class="orientation-display"
        onclick={togglePopover}
        aria-label="Select {color} orientation"
      >
        <i
          class="fas {getOrientationOption(orientation).icon}"
          aria-hidden="true"
        ></i>
        <span class="display-label"
          >{getOrientationOption(orientation).label}</span
        >
      </button>

      <button
        class="arrow-btn"
        onclick={(e) => handleCycle(e, "next")}
        aria-label="Next {color} orientation"
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
  {:else}
    <!-- Popover view: grid of orientation options -->
    <div
      class="options-grid"
      class:expanded={visibleInterradialOptions.length > 0}
    >
      {#each visibleCardinalOptions as opt}
        <button
          class="option-btn"
          class:active={orientation === opt.value}
          onclick={(e) => handleOrientationClick(e, opt.value)}
          aria-label="Set {color} orientation to {opt.label}"
        >
          <i class="fas {opt.icon}" aria-hidden="true"></i>
          <span>{opt.label}</span>
        </button>
      {/each}
      {#if visibleInterradialOptions.length > 0}
        {#each visibleInterradialOptions as opt}
          <button
            class="option-btn interradial"
            class:active={orientation === opt.value}
            onclick={(e) => handleOrientationClick(e, opt.value)}
            aria-label="Set {color} orientation to {opt.label}"
          >
            <i class="fas {opt.icon}" aria-hidden="true"></i>
            <span>{opt.label}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .orientation-controls {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  /* ============================================================================
     TOGGLE ROW - Arrow buttons and center display (normal state)
     ============================================================================ */

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
  }

  .orientation-controls.compact .toggle-row {
    gap: 6px;
  }

  .arrow-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 10px;
    border: 1px solid;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    flex-shrink: 0;
  }

  .arrow-btn i {
    font-size: 1rem;
  }

  .arrow-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .orientation-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: var(--min-touch-target);
    min-width: 100px;
    max-width: 140px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .orientation-controls.compact .orientation-display {
    min-width: 76px;
    max-width: 96px;
    padding-inline: 8px;
  }

  .orientation-display i {
    font-size: 1.25rem;
  }

  .display-label {
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .orientation-display:active:not(:disabled) {
    transform: scale(0.98);
  }

  /* ============================================================================
     OPTIONS GRID - 2x2 grid of orientation buttons (popover state)
     ============================================================================ */

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: 100%;
    animation: options-fade-in var(--duration-fast) ease;
  }

  @keyframes options-fade-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .option-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px;
    border-radius: 10px;
    border: 1px solid;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .option-btn i {
    font-size: 1.1rem;
  }

  .option-btn span {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .option-btn:active:not(:disabled) {
    transform: scale(0.95);
  }

  .option-btn.interradial {
    border-style: dashed;
  }

  .options-grid.expanded {
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }

  /* ============================================================================
     COLOR THEMES - Uses CSS custom properties from PropControlPair
     ============================================================================ */

  /* Blue theme */
  .orientation-controls.blue .arrow-btn {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.2);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.4);
    color: var(--prop-color, var(--semantic-info));
  }

  .orientation-controls.blue .arrow-btn:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
  }

  .orientation-controls.blue .orientation-display {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.15);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.9);
  }

  .orientation-controls.blue .orientation-display:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.5);
    color: var(--prop-color, var(--semantic-info));
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 59, 130, 246), 0.2);
  }

  .orientation-controls.blue .option-btn {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.15);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.7);
  }

  .orientation-controls.blue .option-btn:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.5);
    color: var(--prop-color, var(--semantic-info));
  }

  .orientation-controls.blue .option-btn.active {
    background: rgba(var(--prop-color-rgb, 59, 130, 246), 0.3);
    border-color: rgba(var(--prop-color-rgb, 59, 130, 246), 0.6);
    color: var(--prop-color, var(--semantic-info));
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 59, 130, 246), 0.25);
  }

  /* Red theme */
  .orientation-controls.red .arrow-btn {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.2);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.4);
    color: var(--prop-color, var(--semantic-error));
  }

  .orientation-controls.red .arrow-btn:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.6);
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
  }

  .orientation-controls.red .orientation-display {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.15);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.9);
  }

  .orientation-controls.red .orientation-display:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.5);
    color: var(--prop-color, var(--semantic-error));
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 239, 68, 68), 0.2);
  }

  .orientation-controls.red .option-btn {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.15);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.7);
  }

  .orientation-controls.red .option-btn:hover:not(:disabled) {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.5);
    color: var(--prop-color, var(--semantic-error));
  }

  .orientation-controls.red .option-btn.active {
    background: rgba(var(--prop-color-rgb, 239, 68, 68), 0.3);
    border-color: rgba(var(--prop-color-rgb, 239, 68, 68), 0.6);
    color: var(--prop-color, var(--semantic-error));
    box-shadow: 0 2px 8px rgba(var(--prop-color-rgb, 239, 68, 68), 0.25);
  }

  @media (prefers-reduced-motion: reduce) {
    .arrow-btn,
    .orientation-display,
    .option-btn {
      transition: none;
    }
    .arrow-btn:active:not(:disabled),
    .orientation-display:active:not(:disabled),
    .option-btn:active:not(:disabled) {
      transform: none;
    }
    .options-grid {
      animation: none;
    }
  }
</style>

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
  }

  let { color, orientation, onOrientationChange }: Props = $props();

  // Popover state for this prop
  let popoverOpen = $state(false);

  const orientationOptions = [
    { value: "in", label: "In", icon: "fa-arrow-down" },
    { value: "out", label: "Out", icon: "fa-arrow-up" },
    { value: "clock", label: "CW", icon: "fa-rotate-right" },
    { value: "counter", label: "CCW", icon: "fa-rotate-left" },
  ] as const;

  const getOrientationOption = (value: string) => {
    return (
      orientationOptions.find((opt) => opt.value === value) ??
      orientationOptions[0]
    );
  };

  function cycleOrientation(direction: "prev" | "next"): string {
    const order = ["in", "counter", "out", "clock"] as const;
    const currentIndex = Math.max(
      0,
      order.indexOf(orientation as (typeof order)[number])
    );
    if (direction === "next") {
      return order[(currentIndex + 1) % 4]!;
    } else {
      return order[(currentIndex - 1 + 4) % 4]!;
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
    <!-- Popover view: 2x2 grid of options -->
    <div class="options-grid">
      {#each orientationOptions as opt}
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
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .option-btn:active:not(:disabled) {
    transform: scale(0.95);
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

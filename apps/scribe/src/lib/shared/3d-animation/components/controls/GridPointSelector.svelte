<script lang="ts">
  /**
   * GridPointSelector - Visual tap-to-select grid point picker
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   *
   * Shows a mini grid diagram where users tap to select locations.
   * Works on both mobile and desktop.
   */

  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  interface Props {
    /** Currently selected location */
    value: GridLocation;
    /** Callback when selection changes */
    onchange: (location: GridLocation) => void;
    /** Label for the selector */
    label?: string;
    /** Prop color for accent */
    color?: "blue" | "red";
  }

  let { value, onchange, label = "", color = "blue" }: Props = $props();

  // Grid point positions (relative to 100x100 viewbox)
  const points: Array<{
    loc: GridLocation;
    x: number;
    y: number;
    label: string;
  }> = [
    { loc: GridLocation.NORTH, x: 50, y: 10, label: "N" },
    { loc: GridLocation.NORTHEAST, x: 85, y: 15, label: "NE" },
    { loc: GridLocation.EAST, x: 90, y: 50, label: "E" },
    { loc: GridLocation.SOUTHEAST, x: 85, y: 85, label: "SE" },
    { loc: GridLocation.SOUTH, x: 50, y: 90, label: "S" },
    { loc: GridLocation.SOUTHWEST, x: 15, y: 85, label: "SW" },
    { loc: GridLocation.WEST, x: 10, y: 50, label: "W" },
    { loc: GridLocation.NORTHWEST, x: 15, y: 15, label: "NW" },
  ];

  function handleClick(loc: GridLocation) {
    onchange(loc);
  }
</script>

<div
  class="grid-selector"
  class:blue={color === "blue"}
  class:red={color === "red"}
>
  {#if label}
    <span class="label">{label}</span>
  {/if}

  <svg viewBox="0 0 100 100" class="grid-svg">
    <!-- Grid circle -->
    <circle cx="50" cy="50" r="38" class="grid-circle" />

    <!-- Center point -->
    <circle cx="50" cy="50" r="3" class="center-dot" />

    <!-- Grid points -->
    {#each points as point}
      <g
        class="point-group"
        class:selected={value === point.loc}
        onclick={() => handleClick(point.loc)}
        onkeydown={(e) => e.key === "Enter" && handleClick(point.loc)}
        tabindex="0"
        role="button"
        aria-label="Select {point.label}"
      >
        <circle cx={point.x} cy={point.y} r="20" class="point-hitarea" />
        <circle
          cx={point.x}
          cy={point.y}
          r={value === point.loc ? "9" : "6"}
          class="point-dot"
        />
        <text x={point.x} y={point.y} class="point-label">{point.label}</text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .grid-selector {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .label {
    font-size: var(--font-size-compact, 0.75rem);
    text-transform: uppercase;
    color: var(--theme-text-dim);
    letter-spacing: 0.05em;
  }

  .grid-svg {
    width: 110px;
    height: 110px;
    cursor: pointer;
  }

  /* 20 units hitarea in 100-unit viewbox at 110px = 22px radius = 44px diameter touch target */

  .grid-circle {
    fill: none;
    stroke: var(--theme-stroke);
    stroke-width: 1;
  }

  .center-dot {
    fill: var(--theme-text-dim);
  }

  .point-group {
    cursor: pointer;
    outline: none;
  }

  .blue .point-group:focus .point-dot {
    stroke: var(--prop-blue);
    stroke-width: 2;
  }

  .red .point-group:focus .point-dot {
    stroke: var(--prop-red);
    stroke-width: 2;
  }

  .point-hitarea {
    fill: transparent;
  }

  .point-dot {
    fill: var(--theme-text-dim);
    transition: all var(--duration-fast) ease;
  }

  .point-group:hover .point-dot {
    fill: var(--theme-text);
  }

  .blue .point-group.selected .point-dot {
    fill: var(--prop-blue);
  }

  .red .point-group.selected .point-dot {
    fill: var(--prop-red);
  }

  .point-label {
    font-size: var(--font-size-compact);
    fill: var(--theme-text);
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
    opacity: 0;
  }

  .point-group:hover .point-label,
  .point-group.selected .point-label {
    opacity: 1;
  }
</style>

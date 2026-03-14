<!--
  BuilderGrid.svelte - SVG tappable grid for the Hand Path Builder

  Renders the active grid points (based on grid mode) as tappable circles.
  Shows the current hand's selected path as numbered dots connected by lines.
  Hit targets are 44px+ for touch accessibility.

  SVG coordinate system uses a 400×400 viewBox.
  Locations are placed at anatomically correct positions around the grid.
-->
<script lang="ts">
  import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getBuilderContext } from "../context/builder-context";

  const builder = getBuilderContext();

  // SVG coordinate map. 400×400 viewBox, center at 200,200.
  const GRID_COORDS: Record<GridLocation, { x: number; y: number }> = {
    [GridLocation.NORTH]:     { x: 200, y: 40 },
    [GridLocation.NORTHEAST]: { x: 340, y: 60 },
    [GridLocation.EAST]:      { x: 360, y: 200 },
    [GridLocation.SOUTHEAST]: { x: 340, y: 340 },
    [GridLocation.SOUTH]:     { x: 200, y: 360 },
    [GridLocation.SOUTHWEST]: { x: 60,  y: 340 },
    [GridLocation.WEST]:      { x: 40,  y: 200 },
    [GridLocation.NORTHWEST]: { x: 60,  y: 60 },
    [GridLocation.CENTER]:    { x: 200, y: 200 },
  };

  // Min touch target radius per WCAG (22px radius = 44px diameter)
  const HIT_RADIUS = 26;
  // Visual dot radius for selected locations
  const DOT_RADIUS = 12;

  const blueColor = "var(--prop-blue, #2e8bf0)";
  const redColor = "var(--prop-red, #ed1c24)";

  // Lines connecting selected locations for blue and red paths
  const blueLines = $derived(buildLines(builder.blueLocations));
  const redLines = $derived(buildLines(builder.redLocations));

  function buildLines(
    locations: readonly GridLocation[]
  ): Array<{ x1: number; y1: number; x2: number; y2: number }> {
    const lines = [];
    for (let i = 0; i < locations.length - 1; i++) {
      const a = GRID_COORDS[locations[i]!]!;
      const b = GRID_COORDS[locations[i + 1]!]!;
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return lines;
  }

  function handleTap(loc: GridLocation): void {
    builder.addLocation(loc);
  }

  function getLabel(loc: GridLocation): string {
    const phaseLabel = builder.phase === "blue" ? "Blue" : "Red";
    return `Add ${loc} to ${phaseLabel} hand path`;
  }

  // Grid lines for the visual background (diamond cross and circle)
  const GRID_LINE_COLOR = "rgba(255,255,255,0.12)";
  const CIRCLE_R = 160;
</script>

<div
  class="builder-grid"
  role="application"
  aria-label="Hand path builder grid"
>
  <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <!-- Background -->
    <defs>
      <radialGradient id="hpb-bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgb(22,28,46)" />
        <stop offset="100%" stop-color="rgb(10,12,22)" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="400" height="400" fill="url(#hpb-bg)" />

    <!-- Grid structure lines -->
    <!-- Horizontal -->
    <line x1="40" y1="200" x2="360" y2="200" stroke={GRID_LINE_COLOR} stroke-width="1" />
    <!-- Vertical -->
    <line x1="200" y1="40" x2="200" y2="360" stroke={GRID_LINE_COLOR} stroke-width="1" />
    <!-- Circle -->
    <circle cx="200" cy="200" r={CIRCLE_R} fill="none" stroke={GRID_LINE_COLOR} stroke-width="1" />
    <!-- Diagonal lines (only in skewed mode) -->
    {#if builder.gridMode === GridMode.SKEWED}
      <line x1="60" y1="60" x2="340" y2="340" stroke={GRID_LINE_COLOR} stroke-width="1" />
      <line x1="340" y1="60" x2="60" y2="340" stroke={GRID_LINE_COLOR} stroke-width="1" />
    {/if}

    <!-- ── Path lines ── -->

    <!-- Blue path lines (always rendered once blue has 2+ locations) -->
    {#each blueLines as line}
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke={blueColor}
        stroke-width="2.5"
        stroke-linecap="round"
        opacity="0.7"
      />
    {/each}

    <!-- Red path lines -->
    {#each redLines as line}
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke={redColor}
        stroke-width="2.5"
        stroke-linecap="round"
        opacity="0.7"
      />
    {/each}

    <!-- ── Selected dots ── -->

    <!-- Blue dots -->
    {#each builder.blueLocations as loc, i (loc + "-blue-" + i)}
      {@const coord = GRID_COORDS[loc]!}
      {@const isLast = i === builder.blueLocations.length - 1 && builder.phase === "blue"}
      <circle
        cx={coord.x}
        cy={coord.y}
        r={DOT_RADIUS}
        fill={blueColor}
        opacity={isLast ? "1" : "0.75"}
        class:pulse={isLast}
      />
      <!-- Step number label -->
      <text
        x={coord.x}
        y={coord.y + 4}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="10"
        font-weight="700"
        fill="white"
        pointer-events="none"
      >{i + 1}</text>
    {/each}

    <!-- Red dots -->
    {#each builder.redLocations as loc, i (loc + "-red-" + i)}
      {@const coord = GRID_COORDS[loc]!}
      {@const isLast = i === builder.redLocations.length - 1 && builder.phase === "red"}
      <circle
        cx={coord.x}
        cy={coord.y}
        r={DOT_RADIUS}
        fill={redColor}
        opacity={isLast ? "1" : "0.75"}
        class:pulse={isLast}
      />
      <text
        x={coord.x}
        y={coord.y + 4}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="10"
        font-weight="700"
        fill="white"
        pointer-events="none"
      >{i + 1}</text>
    {/each}

    <!-- ── Hit targets ── (always on top for click capture) -->
    {#if builder.phase !== "complete"}
      {#each builder.availableLocations as loc (loc)}
        {@const coord = GRID_COORDS[loc]!}
        {@const isSelected = builder.lastLocation === loc}
        <circle
          cx={coord.x}
          cy={coord.y}
          r={HIT_RADIUS}
          class="hit-target"
          class:is-selected={isSelected}
          class:phase-blue={builder.phase === "blue"}
          class:phase-red={builder.phase === "red"}
          role="button"
          tabindex="0"
          aria-label={getLabel(loc)}
          onclick={() => handleTap(loc)}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleTap(loc);
            }
          }}
        />
      {/each}
    {/if}

    <!-- Complete state: show both paths dimmed, no hit targets -->
    {#if builder.phase === "complete"}
      <text
        x="200"
        y="200"
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="14"
        fill="rgba(255,255,255,0.45)"
      >Paths complete</text>
    {/if}
  </svg>
</div>

<style>
  .builder-grid {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 20px;
    overflow: hidden;
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .builder-grid svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Hit targets */
  .hit-target {
    fill: rgba(255, 255, 255, 0.04);
    stroke: rgba(255, 255, 255, 0.25);
    stroke-width: 2;
    cursor: pointer;
    transition: fill 0.14s ease, stroke 0.14s ease, stroke-width 0.14s ease;
  }

  /* Phase-colored pulse on available targets */
  .hit-target.phase-blue:not(.is-selected) {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 8%, transparent);
    stroke: color-mix(in srgb, var(--prop-blue, #2e8bf0) 50%, transparent);
    animation: pulse-blue 1.8s ease-in-out infinite;
  }

  .hit-target.phase-red:not(.is-selected) {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 8%, transparent);
    stroke: color-mix(in srgb, var(--prop-red, #ed1c24) 50%, transparent);
    animation: pulse-red 1.8s ease-in-out infinite;
  }

  /* Current (most-recently-tapped) position indicator */
  .hit-target.is-selected.phase-blue {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 22%, transparent);
    stroke: var(--prop-blue, #2e8bf0);
    stroke-width: 3;
    animation: none;
  }

  .hit-target.is-selected.phase-red {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 22%, transparent);
    stroke: var(--prop-red, #ed1c24);
    stroke-width: 3;
    animation: none;
  }

  .hit-target:hover:not(.is-selected) {
    stroke-width: 3;
  }

  .hit-target.phase-blue:hover:not(.is-selected) {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 20%, transparent);
    stroke: var(--prop-blue, #2e8bf0);
  }

  .hit-target.phase-red:hover:not(.is-selected) {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 20%, transparent);
    stroke: var(--prop-red, #ed1c24);
  }

  .hit-target:focus-visible {
    outline: none;
    stroke-width: 4;
    stroke: var(--theme-accent, #3b82f6);
  }

  /* Pulse animations */
  @keyframes pulse-blue {
    0%   { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
    50%  { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 18%, transparent); stroke-opacity: 0.90; stroke-width: 3; }
    100% { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
  }

  @keyframes pulse-red {
    0%   { fill: color-mix(in srgb, var(--prop-red, #ed1c24)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
    50%  { fill: color-mix(in srgb, var(--prop-red, #ed1c24) 18%, transparent); stroke-opacity: 0.90; stroke-width: 3; }
    100% { fill: color-mix(in srgb, var(--prop-red, #ed1c24)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
  }

  /* Dot pulse for last placed location */
  :global(.pulse) {
    animation: dot-pulse 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes dot-pulse {
    from { r: 6; opacity: 0; }
    to   { r: 12; opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hit-target.phase-blue,
    .hit-target.phase-red {
      animation: none;
    }
  }

  @media (max-width: 768px) {
    .builder-grid {
      border-radius: 16px;
    }
  }
</style>

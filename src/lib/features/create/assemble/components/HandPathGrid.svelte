<!--
HandPathGrid.svelte - 3x3 grid for hand path position selection

Displays a 3x3 grid of position buttons arranged as:
  NW  N  NE
  W   C   E
  SW  S  SE

Positions are enabled/disabled based on grid mode:
- Diamond mode: N, E, S, W enabled
- Box mode: NE, SE, SW, NW enabled
- Center (C) is always disabled for now (future feature)

The hand overlay shows the current position and animates between positions.
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import GridPositionButton from "./GridPositionButton.svelte";

  const {
    gridMode,
    currentPosition,
    handColor = "blue",
    isSelectingStartPosition = false,
    showEntranceAnimation = false,
    onPositionSelect,
  } = $props<{
    gridMode: GridMode;
    currentPosition: GridLocation | null;
    handColor?: "blue" | "red";
    isSelectingStartPosition?: boolean;
    showEntranceAnimation?: boolean;
    onPositionSelect: (position: GridLocation) => void;
  }>();

  // Track color transitions for animation
  let previousColor = $state<"blue" | "red">("blue");
  let isTransitioning = $state(false);

  // Track hovered position for floating ghost hand
  let hoveredPosition = $state<GridLocation | null>(null);

  // Detect color changes and trigger transition animation
  $effect(() => {
    if (handColor !== previousColor) {
      isTransitioning = true;
      // Animation duration matches CSS (500ms)
      setTimeout(() => {
        isTransitioning = false;
      }, 500);
      previousColor = handColor;
    }
  });

  // Handle position selection
  function handlePositionSelect(position: GridLocation) {
    onPositionSelect(position);
  }

  // Handle hover for floating ghost
  function handlePositionHover(position: GridLocation | null) {
    hoveredPosition = position;
  }

  // Get ghost hand position (follows hover, or null if nothing hovered)
  const ghostPosition = $derived.by(() => {
    if (!isSelectingStartPosition || !hoveredPosition) return null;
    const coords = positionToGridCoords[hoveredPosition as GridLocation];
    if (!coords) return null;
    return { row: coords.row, col: coords.col };
  });

  /**
   * Map GridLocation to grid position (row, col) for positioning the hand overlay
   * Grid is 3x3:
   *   NW(0,0)  N(0,1)  NE(0,2)
   *   W(1,0)   C(1,1)  E(1,2)
   *   SW(2,0)  S(2,1)  SE(2,2)
   */
  const positionToGridCoords: Record<
    GridLocation,
    { row: number; col: number }
  > = {
    [GridLocation.NORTHWEST]: { row: 0, col: 0 },
    [GridLocation.NORTH]: { row: 0, col: 1 },
    [GridLocation.NORTHEAST]: { row: 0, col: 2 },
    [GridLocation.WEST]: { row: 1, col: 0 },
    [GridLocation.EAST]: { row: 1, col: 2 },
    [GridLocation.SOUTHWEST]: { row: 2, col: 0 },
    [GridLocation.SOUTH]: { row: 2, col: 1 },
    [GridLocation.SOUTHEAST]: { row: 2, col: 2 },
  };

  // Get the CSS position for the hand overlay based on current position
  const handPosition = $derived.by(() => {
    if (!currentPosition) return null;
    // Type assertion needed because TypeScript can't narrow GridLocation | null properly
    const coords = positionToGridCoords[currentPosition as GridLocation];
    if (!coords) return null;

    // Calculate percentage position (each cell is 33.33% of the grid)
    // Add gap compensation: 12px gap on desktop, 8px on mobile
    // For simplicity, we'll use CSS calc with grid position
    return {
      row: coords.row,
      col: coords.col,
    };
  });

  // 3x3 grid layout (row by row, left to right)
  const gridLayout: (GridLocation | null)[][] = [
    [GridLocation.NORTHWEST, GridLocation.NORTH, GridLocation.NORTHEAST],
    [GridLocation.WEST, null, GridLocation.EAST], // null = center (disabled for now)
    [GridLocation.SOUTHWEST, GridLocation.SOUTH, GridLocation.SOUTHEAST],
  ];

  /**
   * Check if a position is enabled based on grid mode
   */
  function isPositionEnabled(position: GridLocation | null): boolean {
    if (position === null) {
      return false; // Center is disabled for now
    }

    const cardinalPositions = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ];

    const intercardinalPositions = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    if (gridMode === GridMode.DIAMOND) {
      return cardinalPositions.includes(position);
    } else if (gridMode === GridMode.BOX) {
      return intercardinalPositions.includes(position);
    }

    return false;
  }

  /**
   * Clockwise entrance order for staggered animation
   * Draws the user's eye around the grid naturally
   */
  const entranceOrder: Record<GridMode, GridLocation[]> = {
    [GridMode.DIAMOND]: [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ],
    [GridMode.BOX]: [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ],
    [GridMode.SKEWED]: [], // Not used in hand path assembly
  };

  /**
   * Calculate entrance delay for staggered animation
   * Returns 0 if animation is disabled or position is not enabled
   */
  function getEntranceDelay(position: GridLocation): number {
    if (!showEntranceAnimation) return 0;
    if (!isPositionEnabled(position)) return 0;

    const order = entranceOrder[gridMode as GridMode] || [];
    const index = order.indexOf(position);
    if (index === -1) return 0;

    // Initial delay lets the page transition settle before buttons start appearing
    // Then rhythmic stagger: each position pops in sequence with musical timing
    const initialDelay = 150;
    const staggerInterval = 100;
    return initialDelay + index * staggerInterval;
  }

  // Measure container dimensions to create a square grid
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  // Calculate the size for the square grid (smaller of width/height)
  let gridSize = $derived(
    containerWidth > 0 && containerHeight > 0
      ? Math.min(containerWidth, containerHeight)
      : 0
  );
</script>

<div
  class="hand-path-grid-container"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
>
  {#if gridSize > 0}
    <div
      class="hand-path-grid"
      style:width="{gridSize}px"
      style:height="{gridSize}px"
    >
      {#each gridLayout as row}
        {#each row as position}
          {#if position !== null}
            <GridPositionButton
              {position}
              enabled={isPositionEnabled(position)}
              isCurrent={currentPosition === position}
              isSelectingStart={isSelectingStartPosition}
              entranceDelay={getEntranceDelay(position)}
              onSelect={handlePositionSelect}
              onHover={handlePositionHover}
            />
          {:else}
            <!-- Center position (disabled) -->
            <div class="center-placeholder">
              <span class="center-label">○</span>
            </div>
          {/if}
        {/each}
      {/each}

      <!-- Floating ghost hand (follows hover during start position selection) -->
      {#if ghostPosition}
        <div
          class="ghost-overlay"
          class:blue={handColor === "blue"}
          class:red={handColor === "red"}
          style:--ghost-row={ghostPosition.row}
          style:--ghost-col={ghostPosition.col}
        >
          <svg
            class="ghost-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 75 100"
          >
            <path
              d="M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z"
            />
          </svg>
        </div>
      {/if}

      <!-- Animated hand overlay (shows after position is selected) -->
      {#if handPosition}
        <div
          class="hand-overlay"
          class:blue={handColor === "blue"}
          class:red={handColor === "red"}
          class:transitioning={isTransitioning}
          style:--hand-row={handPosition.row}
          style:--hand-col={handPosition.col}
        >
          <!-- Inline SVG with CSS variable for animatable fill -->
          <svg
            class="hand-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 75 100"
          >
            <path
              class="hand-path"
              d="M11.17 44.59h3.37V12.7a5.61 5.61 0 1 1 11.2-.01v31.9h3.32V5.72A5.5 5.5 0 0 1 34.66 0a5.55 5.55 0 0 1 5.58 5.77v38.81h3.32V13.56c0-2.99 1.95-5.19 4.97-5.64 3.08-.45 6.18 2.1 6.19 5.15q.02 5.73 0 11.46v38.13c0 .79.16 1.47.94 1.87.85.44 1.73.15 2.27-.77l6.41-10.87c1.64-2.79 4.42-3.73 7.43-2.48 3.04 1.26 4.15 4.73 2.41 7.7L65.3 73.19c-2.17 3.68-4.29 7.4-6.55 11.03a18 18 0 0 1-2.81 3.27 46 46 0 0 1-14.76 9.87c-5.01 2.03-10.23 3.03-15.63 2.51-9.85-.94-17.1-5.78-21.71-14.35A32 32 0 0 1 .26 73a76 76 0 0 1-.25-6.23L0 25.08a5.6 5.6 0 0 1 5.74-5.7 5.5 5.5 0 0 1 5.42 5.41z"
            />
          </svg>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .hand-path-grid-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hand-path-grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 12px;
    /* Width and height are set dynamically via inline styles */
  }

  /* Floating ghost overlay (follows hover during start position selection) */
  .ghost-overlay {
    position: absolute;
    pointer-events: none;
    z-index: 5;

    --cell-size: calc((100% - 24px) / 3);
    --gap: 12px;

    width: var(--cell-size);
    height: var(--cell-size);

    left: calc(var(--ghost-col) * (var(--cell-size) + var(--gap)));
    top: calc(var(--ghost-row) * (var(--cell-size) + var(--gap)));

    /* Quick, responsive following */
    transition:
      left 0.15s ease-out,
      top 0.15s ease-out,
      opacity 0.2s ease;

    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.6;
  }

  .ghost-icon {
    width: 50%;
    height: 50%;
    animation: ghost-breathe 2s ease-in-out infinite;
  }

  @keyframes ghost-breathe {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.08); opacity: 1; }
  }

  .ghost-overlay.blue .ghost-icon {
    fill: #3b82f6;
    filter: drop-shadow(0 2px 12px rgba(59, 130, 246, 0.5));
  }

  .ghost-overlay.red .ghost-icon {
    fill: #ef4444;
    filter: drop-shadow(0 2px 12px rgba(239, 68, 68, 0.5));
    /* Mirror for right hand */
    transform: scaleX(-1);
  }

  /* Animated hand overlay (shows after position is selected) */
  .hand-overlay {
    position: absolute;
    pointer-events: none;
    z-index: 10;

    /* Position based on CSS custom properties (row, col) */
    /* Each cell is 1/3 of the grid, accounting for gaps */
    --cell-size: calc((100% - 24px) / 3); /* 24px = 2 gaps × 12px */
    --gap: 12px;

    width: var(--cell-size);
    height: var(--cell-size);

    /* Position: col * (cell + gap) */
    left: calc(var(--hand-col) * (var(--cell-size) + var(--gap)));
    top: calc(var(--hand-row) * (var(--cell-size) + var(--gap)));

    /* Smooth animation when position changes */
    transition:
      left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      top 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hand-icon {
    width: 60%;
    height: 60%;
    transition:
      transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      filter 0.3s ease;
  }

  /* SVG path fill using CSS */
  .hand-path {
    transition: fill 0.5s ease;
  }

  /* Blue phase colors */
  .hand-overlay.blue .hand-path {
    fill: #3b82f6;
  }

  /* Red phase colors */
  .hand-overlay.red .hand-path {
    fill: #ef4444;
  }

  /* Color-matched glow for each phase */
  .hand-overlay.blue .hand-icon {
    filter: drop-shadow(0 4px 16px rgba(59, 130, 246, 0.6))
      drop-shadow(0 0 8px rgba(59, 130, 246, 0.4));
  }

  .hand-overlay.red .hand-icon {
    filter: drop-shadow(0 4px 16px rgba(239, 68, 68, 0.6))
      drop-shadow(0 0 8px rgba(239, 68, 68, 0.4));
    /* Mirror for right hand */
    transform: scaleX(-1);
  }

  /* Phase transition animation */
  .hand-overlay.transitioning .hand-icon {
    animation: phase-transition 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .hand-overlay.transitioning .hand-path {
    animation: color-morph 0.5s ease;
  }

  @keyframes phase-transition {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    40% {
      transform: scale(0.7);
      opacity: 0.6;
    }
    60% {
      transform: scale(0.7);
      opacity: 0.6;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Color morphs through purple midpoint */
  @keyframes color-morph {
    0% {
      fill: #3b82f6; /* blue */
    }
    50% {
      fill: #8b5cf6; /* purple midpoint */
    }
    100% {
      fill: #ef4444; /* red */
    }
  }

  .center-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg);
    border: 2px dashed var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-2xl);
    opacity: 0.3;
  }

  .center-label {
    user-select: none;
  }

  @media (max-width: 768px) {
    .hand-path-grid {
      gap: 8px;
    }

    .ghost-overlay,
    .hand-overlay {
      /* Adjust for smaller gap on mobile */
      --cell-size: calc((100% - 16px) / 3); /* 16px = 2 gaps × 8px */
      --gap: 8px;
    }
  }

  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .ghost-overlay,
    .hand-overlay {
      transition: none;
    }

    .ghost-icon {
      animation: none;
    }

    .hand-icon {
      transition: none;
    }

    .hand-path {
      transition: none;
    }

    .hand-overlay.transitioning .hand-icon,
    .hand-overlay.transitioning .hand-path {
      animation: none;
    }
  }
</style>

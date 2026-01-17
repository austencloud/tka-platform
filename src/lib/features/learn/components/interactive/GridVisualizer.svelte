<!--
GridVisualizer - Interactive grid learning component
Shows box and diamond grids side-by-side with animations
-->
<script lang="ts">
  import { untrack } from "svelte";

  type GridMode = "diamond" | "box" | "merged";

  let { mode = $bindable("diamond") } = $props<{
    mode?: GridMode;
  }>();

  let showLabels = $state(true);
  let highlightedPoints = $state<Set<string>>(new Set());

  // Grid point positions (normalized 0-100)
  const DIAMOND_POINTS = {
    center: { x: 50, y: 50, label: "Center" },
    top: { x: 50, y: 10, label: "Top Outer" },
    right: { x: 90, y: 50, label: "Right Outer" },
    bottom: { x: 50, y: 90, label: "Bottom Outer" },
    left: { x: 10, y: 50, label: "Left Outer" },
    // Hand points (halfway between center and outer)
    topHand: { x: 50, y: 30, label: "Top Hand" },
    rightHand: { x: 70, y: 50, label: "Right Hand" },
    bottomHand: { x: 50, y: 70, label: "Bottom Hand" },
    leftHand: { x: 30, y: 50, label: "Left Hand" },
  };

  const BOX_POINTS = {
    center: { x: 50, y: 50, label: "Center" },
    topLeft: { x: 20, y: 20, label: "Top-Left Outer" },
    topRight: { x: 80, y: 20, label: "Top-Right Outer" },
    bottomRight: { x: 80, y: 80, label: "Bottom-Right Outer" },
    bottomLeft: { x: 20, y: 80, label: "Bottom-Left Outer" },
    // Hand points
    topLeftHand: { x: 35, y: 35, label: "Top-Left Hand" },
    topRightHand: { x: 65, y: 35, label: "Top-Right Hand" },
    bottomRightHand: { x: 65, y: 65, label: "Bottom-Right Hand" },
    bottomLeftHand: { x: 35, y: 65, label: "Bottom-Left Hand" },
  };

  // Get points based on mode
  function getPoints() {
    if (mode === "diamond") return DIAMOND_POINTS;
    if (mode === "box") return BOX_POINTS;
    // Merged shows both
    return { ...DIAMOND_POINTS, ...BOX_POINTS };
  }

  function handlePointClick(pointKey: string) {
    if (highlightedPoints.has(pointKey)) {
      highlightedPoints.delete(pointKey);
    } else {
      highlightedPoints.add(pointKey);
    }
    highlightedPoints = new Set(highlightedPoints);
  }

  function isCenter(key: string): boolean {
    return key === "center";
  }

  function isHandPoint(key: string): boolean {
    return key.includes("Hand");
  }

  function isOuterPoint(key: string): boolean {
    return !isCenter(key) && !isHandPoint(key);
  }

  // Reset highlights when mode changes
  // Use a simple approach: just depend on mode, write with untrack
  $effect(() => {
    // Subscribe to mode changes
    void mode;
    // Reset highlights without creating a read dependency on highlightedPoints
    untrack(() => {
      highlightedPoints = new Set();
    });
  });
</script>

<div class="grid-visualizer">
  <!-- Title and Mode Indicator -->
  <div class="visualizer-header">
    <h3 class="grid-title">
      {#if mode === "diamond"}
        Diamond Grid
      {:else if mode === "box"}
        Box Grid
      {:else}
        8-Point Grid (Merged)
      {/if}
    </h3>
    <div
      class="grid-mode-badge"
      class:diamond={mode === "diamond"}
      class:box={mode === "box"}
      class:merged={mode === "merged"}
    >
      {mode.toUpperCase()}
    </div>
  </div>

  <!-- Grid Container -->
  <div class="grid-container">
    <svg
      viewBox="0 0 100 100"
      class="grid-svg"
      class:merged={mode === "merged"}
    >
      <!-- Connection lines (drawn first, under points) -->
      <g class="connection-lines" opacity="0.3">
        {#if mode === "diamond" || mode === "merged"}
          <!-- Diamond grid lines -->
          <line
            x1="50"
            y1="10"
            x2="50"
            y2="90"
            stroke="white"
            stroke-width="0.5"
          />
          <line
            x1="10"
            y1="50"
            x2="90"
            y2="50"
            stroke="white"
            stroke-width="0.5"
          />
        {/if}

        {#if mode === "box" || mode === "merged"}
          <!-- Box grid lines -->
          <line
            x1="20"
            y1="20"
            x2="80"
            y2="80"
            stroke="white"
            stroke-width="0.5"
            opacity="0.5"
          />
          <line
            x1="80"
            y1="20"
            x2="20"
            y2="80"
            stroke="white"
            stroke-width="0.5"
            opacity="0.5"
          />
        {/if}
      </g>

      <!-- Grid points -->
      <g class="grid-points">
        {#each Object.entries(getPoints()) as [key, point]}
          {@const isHighlighted = highlightedPoints.has(key)}
          {@const pointRadius = isCenter(key)
            ? 2.5
            : isHandPoint(key)
              ? 2
              : 1.5}
          {@const pointColor = isCenter(key)
            ? "#FFD700"
            : isHandPoint(key)
              ? "#4A9EFF"
              : "#FF4A4A"}

          <g
            class="grid-point"
            class:highlighted={isHighlighted}
            onclick={() => handlePointClick(key)}
            onkeydown={(e) =>
              (e.key === "Enter" || e.key === " ") && handlePointClick(key)}
            role="button"
            tabindex="0"
            aria-label={point.label}
          >
            <!-- Outer glow when highlighted -->
            {#if isHighlighted}
              <circle
                cx={point.x}
                cy={point.y}
                r={pointRadius * 2.5}
                fill={pointColor}
                opacity="0.2"
                class="point-glow"
              />
            {/if}

            <!-- Main point -->
            <circle
              cx={point.x}
              cy={point.y}
              r={pointRadius}
              fill={pointColor}
              class="point-circle"
              class:center={isCenter(key)}
              class:hand={isHandPoint(key)}
              class:outer={isOuterPoint(key)}
            />

            <!-- Label -->
            {#if showLabels}
              <text
                x={point.x}
                y={point.y +
                  (isCenter(key) ? -4 : isHandPoint(key) ? -3.5 : -3)}
                text-anchor="middle"
                class="point-label"
                class:highlighted={isHighlighted}
                font-size="2.5"
                fill="white"
                opacity="0.8"
              >
                {point.label}
              </text>
            {/if}
          </g>
        {/each}
      </g>
    </svg>

    <!-- Legend -->
    <div class="grid-legend">
      <div class="legend-item">
        <div class="legend-dot center"></div>
        <span>Center Point</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot hand"></div>
        <span>Hand Points</span>
      </div>
      <div class="legend-item">
        <div class="legend-dot outer"></div>
        <span>Outer Points</span>
      </div>
    </div>
  </div>

  <!-- Helper text -->
  <div class="helper-text">
    <p>💡 Click points to highlight them and explore the grid structure</p>
  </div>
</div>

<style>
  .grid-visualizer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid var(--theme-stroke);
    border-radius: 16px;
  }

  .visualizer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .grid-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .grid-mode-badge {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    transition: all var(--duration-emphasis) ease;
  }

  .grid-mode-badge.diamond {
    background: rgba(74, 158, 255, 0.2);
    color: #4a9eff;
    border: 2px solid rgba(74, 158, 255, 0.3);
  }

  .grid-mode-badge.box {
    background: rgba(255, 74, 158, 0.2);
    color: #ff4a9e;
    border: 2px solid rgba(255, 74, 158, 0.3);
  }

  .grid-mode-badge.merged {
    background: rgba(123, 104, 238, 0.2);
    color: #7b68ee;
    border: 2px solid rgba(123, 104, 238, 0.3);
  }

  .grid-container {
    position: relative;
  }

  .grid-svg {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    max-width: 400px;
    margin: 0 auto;
    display: block;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    cursor: pointer;
  }

  .grid-svg.merged {
    background: rgba(123, 104, 238, 0.05);
  }

  .grid-point {
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .grid-point:hover .point-circle {
    filter: brightness(1.3);
    transform: scale(1.2);
    transform-origin: center;
  }

  .point-circle {
    transition: all var(--duration-normal) ease;
  }

  .point-circle.center {
    filter: drop-shadow(0 0 4px #ffd700);
  }

  .point-circle.hand {
    filter: drop-shadow(0 0 3px #4a9eff);
  }

  .point-circle.outer {
    filter: drop-shadow(0 0 3px #ff4a4a);
  }

  .point-glow {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.2;
    }
    50% {
      opacity: 0.4;
    }
  }

  .point-label {
    pointer-events: none;
    user-select: none;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    font-weight: 600;
    transition: opacity var(--duration-normal) ease;
  }

  .point-label.highlighted {
    opacity: 1 !important;
    font-weight: 700;
  }

  .grid-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1rem;
    padding: 0.75rem;
    background: var(--theme-card-bg);
    border-radius: 8px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .legend-dot.center {
    background: #ffd700;
    box-shadow: 0 0 8px #ffd700;
  }

  .legend-dot.hand {
    background: #4a9eff;
    box-shadow: 0 0 6px #4a9eff;
  }

  .legend-dot.outer {
    background: #ff4a4a;
    box-shadow: 0 0 6px #ff4a4a;
  }

  .helper-text {
    text-align: center;
    font-size: 0.9375rem;
    color: var(--theme-text-dim);
    font-style: italic;
  }

  .helper-text p {
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .grid-visualizer {
      padding: 1rem;
    }

    .grid-legend {
      flex-direction: column;
      gap: 0.75rem;
    }

    .helper-text {
      font-size: 0.875rem;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .point-glow {
      animation: none;
    }
  }
</style>

<!--
PositionVisualizer - Interactive 8-point grid showing two hand positions
Visualizes Alpha (opposite), Beta (same), and Gamma (right angle) positions
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";

  type HandPosition = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  type PositionType = "alpha" | "beta" | "gamma";

  let {
    leftHand = $bindable<HandPosition>("N"),
    rightHand = $bindable<HandPosition>("S"),
    interactive = false,
    showLabels = true,
    highlightType = null as PositionType | null,
    onPositionChange,
  } = $props<{
    leftHand?: HandPosition;
    rightHand?: HandPosition;
    interactive?: boolean;
    showLabels?: boolean;
    highlightType?: PositionType | null;
    onPositionChange?: (left: HandPosition, right: HandPosition) => void;
  }>();

  const hapticService = container.items.hapticFeedback;

  // Grid point coordinates (8-point grid)
  const GRID_POINTS: Record<
    HandPosition,
    { x: number; y: number; label: string }
  > = {
    N: { x: 50, y: 12, label: "N" },
    NE: { x: 82, y: 22, label: "NE" },
    E: { x: 92, y: 50, label: "E" },
    SE: { x: 82, y: 78, label: "SE" },
    S: { x: 50, y: 88, label: "S" },
    SW: { x: 18, y: 78, label: "SW" },
    W: { x: 8, y: 50, label: "W" },
    NW: { x: 18, y: 22, label: "NW" },
  } as const;

  // Opposite point pairs (for Alpha detection)
  const OPPOSITE_PAIRS: Record<string, string> = {
    N: "S",
    S: "N",
    E: "W",
    W: "E",
    NE: "SW",
    SW: "NE",
    NW: "SE",
    SE: "NW",
  };

  // Adjacent point pairs (for Gamma detection - 90° apart)
  function areAdjacent(p1: string, p2: string): boolean {
    const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const i1 = points.indexOf(p1);
    const i2 = points.indexOf(p2);
    const diff = Math.abs(i1 - i2);
    // Adjacent means 2 positions apart (90°) or wrapped around (6 positions = 90°)
    return diff === 2 || diff === 6;
  }

  // Determine current position type
  const currentPositionType = $derived((): PositionType => {
    if (leftHand === rightHand) return "beta";
    if (OPPOSITE_PAIRS[leftHand] === rightHand) return "alpha";
    if (areAdjacent(leftHand, rightHand)) return "gamma";
    // Default to gamma for other angles
    return "gamma";
  });

  // Position type colors — domain-specific visualization colors
  const POSITION_COLORS: Record<PositionType, string> = {
    alpha: "#FF6B6B", // Red/coral for opposite (alpha position)
    beta: "#4ECDC4", // Teal for same (beta position)
    gamma: "#FFE66D", // Yellow for right angle (gamma position)
  };

  // Hand colors
  const LEFT_HAND_COLOR = "var(--prop-blue, #4A9EFF)";
  const RIGHT_HAND_COLOR = "var(--prop-red, #FF4A9E)";

  let selectingHand = $state<"left" | "right" | null>(null);

  function handlePointClick(point: HandPosition) {
    if (!interactive) return;

    hapticService?.trigger("selection");

    const leftPos = leftHand as HandPosition;
    const rightPos = rightHand as HandPosition;

    if (!selectingHand) {
      // First click - determine which hand is closer
      const leftDist = getDistance(GRID_POINTS[leftPos], GRID_POINTS[point]);
      const rightDist = getDistance(GRID_POINTS[rightPos], GRID_POINTS[point]);

      if (leftDist < rightDist) {
        leftHand = point;
      } else {
        rightHand = point;
      }
    } else if (selectingHand === "left") {
      leftHand = point;
      selectingHand = null;
    } else {
      rightHand = point;
      selectingHand = null;
    }

    onPositionChange?.(leftHand as HandPosition, rightHand as HandPosition);
  }

  function getDistance(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  }

  function selectHand(hand: "left" | "right") {
    if (!interactive) return;
    selectingHand = selectingHand === hand ? null : hand;
    hapticService?.trigger("selection");
  }

  // Get connection line between hands
  const connectionLine = $derived(() => {
    const leftPos = leftHand as HandPosition;
    const rightPos = rightHand as HandPosition;
    const left = GRID_POINTS[leftPos];
    const right = GRID_POINTS[rightPos];
    return { x1: left.x, y1: left.y, x2: right.x, y2: right.y };
  });
</script>

<div class="position-visualizer" class:interactive>
  <!-- Position type indicator -->
  {#if highlightType || currentPositionType}
    {@const type: PositionType = highlightType || currentPositionType()}
    <div class="position-badge" style="--badge-color: {POSITION_COLORS[type]}">
      <span class="badge-icon">
        {#if type === "alpha"}
          <i class="fa-solid fa-arrows-left-right" aria-hidden="true"></i>
        {:else if type === "beta"}
          <i class="fa-solid fa-circle-dot" aria-hidden="true"></i>
        {:else}
          <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        {/if}
      </span>
      <span class="badge-text"
        >{type.charAt(0).toUpperCase() + type.slice(1)}</span
      >
    </div>
  {/if}

  <!-- Grid SVG -->
  <svg viewBox="0 0 100 100" class="position-grid">
    <!-- Grid lines (subtle) -->
    <g class="grid-lines" opacity="0.15">
      <!-- Diamond lines -->
      <line x1="50" y1="12" x2="50" y2="88" stroke="white" stroke-width="0.5" />
      <line x1="8" y1="50" x2="92" y2="50" stroke="white" stroke-width="0.5" />
      <!-- Box lines -->
      <line x1="18" y1="22" x2="82" y2="78" stroke="white" stroke-width="0.5" />
      <line x1="82" y1="22" x2="18" y2="78" stroke="white" stroke-width="0.5" />
    </g>

    <!-- Connection line between hands -->
    {#if leftHand !== rightHand}
      {@const line = connectionLine()}
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke={POSITION_COLORS[currentPositionType()]}
        stroke-width="2"
        stroke-dasharray="4 2"
        opacity="0.6"
        class="connection-line"
      />
    {/if}

    <!-- Grid points -->
    {#each Object.entries(GRID_POINTS) as [key, point]}
      {@const isLeftHand = key === leftHand}
      {@const isRightHand = key === rightHand}
      {@const isBothHands = isLeftHand && isRightHand}

      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g
        class="grid-point"
        class:clickable={interactive}
        onclick={interactive
          ? () => handlePointClick(key as HandPosition)
          : undefined}
        onkeydown={interactive
          ? (e) =>
              (e.key === "Enter" || e.key === " ") &&
              handlePointClick(key as HandPosition)
          : undefined}
        role={interactive ? "button" : undefined}
        tabindex={interactive ? 0 : undefined}
        aria-label={interactive ? point.label : undefined}
      >
        <!-- Hit area -->
        {#if interactive}
          <circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill="transparent"
            class="hit-area"
          />
        {/if}

        <!-- Base point (empty if not a hand) -->
        {#if !isLeftHand && !isRightHand}
          <circle
            cx={point.x}
            cy={point.y}
            r="3"
            fill="var(--theme-stroke-strong, rgba(255, 255, 255, 0.3))"
            class="base-point"
          />
        {/if}

        <!-- Both hands at same point (Beta) -->
        {#if isBothHands}
          <circle
            cx={point.x}
            cy={point.y}
            r="10"
            fill={POSITION_COLORS.beta}
            opacity="0.3"
            class="hand-glow"
          />
          <!-- Stacked hands indicator -->
          <circle cx={point.x - 3} cy={point.y} r="5" fill={LEFT_HAND_COLOR} />
          <circle cx={point.x + 3} cy={point.y} r="5" fill={RIGHT_HAND_COLOR} />
        {:else if isLeftHand}
          <!-- Left hand -->
          <circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill={LEFT_HAND_COLOR}
            opacity="0.25"
            class="hand-glow"
          />
          <circle
            cx={point.x}
            cy={point.y}
            r="5"
            fill={LEFT_HAND_COLOR}
            class="hand-point left"
          />
        {:else if isRightHand}
          <!-- Right hand -->
          <circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill={RIGHT_HAND_COLOR}
            opacity="0.25"
            class="hand-glow"
          />
          <circle
            cx={point.x}
            cy={point.y}
            r="5"
            fill={RIGHT_HAND_COLOR}
            class="hand-point right"
          />
        {/if}

        <!-- Point label -->
        {#if showLabels}
          <text
            x={point.x}
            y={point.y + (point.y < 50 ? -10 : 14)}
            text-anchor="middle"
            class="point-label"
            fill="var(--theme-text-dim)"
            font-size="5"
            font-weight="600"
          >
            {point.label}
          </text>
        {/if}
      </g>
    {/each}

    <!-- Center point -->
    <circle cx="50" cy="50" r="2" fill="var(--theme-stroke, rgba(255, 255, 255, 0.2))" />
  </svg>

  <!-- Hand legend (interactive mode) -->
  {#if interactive}
    <div class="hand-legend">
      <button
        class="legend-item"
        class:selecting={selectingHand === "left"}
        onclick={() => selectHand("left")}
      >
        <div class="legend-dot" style="background: {LEFT_HAND_COLOR}"></div>
        <span>Left Hand: {leftHand}</span>
      </button>
      <button
        class="legend-item"
        class:selecting={selectingHand === "right"}
        onclick={() => selectHand("right")}
      >
        <div class="legend-dot" style="background: {RIGHT_HAND_COLOR}"></div>
        <span>Right Hand: {rightHand}</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .position-visualizer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke);
    border-radius: 16px;
  }

  .position-visualizer.interactive {
    border-color: color-mix(in srgb, var(--prop-blue, #4a9eff) 30%, transparent);
  }

  /* Position badge */
  .position-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--badge-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--badge-color) 40%, transparent);
    border-radius: 20px;
  }

  .badge-icon {
    color: var(--badge-color);
    font-size: 0.875rem;
  }

  .badge-text {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--badge-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Grid */
  .position-grid {
    width: 100%;
    max-width: 280px;
    height: auto;
    aspect-ratio: 1;
  }

  .grid-point {
    cursor: default;
  }

  .grid-point.clickable {
    cursor: pointer;
  }

  .grid-point.clickable:hover .base-point {
    fill: var(--theme-text, rgba(255, 255, 255, 0.6));
    transform: scale(1.3);
    transform-origin: center;
  }

  .base-point,
  .hand-point {
    transition: all var(--duration-normal) ease;
  }

  .hand-glow {
    animation: handPulse 2s ease-in-out infinite;
  }

  @keyframes handPulse {
    0%,
    100% {
      opacity: 0.25;
    }
    50% {
      opacity: 0.4;
    }
  }

  .hand-point {
    filter: drop-shadow(0 0 4px currentColor);
  }

  .connection-line {
    animation: dashMove 1s linear infinite;
  }

  @keyframes dashMove {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: 12;
    }
  }

  .point-label {
    pointer-events: none;
    user-select: none;
  }

  /* Hand legend */
  .hand-legend {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    color: var(--theme-text-dim);
    font-size: 0.8125rem;
  }

  .legend-item:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .legend-item.selecting {
    background: color-mix(in srgb, var(--prop-blue, #4a9eff) 15%, transparent);
    border-color: color-mix(in srgb, var(--prop-blue, #4a9eff) 40%, transparent);
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  @media (max-width: 400px) {
    .position-visualizer {
      padding: 0.75rem;
    }

    .hand-legend {
      flex-direction: column;
      gap: 0.5rem;
    }

    .legend-item {
      width: 100%;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-glow,
    .connection-line {
      animation: none;
    }
  }
</style>

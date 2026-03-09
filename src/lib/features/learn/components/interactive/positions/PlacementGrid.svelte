<!--
PlacementGrid - Interactive SVG grid for placing blue and red hand markers.
Users tap grid points to place hands, forming position types (alpha/beta/gamma).
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { HandPosition } from "../../../domain/constants/position-quiz-data";
  import { container } from "$lib/shared/di";

  interface PlacementGridProps {
    gridMode: GridMode;
    onPlacementComplete: (left: HandPosition, right: HandPosition) => void;
    disabled?: boolean;
    showGuideLines?: boolean;
    guideLineType?: "alpha" | "beta" | "gamma";
    guideLinePoints?: { left: HandPosition; right: HandPosition };
  }

  let {
    gridMode,
    onPlacementComplete,
    disabled = false,
    showGuideLines = false,
    guideLineType,
    guideLinePoints,
  }: PlacementGridProps = $props();

  // =========================================================================
  // Grid point coordinate definitions
  // =========================================================================

  interface GridPoint {
    x: number;
    y: number;
    label: string;
    position: HandPosition;
  }

  const DIAMOND_GRID_POINTS: GridPoint[] = [
    { x: 50, y: 15, label: "North", position: "N" },
    { x: 85, y: 50, label: "East", position: "E" },
    { x: 50, y: 85, label: "South", position: "S" },
    { x: 15, y: 50, label: "West", position: "W" },
  ];

  const BOX_GRID_POINTS: GridPoint[] = [
    { x: 78, y: 22, label: "Northeast", position: "NE" },
    { x: 78, y: 78, label: "Southeast", position: "SE" },
    { x: 22, y: 78, label: "Southwest", position: "SW" },
    { x: 22, y: 22, label: "Northwest", position: "NW" },
  ];

  // =========================================================================
  // Coordinate lookup for guide lines (all 8 positions)
  // =========================================================================

  const POSITION_COORDS: Record<HandPosition, { x: number; y: number }> = {
    N: { x: 50, y: 15 },
    NE: { x: 78, y: 22 },
    E: { x: 85, y: 50 },
    SE: { x: 78, y: 78 },
    S: { x: 50, y: 85 },
    SW: { x: 22, y: 78 },
    W: { x: 15, y: 50 },
    NW: { x: 22, y: 22 },
  };

  // =========================================================================
  // Placement state machine: EMPTY -> BLUE_PLACED -> BOTH_PLACED
  // =========================================================================

  type PlacementState = "empty" | "blue-placed" | "both-placed";

  let placementState = $state<PlacementState>("empty");
  let bluePosition = $state<HandPosition | null>(null);
  let redPosition = $state<HandPosition | null>(null);

  // Haptic feedback service (resolved once)
  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = container.items.hapticFeedback as {
      trigger: (type: string) => void;
    } | null;
  } catch {
    // Haptic not available — fine on desktop
  }

  // =========================================================================
  // Derived values
  // =========================================================================

  const activePoints: GridPoint[] = $derived(
    gridMode === GridMode.DIAMOND ? DIAMOND_GRID_POINTS : BOX_GRID_POINTS,
  );

  const promptText: string = $derived.by(() => {
    if (placementState === "empty") return "Tap a point for the blue hand";
    if (placementState === "blue-placed")
      return "Now tap a point for the red hand";
    return "";
  });

  const showUndo: boolean = $derived(placementState === "blue-placed");

  // =========================================================================
  // Connection lines between grid points
  // =========================================================================

  interface ConnectionLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const connectionLines: ConnectionLine[] = $derived.by(() => {
    const lines: ConnectionLine[] = [];
    const pts = activePoints;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        lines.push({
          x1: pts[i]!.x,
          y1: pts[i]!.y,
          x2: pts[j]!.x,
          y2: pts[j]!.y,
        });
      }
    }
    return lines;
  });

  // =========================================================================
  // Handlers
  // =========================================================================

  function handlePointSelect(point: GridPoint) {
    if (disabled) return;

    if (placementState === "empty") {
      bluePosition = point.position;
      placementState = "blue-placed";
      hapticService?.trigger("selection");
      announceStatus(
        `Blue hand placed at ${point.label}. Tap a point for the red hand.`,
      );
      return;
    }

    if (placementState === "blue-placed") {
      // Beta positions have both hands at the same point, so allow same position
      redPosition = point.position;
      placementState = "both-placed";
      hapticService?.trigger("selection");

      const bluePosLabel = activePoints.find(
        (p) => p.position === bluePosition,
      )?.label;
      announceStatus(
        `Red hand placed at ${point.label}. Blue at ${bluePosLabel}, red at ${point.label}.`,
      );

      onPlacementComplete(bluePosition!, redPosition);
      return;
    }

    // both-placed: ignore further taps (parent controls reset via gridMode change)
  }

  function handleUndo() {
    bluePosition = null;
    placementState = "empty";
    hapticService?.trigger("selection");
    announceStatus("Blue hand removed. Tap a point for the blue hand.");
  }

  function handleKeydown(event: KeyboardEvent, point: GridPoint) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePointSelect(point);
    }
  }

  // =========================================================================
  // Accessibility: live region announcements
  // =========================================================================

  let liveAnnouncement = $state("");

  function announceStatus(message: string) {
    liveAnnouncement = message;
  }

  // =========================================================================
  // Reset when gridMode changes (parent moves to next question)
  // =========================================================================

  $effect(() => {
    void gridMode;
    untrack(() => {
      placementState = "empty";
      bluePosition = null;
      redPosition = null;
      liveAnnouncement = "";
    });
  });

  // =========================================================================
  // Point visual state helpers
  // =========================================================================

  // For beta (same point), blue was placed first so check that.
  // If both blue and red are at the same position, show both markers.
  function isBlueAt(position: HandPosition): boolean {
    return bluePosition === position && placementState !== "empty";
  }

  function isRedAt(position: HandPosition): boolean {
    return redPosition === position && placementState === "both-placed";
  }

  // =========================================================================
  // Guide line geometry
  // =========================================================================

  function getGuideCoords() {
    if (!guideLinePoints) return null;
    const left = POSITION_COORDS[guideLinePoints.left];
    const right = POSITION_COORDS[guideLinePoints.right];
    if (!left || !right) return null;
    return { left, right };
  }

  function computeGammaArc(): string {
    const coords = getGuideCoords();
    if (!coords) return "";
    const cx = 50;
    const cy = 50;
    const r = 12;
    const angleLeft = Math.atan2(coords.left.y - cy, coords.left.x - cx);
    const angleRight = Math.atan2(coords.right.y - cy, coords.right.x - cx);

    const startX = cx + r * Math.cos(angleLeft);
    const startY = cy + r * Math.sin(angleLeft);
    const endX = cx + r * Math.cos(angleRight);
    const endY = cy + r * Math.sin(angleRight);

    // Determine sweep direction: use the smaller arc
    let angleDiff = angleRight - angleLeft;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    const sweepFlag = angleDiff > 0 ? 1 : 0;

    return `M ${startX} ${startY} A ${r} ${r} 0 0 ${sweepFlag} ${endX} ${endY}`;
  }
</script>

<div class="placement-grid" class:disabled>
  <!-- Prompt text -->
  {#if promptText}
    <p class="prompt-text">{promptText}</p>
  {/if}

  <!-- SVG Grid -->
  <svg viewBox="0 0 100 100" class="grid-svg" aria-label="Position placement grid">
    <!-- Connection lines between grid points -->
    <g class="connection-lines" opacity="0.3">
      {#each connectionLines as line}
        <line
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="white"
          stroke-width="0.5"
        />
      {/each}
    </g>

    <!-- Guide lines overlay (for wrong answer feedback) -->
    {#if showGuideLines && guideLineType && guideLinePoints}
      {@const coords = getGuideCoords()}
      {#if coords}
        <g class="guide-lines">
          {#if guideLineType === "alpha"}
            <!-- Alpha: dashed line through center showing opposite relationship -->
            <line
              x1={coords.left.x}
              y1={coords.left.y}
              x2={coords.right.x}
              y2={coords.right.y}
              stroke="rgba(255, 255, 255, 0.6)"
              stroke-width="1"
              stroke-dasharray="3 2"
            />
            <circle cx="50" cy="50" r="2" fill="rgba(255, 255, 255, 0.4)" />
          {:else if guideLineType === "beta"}
            <!-- Beta: concentric ripple circles at the shared point -->
            {#each [6, 10, 14] as radius, i}
              <circle
                cx={coords.left.x}
                cy={coords.left.y}
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.4)"
                stroke-width="0.5"
                class="beta-ripple"
                style="animation-delay: {i * 0.3}s;"
              />
            {/each}
          {:else if guideLineType === "gamma"}
            <!-- Gamma: right-angle arc indicator at center -->
            <line
              x1="50"
              y1="50"
              x2={coords.left.x}
              y2={coords.left.y}
              stroke="rgba(255, 255, 255, 0.3)"
              stroke-width="0.5"
              stroke-dasharray="2 2"
            />
            <line
              x1="50"
              y1="50"
              x2={coords.right.x}
              y2={coords.right.y}
              stroke="rgba(255, 255, 255, 0.3)"
              stroke-width="0.5"
              stroke-dasharray="2 2"
            />
            <path
              d={computeGammaArc()}
              fill="none"
              stroke="rgba(255, 255, 255, 0.6)"
              stroke-width="1"
            />
            <!-- Right angle square indicator -->
            <text
              x="50"
              y="47"
              text-anchor="middle"
              fill="rgba(255, 255, 255, 0.5)"
              font-size="6"
            >90</text>
          {/if}
        </g>
      {/if}
    {/if}

    <!-- Grid points -->
    <g class="grid-points">
      {#each activePoints as point (point.position)}
        {@const hasBlue = isBlueAt(point.position)}
        {@const hasRed = isRedAt(point.position)}
        {@const isUnplaced = !hasBlue && !hasRed}

        <g
          class="grid-point"
          class:disabled
          onclick={() => handlePointSelect(point)}
          onkeydown={(e) => handleKeydown(e, point)}
          role="button"
          tabindex={disabled ? -1 : 0}
          aria-label="{point.label} point{hasBlue ? ' (blue hand placed)' : ''}{hasRed ? ' (red hand placed)' : ''}"
          aria-disabled={disabled}
        >
          <!-- Transparent touch target -->
          <circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill="transparent"
            class="touch-target"
          />

          <!-- Unplaced point indicator -->
          {#if isUnplaced}
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="rgba(255, 255, 255, 0.5)"
              class="point-unplaced"
            />
          {/if}

          <!-- Blue hand marker -->
          {#if hasBlue}
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="var(--prop-blue, #4A9EFF)"
              class="hand-marker blue-marker"
              filter="url(#blue-glow)"
            />
          {/if}

          <!-- Red hand marker -->
          {#if hasRed}
            <!-- If beta (same point as blue), offset slightly -->
            {#if bluePosition === redPosition}
              <circle
                cx={point.x + 4}
                cy={point.y}
                r="5"
                fill="var(--prop-red, #FF4A4A)"
                class="hand-marker red-marker"
                filter="url(#red-glow)"
              />
              <!-- Shift blue left for visual clarity on beta -->
              <circle
                cx={point.x - 4}
                cy={point.y}
                r="5"
                fill="var(--prop-blue, #4A9EFF)"
                class="hand-marker blue-marker"
                filter="url(#blue-glow)"
              />
            {:else}
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="var(--prop-red, #FF4A4A)"
                class="hand-marker red-marker"
                filter="url(#red-glow)"
              />
            {/if}
          {/if}
        </g>
      {/each}
    </g>

    <!-- SVG filter definitions for drop shadow glows -->
    <defs>
      <filter id="blue-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#4A9EFF" flood-opacity="0.7" />
      </filter>
      <filter id="red-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="#FF4A4A" flood-opacity="0.7" />
      </filter>
    </defs>
  </svg>

  <!-- Undo button -->
  {#if showUndo && !disabled}
    <button class="undo-button" onclick={handleUndo}>
      Undo
    </button>
  {/if}

  <!-- Accessibility: live region for screen readers -->
  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {liveAnnouncement}
  </div>
</div>

<style>
  .placement-grid {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .placement-grid.disabled {
    pointer-events: none;
    opacity: 0.7;
  }

  .prompt-text {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    text-align: center;
    font-weight: 500;
    min-height: 1.5em;
  }

  .grid-svg {
    width: 100%;
    max-width: 320px;
    height: auto;
    aspect-ratio: 1;
    display: block;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.2));
    border-radius: 12px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Grid point interactivity */
  .grid-point {
    cursor: pointer;
  }

  .grid-point.disabled {
    cursor: default;
  }

  .grid-point:hover .point-unplaced,
  .grid-point:focus-visible .point-unplaced {
    fill: rgba(255, 255, 255, 0.85);
    filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.5));
  }

  .grid-point:focus-visible {
    outline: none;
  }

  .grid-point:focus-visible .touch-target {
    stroke: rgba(255, 255, 255, 0.6);
    stroke-width: 1;
    stroke-dasharray: 2 1;
  }

  .point-unplaced {
    transition: fill 0.15s ease, filter 0.15s ease;
  }

  /* Hand marker entrance animation */
  .hand-marker {
    animation: marker-settle 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }

  @keyframes marker-settle {
    0% {
      r: 6.5;
      opacity: 0.6;
    }
    60% {
      r: 5.3;
    }
    100% {
      r: 5;
      opacity: 1;
    }
  }

  /* Guide line animations */
  .beta-ripple {
    animation: ripple-expand 1.5s ease-out infinite;
  }

  @keyframes ripple-expand {
    0% {
      opacity: 0.5;
    }
    100% {
      opacity: 0;
    }
  }

  /* Undo button */
  .undo-button {
    padding: 0.4rem 1rem;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .undo-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    background: rgba(255, 255, 255, 0.08);
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Accessibility: reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .hand-marker {
      animation: none;
    }

    .beta-ripple {
      animation: none;
    }

    .point-unplaced {
      transition: none;
    }

    .undo-button {
      transition: none;
    }
  }
</style>

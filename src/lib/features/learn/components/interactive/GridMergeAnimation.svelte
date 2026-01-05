<!--
GridMergeAnimation - Custom animation showing diamond and box grids merging
All 8 points exist in a single SVG at their final merged positions.
CSS transforms create the illusion of separate grids that merge together.

Phases:
- "diamond": Only diamond points visible, centered
- "both": Diamond shifts left, box shifts right (visually separated)
- "merged": All points animate back to center (their true positions)
-->
<script lang="ts">
  type Phase = "diamond" | "both" | "merged";

  let { phase = "diamond" } = $props<{
    phase: Phase;
  }>();

  // Grid dimensions (matching GridSvg viewBox)
  const SIZE = 950;
  const CENTER = SIZE / 2; // 475
  const OUTER_RADIUS = 380;
  const HAND_RADIUS = OUTER_RADIUS / 2;

  // Diamond points: N, E, S, W (cardinal directions)
  const diamondPoints = [
    { id: "n", x: CENTER, y: CENTER - OUTER_RADIUS, label: "N" },
    { id: "e", x: CENTER + OUTER_RADIUS, y: CENTER, label: "E" },
    { id: "s", x: CENTER, y: CENTER + OUTER_RADIUS, label: "S" },
    { id: "w", x: CENTER - OUTER_RADIUS, y: CENTER, label: "W" },
  ];

  // Box points: NE, SE, SW, NW (intercardinal directions)
  const diagonalOffset = OUTER_RADIUS * Math.cos(Math.PI / 4);
  const boxPoints = [
    { id: "ne", x: CENTER + diagonalOffset, y: CENTER - diagonalOffset, label: "NE" },
    { id: "se", x: CENTER + diagonalOffset, y: CENTER + diagonalOffset, label: "SE" },
    { id: "sw", x: CENTER - diagonalOffset, y: CENTER + diagonalOffset, label: "SW" },
    { id: "nw", x: CENTER - diagonalOffset, y: CENTER - diagonalOffset, label: "NW" },
  ];

  // Hand points
  const handDiagonalOffset = HAND_RADIUS * Math.cos(Math.PI / 4);
  const handPoints = [
    { id: "hand-ne", x: CENTER + handDiagonalOffset, y: CENTER - handDiagonalOffset },
    { id: "hand-se", x: CENTER + handDiagonalOffset, y: CENTER + handDiagonalOffset },
    { id: "hand-sw", x: CENTER - handDiagonalOffset, y: CENTER + handDiagonalOffset },
    { id: "hand-nw", x: CENTER - handDiagonalOffset, y: CENTER - handDiagonalOffset },
  ];
</script>

<div
  class="grid-merge-animation"
  class:phase-diamond={phase === "diamond"}
  class:phase-both={phase === "both"}
  class:phase-merged={phase === "merged"}
>
  <svg viewBox="0 0 {SIZE} {SIZE}" class="merge-svg">
    <!-- Background -->
    <rect class="grid-background" width={SIZE} height={SIZE} rx="12" />

    <!-- Center point (always visible, doesn't move) -->
    <circle class="center-point" cx={CENTER} cy={CENTER} r="14" />

    <!-- Diamond group - shifts left in "both" phase -->
    <!-- Diamond points are FILLED (solid) to distinguish from box mode -->
    <g class="diamond-group">
      {#each diamondPoints as point, i}
        <g class="outer-point-group diamond-point" data-index={i}>
          <circle cx={point.x} cy={point.y} r="28" class="outer-point diamond-outer" />
          <text x={point.x} y={point.y - 50} class="point-label">{point.label}</text>
        </g>
      {/each}

      <!-- Diamond hand points -->
      {#each handPoints as point, i}
        <circle
          class="hand-point diamond-hand"
          cx={point.x}
          cy={point.y}
          r="10"
          data-index={i}
        />
      {/each}
    </g>

    <!-- Box group - hidden initially, shifts right in "both" phase -->
    <!-- Box points are OUTLINED (stroke only) to distinguish from diamond mode -->
    <g class="box-group">
      {#each boxPoints as point, i}
        <g class="outer-point-group box-point" data-index={i}>
          <circle cx={point.x} cy={point.y} r="28" class="outer-point box-outer" />
          <text x={point.x} y={point.y - 50} class="point-label">{point.label}</text>
        </g>
      {/each}
    </g>
  </svg>
</div>

<style>
  .grid-merge-animation {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
  }

  .merge-svg {
    width: 100%;
    height: auto;
    border-radius: 12px;
    overflow: visible;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  :global(:root.dark) .merge-svg {
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 20px rgba(0, 0, 0, 0.4);
  }

  /* Background */
  .grid-background {
    fill: #ffffff;
  }

  :global(:root.dark) .grid-background {
    fill: var(--dm-pictograph-bg, #0a0a0f);
  }

  /* Center point */
  .center-point {
    fill: #1f2937;
    transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  :global(:root.dark) .center-point {
    fill: #d1d5db;
  }

  /* Outer points - base styling */
  .outer-point {
    stroke-width: 4;
    stroke-miterlimit: 10;
  }

  /* Diamond outer points - FILLED (solid circles) */
  .diamond-outer {
    fill: #1f2937;
    stroke: #1f2937;
    stroke-opacity: 0;
  }

  :global(:root.dark) .diamond-outer {
    fill: var(--dm-grid-color, #d0d0d0);
    stroke: var(--dm-grid-color, #d0d0d0);
  }

  /* Box outer points - OUTLINED (stroke only, no fill) */
  .box-outer {
    fill: none;
    stroke: #374151;
    stroke-opacity: 1;
  }

  :global(:root.dark) .box-outer {
    stroke: var(--dm-grid-color, #d0d0d0);
  }

  /* Hand points */
  .hand-point {
    fill: #6b7280;
  }

  :global(:root.dark) .hand-point {
    fill: #9ca3af;
  }

  /* Labels */
  .point-label {
    font-size: 40px;
    font-weight: 700;
    fill: #374151;
    text-anchor: middle;
    font-family: system-ui, -apple-system, sans-serif;
  }

  :global(:root.dark) .point-label {
    fill: #9ca3af;
  }

  /* Groups base state */
  .diamond-group,
  .box-group {
    transition: transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1),
                opacity 0.5s ease;
  }

  /* Individual points for staggered animations */
  .outer-point-group,
  .hand-point {
    opacity: 0;
    transform-origin: center;
    transform-box: fill-box;
  }

  /* ============================================
     Phase: Diamond
     Only diamond points visible, centered
     ============================================ */
  .phase-diamond .diamond-group {
    transform: translateX(0);
  }

  .phase-diamond .box-group {
    opacity: 0;
    pointer-events: none;
  }

  /* Staggered entrance for diamond points */
  .phase-diamond .diamond-point[data-index="0"] { animation: pointPop 0.5s 0.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-diamond .diamond-point[data-index="1"] { animation: pointPop 0.5s 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-diamond .diamond-point[data-index="2"] { animation: pointPop 0.5s 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-diamond .diamond-point[data-index="3"] { animation: pointPop 0.5s 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

  .phase-diamond .diamond-hand[data-index="0"] { animation: pointPop 0.4s 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-diamond .diamond-hand[data-index="1"] { animation: pointPop 0.4s 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-diamond .diamond-hand[data-index="2"] { animation: pointPop 0.4s 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-diamond .diamond-hand[data-index="3"] { animation: pointPop 0.4s 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

  .phase-diamond .center-point {
    animation: pointPop 0.5s 0s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes pointPop {
    0% {
      opacity: 0;
      transform: scale(0);
    }
    70% {
      opacity: 1;
      transform: scale(1.15);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* ============================================
     Phase: Both
     Diamond shifts left, Box shifts right
     ============================================ */
  .phase-both .diamond-group {
    transform: translateX(-200px);
  }

  .phase-both .diamond-point,
  .phase-both .diamond-hand {
    opacity: 1;
    animation: none;
  }

  .phase-both .box-group {
    opacity: 1;
    transform: translateX(200px);
  }

  /* Staggered entrance for box points */
  .phase-both .box-point[data-index="0"] { animation: pointPop 0.5s 0.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-both .box-point[data-index="1"] { animation: pointPop 0.5s 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-both .box-point[data-index="2"] { animation: pointPop 0.5s 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
  .phase-both .box-point[data-index="3"] { animation: pointPop 0.5s 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

  /* ============================================
     Phase: Merged
     Both groups animate back to center (their true positions)
     ============================================ */
  .phase-merged .diamond-group {
    transform: translateX(0);
  }

  .phase-merged .diamond-point,
  .phase-merged .diamond-hand {
    opacity: 1;
    animation: none;
  }

  .phase-merged .box-group {
    opacity: 1;
    transform: translateX(0);
  }

  .phase-merged .box-point {
    opacity: 1;
    animation: none;
  }

  /* Hide labels in merged state for cleaner look */
  .phase-merged .point-label {
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  /* ============================================
     Responsive
     ============================================ */
  @media (max-width: 600px) {
    .grid-merge-animation {
      max-width: 320px;
    }

    .point-label {
      font-size: 32px;
    }

    /* Smaller offsets on mobile */
    .phase-both .diamond-group {
      transform: translateX(-120px);
    }

    .phase-both .box-group {
      transform: translateX(120px);
    }
  }

  /* ============================================
     Reduced Motion
     ============================================ */
  @media (prefers-reduced-motion: reduce) {
    .diamond-group,
    .box-group {
      transition: none;
    }

    .outer-point-group,
    .hand-point,
    .center-point {
      animation: none !important;
      opacity: 1;
      transform: scale(1);
    }
  }
</style>

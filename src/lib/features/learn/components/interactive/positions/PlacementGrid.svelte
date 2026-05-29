<!--
PlacementGrid - Interactive grid for placing blue and red hand markers.
Uses PictographContainer (the real pictograph renderer) for hand display,
with an interactive SVG overlay for touch targets and pulse indicators.
Hands render at the exact same size/position as everywhere else in the app.
-->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { untrack } from 'svelte';
  import { GridMode, GridLocation } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
  import PictographContainer from '$lib/shared/pictograph/shared/components/PictographContainer.svelte';
  import { createMotionData } from '$lib/shared/pictograph/shared/domain/models/MotionData';
  import {
    MotionColor,
    MotionType,
    Orientation,
    RotationDirection,
  } from '$lib/shared/pictograph/shared/domain/enums/pictograph-enums';
  import { PropType } from '$lib/shared/pictograph/prop/domain/enums/PropType';
  import type { PictographData } from '$lib/shared/pictograph/shared/domain/models/PictographData';
  import type { HandPosition } from '../../../domain/constants/position-quiz-data';
interface PlacementGridProps {
    gridMode: GridMode;
    onPlacementComplete: (left: HandPosition, right: HandPosition) => void;
    disabled?: boolean;
    showGuideLines?: boolean;
    guideLineType?: 'alpha' | 'beta' | 'gamma';
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
  // Grid point coordinates - from the actual pictograph system
  // (gridCoordinates.ts hand_points.normal)
  // =========================================================================

  interface GridPoint {
    x: number;
    y: number;
    label: string;
    position: HandPosition;
    gridLocation: GridLocation;
  }

  const DIAMOND_HAND_POINTS: GridPoint[] = [
    { x: 475.0, y: 331.9, label: 'North', position: 'N', gridLocation: GridLocation.NORTH },
    { x: 618.1, y: 475.0, label: 'East', position: 'E', gridLocation: GridLocation.EAST },
    { x: 475.0, y: 618.1, label: 'South', position: 'S', gridLocation: GridLocation.SOUTH },
    { x: 331.9, y: 475.0, label: 'West', position: 'W', gridLocation: GridLocation.WEST },
  ];

  const BOX_HAND_POINTS: GridPoint[] = [
    { x: 576.2, y: 373.8, label: 'Northeast', position: 'NE', gridLocation: GridLocation.NORTHEAST },
    { x: 576.2, y: 576.2, label: 'Southeast', position: 'SE', gridLocation: GridLocation.SOUTHEAST },
    { x: 373.8, y: 576.2, label: 'Southwest', position: 'SW', gridLocation: GridLocation.SOUTHWEST },
    { x: 373.8, y: 373.8, label: 'Northwest', position: 'NW', gridLocation: GridLocation.NORTHWEST },
  ];

  // All coords for guide line geometry
  const ALL_COORDS: Record<HandPosition, { x: number; y: number }> = {
    N: { x: 475.0, y: 331.9 },
    NE: { x: 576.2, y: 373.8 },
    E: { x: 618.1, y: 475.0 },
    SE: { x: 576.2, y: 576.2 },
    S: { x: 475.0, y: 618.1 },
    SW: { x: 373.8, y: 576.2 },
    W: { x: 331.9, y: 475.0 },
    NW: { x: 373.8, y: 373.8 },
  };

  // Map HandPosition strings to GridLocation enum values
  const HAND_TO_LOCATION: Record<HandPosition, GridLocation> = {
    N: GridLocation.NORTH,
    E: GridLocation.EAST,
    S: GridLocation.SOUTH,
    W: GridLocation.WEST,
    NE: GridLocation.NORTHEAST,
    SE: GridLocation.SOUTHEAST,
    SW: GridLocation.SOUTHWEST,
    NW: GridLocation.NORTHWEST,
  };

  // =========================================================================
  // Placement state machine
  // =========================================================================

  type PlacementState = 'empty' | 'blue-placed' | 'both-placed';

  let placementState = $state<PlacementState>('empty');
  let bluePosition = $state<HandPosition | null>(null);
  let redPosition = $state<HandPosition | null>(null);

  let hapticService: { trigger: (type: string) => void } | null = null;
  try {
    hapticService = getHapticFeedback() as {
      trigger: (type: string) => void;
    } | null;
  } catch {
    // Not available on desktop
  }

  // =========================================================================
  // Derived
  // =========================================================================

  const activePoints = $derived(
    gridMode === GridMode.DIAMOND ? DIAMOND_HAND_POINTS : BOX_HAND_POINTS,
  );

  const promptText = $derived.by(() => {
    if (disabled) return '';
    if (placementState === 'empty') return 'Tap where the blue hand goes';
    if (placementState === 'blue-placed') return 'Now tap where the red hand goes';
    return '';
  });

  // Pulsing color: blue initially, red after blue is placed
  const pulseColor = $derived(
    placementState === 'empty' ? '#4A9EFF' : '#FF4A4A',
  );

  // During placement, ALL points pulse (including where blue is)
  function shouldPulse(_pos: HandPosition): boolean {
    if (disabled || placementState === 'both-placed') return false;
    return true;
  }

  // =========================================================================
  // Build PictographData dynamically based on placement state
  // PictographContainer handles all hand rendering at correct scale/position
  // =========================================================================

  function buildMotion(location: GridLocation, color: MotionColor) {
    return createMotionData({
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: location,
      endLocation: location,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      isVisible: true,
      propType: PropType.HAND,
      arrowLocation: location,
      color,
      gridMode,
    });
  }

  const pictographData: PictographData | null = $derived.by(() => {
    // No hands placed - show grid only (no motions)
    if (placementState === 'empty' || !bluePosition) {
      return {
        id: 'placement-grid-empty',
        letter: null,
        startPosition: null,
        endPosition: null,
        gridMode,
        motions: {},
      } as PictographData;
    }

    const blueLoc = HAND_TO_LOCATION[bluePosition];

    // Only blue placed
    if (placementState === 'blue-placed' || !redPosition) {
      return {
        id: `placement-grid-blue-${bluePosition}`,
        letter: null,
        startPosition: null,
        endPosition: null,
        gridMode,
        motions: {
          blue: buildMotion(blueLoc, MotionColor.BLUE),
        },
      } as PictographData;
    }

    // Both placed
    const redLoc = HAND_TO_LOCATION[redPosition];
    return {
      id: `placement-grid-${bluePosition}-${redPosition}`,
      letter: null,
      startPosition: null,
      endPosition: null,
      gridMode,
      motions: {
        blue: buildMotion(blueLoc, MotionColor.BLUE),
        red: buildMotion(redLoc, MotionColor.RED),
      },
    } as PictographData;
  });

  // =========================================================================
  // Handlers
  // =========================================================================

  function handlePointSelect(point: GridPoint) {
    if (disabled || placementState === 'both-placed') return;

    if (placementState === 'empty') {
      bluePosition = point.position;
      placementState = 'blue-placed';
      hapticService?.trigger('selection');
      announceStatus(`Blue hand placed at ${point.label}. Now tap where the red hand goes.`);
      return;
    }

    if (placementState === 'blue-placed') {
      redPosition = point.position;
      placementState = 'both-placed';
      hapticService?.trigger('selection');
      const bluePosLabel = activePoints.find(p => p.position === bluePosition)?.label;
      announceStatus(`Red hand placed at ${point.label}. Blue at ${bluePosLabel}, red at ${point.label}.`);
      onPlacementComplete(bluePosition!, redPosition);
      return;
    }
  }

  function handleUndo() {
    bluePosition = null;
    placementState = 'empty';
    hapticService?.trigger('selection');
    announceStatus('Blue hand removed. Tap where the blue hand goes.');
  }

  function handleKeydown(event: KeyboardEvent, point: GridPoint) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePointSelect(point);
    }
  }

  // =========================================================================
  // Accessibility
  // =========================================================================

  let liveAnnouncement = $state('');
  function announceStatus(message: string) {
    liveAnnouncement = message;
  }

  // =========================================================================
  // Reset on gridMode change
  // =========================================================================

  $effect(() => {
    void gridMode;
    untrack(() => {
      placementState = 'empty';
      bluePosition = null;
      redPosition = null;
      liveAnnouncement = '';
    });
  });

  // =========================================================================
  // Visual state helpers
  // =========================================================================

  function isBlueAt(pos: HandPosition): boolean {
    return bluePosition === pos && placementState !== 'empty';
  }

  function isRedAt(pos: HandPosition): boolean {
    return redPosition === pos && placementState === 'both-placed';
  }

  // =========================================================================
  // Guide line geometry (for SemanticFeedback)
  // =========================================================================

  function getGuideCoords() {
    if (!guideLinePoints) return null;
    const left = ALL_COORDS[guideLinePoints.left];
    const right = ALL_COORDS[guideLinePoints.right];
    if (!left || !right) return null;
    return { left, right };
  }

  function computeGammaArc(): string {
    const coords = getGuideCoords();
    if (!coords) return '';
    const cx = 475, cy = 475, r = 60;
    const aL = Math.atan2(coords.left.y - cy, coords.left.x - cx);
    const aR = Math.atan2(coords.right.y - cy, coords.right.x - cx);
    const sx = cx + r * Math.cos(aL), sy = cy + r * Math.sin(aL);
    const ex = cx + r * Math.cos(aR), ey = cy + r * Math.sin(aR);
    let diff = aR - aL;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    return `M ${sx} ${sy} A ${r} ${r} 0 0 ${diff > 0 ? 1 : 0} ${ex} ${ey}`;
  }
</script>

<div class="placement-grid" class:disabled>
  {#if promptText}
    <p class="prompt-text">{promptText}</p>
  {/if}

  <div class="grid-wrapper">
    <!-- Real pictograph renderer - handles grid, hand rendering at correct scale -->
    <div class="pictograph-layer">
      {#if pictographData}
        <PictographContainer
          {pictographData}
          gridMode={gridMode}
          showTKA={false}
          showReversals={false}
          showTnD={false}
          showElemental={false}
          showPositions={false}
          disableTransitions={true}
          cellIndex={null}
          bluePropTypeOverride={PropType.HAND}
          redPropTypeOverride={PropType.HAND}
        />
      {/if}
    </div>

    <!-- Interactive overlay - pulse indicators + click targets aligned to same 950×950 space -->
    <svg viewBox="0 0 950 950" class="interaction-overlay">
      <!-- Pulsing touch point indicators -->
      <g class="touch-indicators">
        {#each activePoints as point (point.position)}
          {#if shouldPulse(point.position)}
            <circle
              cx={point.x}
              cy={point.y}
              r={40}
              fill={pulseColor}
              class="point-glow"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={18}
              fill={pulseColor}
              opacity="0.5"
              class="point-solid"
            />
          {/if}
        {/each}
      </g>

      <!-- Invisible click targets (on top, large for easy tapping) -->
      <g class="click-targets">
        {#each activePoints as point (point.position)}
          <circle
            cx={point.x}
            cy={point.y}
            r={75}
            fill="transparent"
            class="click-target"
            class:tappable={!disabled && placementState !== 'both-placed'}
            onclick={() => handlePointSelect(point)}
            onkeydown={(e) => handleKeydown(e, point)}
            role="button"
            tabindex={disabled ? -1 : 0}
            aria-label="{point.label} point{isBlueAt(point.position) ? ' (blue hand)' : ''}{isRedAt(point.position) ? ' (red hand)' : ''}"
            aria-disabled={disabled}
          />
        {/each}
      </g>

      <!-- Guide lines (used by SemanticFeedback in quiz phase) -->
      {#if showGuideLines && guideLineType && guideLinePoints}
        {@const coords = getGuideCoords()}
        {#if coords}
          <g class="guide-lines">
            {#if guideLineType === 'alpha'}
              <line x1={coords.left.x} y1={coords.left.y} x2={coords.right.x} y2={coords.right.y}
                stroke="rgba(0, 0, 0, 0.4)" stroke-width="4" stroke-dasharray="15 10" />
              <circle cx="475" cy="475" r="10" fill="rgba(0, 0, 0, 0.3)" />
            {:else if guideLineType === 'beta'}
              {#each [30, 50, 70] as radius, i}
                <circle cx={coords.left.x} cy={coords.left.y} r={radius}
                  fill="none" stroke="rgba(0, 0, 0, 0.3)" stroke-width="2.5"
                  class="beta-ripple" style="animation-delay: {i * 0.3}s;" />
              {/each}
            {:else if guideLineType === 'gamma'}
              <line x1="475" y1="475" x2={coords.left.x} y2={coords.left.y}
                stroke="rgba(0, 0, 0, 0.25)" stroke-width="2.5" stroke-dasharray="10 8" />
              <line x1="475" y1="475" x2={coords.right.x} y2={coords.right.y}
                stroke="rgba(0, 0, 0, 0.25)" stroke-width="2.5" stroke-dasharray="10 8" />
              <path d={computeGammaArc()} fill="none" stroke="rgba(0, 0, 0, 0.4)" stroke-width="4" />
              <text x="475" y="450" text-anchor="middle" fill="rgba(0, 0, 0, 0.4)" font-size="32">90°</text>
            {/if}
          </g>
        {/if}
      {/if}
    </svg>
  </div>

  <!-- Undo button -->
  {#if placementState === 'blue-placed' && !disabled}
    <button class="undo-button" onclick={handleUndo}>Undo</button>
  {/if}

  <!-- Accessibility: live region -->
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
    font-size: 1.1rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    text-align: center;
    font-weight: 600;
    min-height: 1.5em;
  }

  .grid-wrapper {
    width: 100%;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 16px var(--theme-shadow, rgba(0, 0, 0, 0.3));
    position: relative;
  }

  /* PictographContainer fills the wrapper */
  .pictograph-layer {
    width: 100%;
    aspect-ratio: 1;
  }

  /* Interactive overlay sits on top of the pictograph, same dimensions */
  .interaction-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* Pulsing glow on tappable points */
  .point-glow {
    opacity: 0.15;
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 0.12; }
    50% { opacity: 0.3; }
  }

  .point-solid {
    transition: opacity 0.15s ease;
  }

  /* Click targets - invisible, generous size for mobile */
  .click-target {
    cursor: default;
    pointer-events: auto;
  }

  .click-target.tappable {
    cursor: pointer;
  }

  .click-target.tappable:hover {
    fill: rgba(255, 255, 255, 0.06);
  }

  .click-target:focus-visible {
    outline: none;
    stroke: var(--prop-blue, #2e31be);
    stroke-width: 3;
    stroke-dasharray: 10 5;
  }

  /* Guide line ripple */
  .beta-ripple {
    animation: ripple-expand 1.5s ease-out infinite;
  }

  @keyframes ripple-expand {
    0% { opacity: 0.4; }
    100% { opacity: 0; }
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

  @media (prefers-reduced-motion: reduce) {
    .point-glow { animation: none; opacity: 0.2; }
    .beta-ripple { animation: none; }
    .undo-button { transition: none; }
  }
</style>

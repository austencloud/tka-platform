<script lang="ts">
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    GridLocation,
    type GridMode,
    type GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import {
    MotionType,
    RotationDirection,
    Orientation,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { CardOrientations, OrientationOption } from "../domain/level5-lab-types";
  import {
    POSITION_LOCATIONS,
    RADIAL_ORIENTATIONS,
    COMPASS_ORIENTATIONS,
    formatPosition,
    isHandAtCenter,
    isCenterOrientation,
    getGridModeForPosition,
  } from "../domain/level5-position-data";

  let {
    position,
    orientations,
    onOrientationChange,
    bluePropType,
    redPropType,
  } = $props<{
    position: GridPosition;
    orientations: CardOrientations;
    onOrientationChange: (position: GridPosition, hand: "blue" | "red", value: Orientation) => void;
    bluePropType: PropType;
    redPropType: PropType;
  }>();

  // Derive hand locations and center status from position data
  const positionLocations = $derived(
    POSITION_LOCATIONS[position as keyof typeof POSITION_LOCATIONS]
  );
  const blueLoc = $derived(positionLocations?.[0] ?? GridLocation.CENTER);
  const redLoc = $derived(positionLocations?.[1] ?? GridLocation.NORTH);
  const blueAtCenter = $derived(isHandAtCenter(position, "blue"));
  const redAtCenter = $derived(isHandAtCenter(position, "red"));
  const gridMode = $derived(getGridModeForPosition(position));

  // Which orientation options each hand gets
  const blueOptions = $derived<readonly OrientationOption[]>(
    blueAtCenter ? COMPASS_ORIENTATIONS : RADIAL_ORIENTATIONS
  );
  const redOptions = $derived<readonly OrientationOption[]>(
    redAtCenter ? COMPASS_ORIENTATIONS : RADIAL_ORIENTATIONS
  );

  // Build pictograph data reactively when orientations change
  const pictograph = $derived.by((): PictographData => {
    const effectiveBlueOri = blueAtCenter
      ? orientations.blue
      : isCenterOrientation(orientations.blue)
        ? Orientation.IN
        : orientations.blue;
    const effectiveRedOri = redAtCenter
      ? orientations.red
      : isCenterOrientation(orientations.red)
        ? Orientation.IN
        : orientations.red;

    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLoc,
      endLocation: blueLoc,
      startOrientation: effectiveBlueOri,
      endOrientation: effectiveBlueOri,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: bluePropType,
      arrowLocation: blueLoc,
      gridMode,
    });

    const redMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redLoc,
      endLocation: redLoc,
      startOrientation: effectiveRedOri,
      endOrientation: effectiveRedOri,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redPropType,
      arrowLocation: redLoc,
      gridMode,
    });

    return {
      id: `level5-${position}`,
      startPosition: position,
      endPosition: position,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    };
  });

  function formatLoc(loc: GridLocation): string {
    return loc === GridLocation.CENTER ? "C" : loc.slice(0, 2).toUpperCase();
  }
</script>

<article class="card">
  <div class="pictograph-area">
    <PictographContainer pictographData={pictograph} {gridMode} />
  </div>

  <!-- Per-card orientation pickers -->
  <div class="orientation-row">
    <div class="hand-ori blue">
      <span class="hand-label">B</span>
      <div class="ori-chips" class:compass={blueAtCenter}>
        {#each blueOptions as ori (ori.value)}
          <button
            class="ori-chip"
            class:active={orientations.blue === ori.value}
            onclick={() => onOrientationChange(position, "blue", ori.value)}
            title={ori.label}
          >
            <i
              class="fas {ori.icon}"
              aria-hidden="true"
              style={ori.rotation ? `transform: rotate(${ori.rotation}deg)` : ""}
            ></i>
          </button>
        {/each}
      </div>
    </div>
    <div class="hand-ori red">
      <span class="hand-label">R</span>
      <div class="ori-chips" class:compass={redAtCenter}>
        {#each redOptions as ori (ori.value)}
          <button
            class="ori-chip"
            class:active={orientations.red === ori.value}
            onclick={() => onOrientationChange(position, "red", ori.value)}
            title={ori.label}
          >
            <i
              class="fas {ori.icon}"
              aria-hidden="true"
              style={ori.rotation ? `transform: rotate(${ori.rotation}deg)` : ""}
            ></i>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <footer class="card-footer">
    <span class="position-name">{formatPosition(position)}</span>
    <div class="locations">
      <span class="loc blue">{formatLoc(blueLoc)}</span>
      <span class="loc red">{formatLoc(redLoc)}</span>
    </div>
  </footer>
</article>

<style>
  .card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    overflow: hidden;
    transition: border-color var(--duration-fast) ease;
  }

  .card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .pictograph-area {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    aspect-ratio: 1;
  }

  /* ── Per-card orientation pickers ─────────────────────────── */

  .orientation-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.15);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
  }

  .hand-ori {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .hand-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    width: 1rem;
    text-align: center;
    flex-shrink: 0;
  }

  .hand-ori.blue .hand-label {
    color: #60a5fa;
  }

  .hand-ori.red .hand-label {
    color: #f87171;
  }

  .ori-chips {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }

  .ori-chip {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--theme-text-secondary, #888);
    font-size: 0.625rem;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
    padding: 0;
  }

  .ori-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, #fff);
  }

  .ori-chip.active {
    background: rgba(255, 255, 255, 0.12);
    color: var(--theme-text, #fff);
  }

  .hand-ori.blue .ori-chip.active {
    background: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
  }

  .hand-ori.red .ori-chip.active {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .ori-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 1px;
  }

  .ori-chip i {
    font-size: 0.625rem;
  }

  /* ── Footer ───────────────────────────────────────────────── */

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.05));
  }

  .position-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
  }

  .locations {
    display: flex;
    gap: 0.375rem;
  }

  .loc {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .loc.blue {
    background: rgba(96, 165, 250, 0.15);
    color: #60a5fa;
  }

  .loc.red {
    background: rgba(248, 113, 113, 0.15);
    color: #f87171;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .ori-chip {
      transition: none;
    }
  }
</style>

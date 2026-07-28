<script lang="ts">
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import PropPlacementGrid from "$lib/shared/pictograph/grid/components/PropPlacementGrid.svelte";
  import type { PropPlacementChange } from "$lib/shared/pictograph/grid/domain/prop-placement";
  import type {
    GridLocation,
    GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    MotionColor,
    type Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import OrientationCycler from "./OrientationCycler.svelte";
  import { getStartPositionDisplayLabel } from "../services/start-position-display-label";

  let {
    gridMode,
    bluePropType,
    redPropType,
    blueOrientation,
    redOrientation,
    initialBlueLocation = null,
    initialRedLocation = null,
    onBlueOrientationChange,
    onRedOrientationChange,
    onApply,
  } = $props<{
    gridMode: GridMode;
    bluePropType: PropType;
    redPropType: PropType;
    blueOrientation: Orientation;
    redOrientation: Orientation;
    initialBlueLocation?: GridLocation | null;
    initialRedLocation?: GridLocation | null;
    onBlueOrientationChange: (orientation: Orientation) => void | Promise<void>;
    onRedOrientationChange: (orientation: Orientation) => void | Promise<void>;
    onApply: (position: PictographData) => void | Promise<void>;
  }>();

  let blueLocation = $state<GridLocation | null>(initialBlueLocation);
  let redLocation = $state<GridLocation | null>(initialRedLocation);
  let isApplying = $state(false);

  const builtPictograph = $derived.by(() => {
    if (!blueLocation || !redLocation) return null;

    return startPositionManager.createStartPositionFromLocations({
      blueLocation,
      redLocation,
      gridMode,
      blueOrientation,
      redOrientation,
      bluePropType,
      redPropType,
      id: "start-built-position",
    });
  });

  const positionLabel = $derived(
    builtPictograph ? getStartPositionDisplayLabel(builtPictograph) : ""
  );

  function handlePlacementChange(change: PropPlacementChange) {
    blueLocation = change.blueLocation;
    redLocation = change.redLocation;
  }

  /** A drag on the grid commits through the same per-hand handlers the cyclers
   *  use, so the cyclers stay in step with whatever the drag just aimed. */
  function handleOrientationChange(
    color: MotionColor,
    orientation: Orientation
  ) {
    if (color === MotionColor.BLUE) {
      void onBlueOrientationChange(orientation);
    } else {
      void onRedOrientationChange(orientation);
    }
  }

  async function handleApply() {
    if (!builtPictograph || isApplying) return;
    isApplying = true;
    try {
      await onApply(builtPictograph);
    } finally {
      isApplying = false;
    }
  }
</script>

<div class="position-builder" data-testid="build-start-position">
  <div class="placement-area">
    <PropPlacementGrid
      {gridMode}
      {bluePropType}
      {redPropType}
      {blueOrientation}
      {redOrientation}
      {initialBlueLocation}
      {initialRedLocation}
      editAfterCompletion
      onChange={handlePlacementChange}
      onOrientationChange={handleOrientationChange}
    />
  </div>

  <div class="recognition" aria-live="polite" aria-atomic="true">
    {#if builtPictograph}
      <span class="recognition-kicker">You built</span>
      <strong>{positionLabel}</strong>
    {:else}
      <span>Place both props to recognize the position.</span>
    {/if}
  </div>

  <div class="orientation-controls" aria-label="Prop orientations">
    <OrientationCycler
      orientation={blueOrientation}
      onOrientationChange={onBlueOrientationChange}
      color="blue"
    />
    <OrientationCycler
      orientation={redOrientation}
      onOrientationChange={onRedOrientationChange}
      color="red"
    />
  </div>

  <button
    class="apply-button"
    disabled={!builtPictograph || isApplying}
    onclick={handleApply}
  >
    {isApplying ? "Applying…" : "Use this position"}
  </button>
</div>

<style>
  .position-builder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 8px clamp(12px, 3vmin, 28px);
    box-sizing: border-box;
  }

  .placement-area {
    flex: 1;
    width: 100%;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .recognition {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
    min-height: 28px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  .recognition-kicker {
    color: var(--theme-text-dim);
  }

  .recognition strong {
    color: var(--theme-text);
    font-family: "Playfair Display", Georgia, serif;
    font-size: 1.35rem;
  }

  .apply-button {
    width: min(100%, 360px);
    min-height: var(--min-touch-target, 48px);
    padding: 10px 18px;
    border: 1.5px solid
      color-mix(in srgb, var(--theme-accent) 72%, var(--theme-stroke));
    border-radius: 12px;
    background: var(--theme-accent);
    color: var(--theme-on-accent, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    cursor: pointer;
  }

  .orientation-controls {
    display: flex;
    align-items: stretch;
    gap: 8px;
    width: min(100%, 360px);
  }

  .orientation-controls :global(.orientation-cycler) {
    flex: 1;
  }

  .apply-button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .apply-button:focus-visible {
    outline: 2px solid var(--theme-text);
    outline-offset: 2px;
  }

  /* Big-screen tiers, matching the picker's 1680 seam so the builder's controls
     grow with the shell instead of staying phone-sized on a 4K display. */
  @media (min-width: 1680px) {
    .position-builder {
      gap: 1rem;
    }

    .apply-button,
    .orientation-controls {
      width: min(100%, 32rem);
    }

    .apply-button {
      min-height: 3.5rem;
      font-size: 1.05rem;
    }

    .recognition {
      font-size: 1.05rem;
      min-height: 2.25rem;
    }

    .recognition strong {
      font-size: 2rem;
    }
  }

  @media (min-width: 2600px) {
    .apply-button,
    .orientation-controls {
      width: min(100%, 44rem);
    }

    .apply-button {
      min-height: 4.5rem;
      font-size: 1.4rem;
      border-radius: 16px;
    }

    .recognition {
      font-size: 1.4rem;
    }

    .recognition strong {
      font-size: 2.75rem;
    }
  }
</style>

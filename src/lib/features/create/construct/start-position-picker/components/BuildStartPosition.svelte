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
  let activeColor = $state<MotionColor | null>(null);
  let canUndo = $state(false);
  let grid = $state<ReturnType<typeof PropPlacementGrid> | null>(null);

  // The layout mode is measured rather than left purely to a container query,
  // because it decides WHERE the move/undo controls render, not just how things
  // are arranged. Same thresholds as the stylesheet's row rule.
  let builderWidth = $state(0);
  let builderHeight = $state(0);
  const isRowLayout = $derived(
    builderWidth >= 496 && builderHeight > 0 && builderWidth / builderHeight >= 1.25
  );

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

  // Both props can be placed in a combination that has no canonical letter, so
  // the label is not a stand-in for "is it built" — fall back to the generic
  // wording rather than shipping a button that reads "Use ".
  const applyLabel = $derived(
    isApplying
      ? "Applying…"
      : positionLabel
        ? `Use ${positionLabel}`
        : "Use this position"
  );

  function handlePlacementChange(change: PropPlacementChange) {
    blueLocation = change.blueLocation;
    redLocation = change.redLocation;
    activeColor = change.activeColor;
    canUndo = change.canUndo;
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

<!-- The outer element is only the size container; the inner one does the
     laying out. An element can't be restyled by its own container query, so
     with the flex on the outer div the wide/short rule silently applied to the
     children and skipped the direction change on the parent. -->
<div
  class="position-builder"
  data-testid="build-start-position"
  bind:clientWidth={builderWidth}
  bind:clientHeight={builderHeight}
>
  <div class="builder-layout">
  <div class="placement-area">
    <PropPlacementGrid
      bind:this={grid}
      {gridMode}
      {bluePropType}
      {redPropType}
      {blueOrientation}
      {redOrientation}
      {initialBlueLocation}
      {initialRedLocation}
      editAfterCompletion
      renderTray={!isRowLayout}
      onChange={handlePlacementChange}
      onOrientationChange={handleOrientationChange}
    />
  </div>

  <!-- Grouped so a wide, short host can stand them beside the board instead of
       stacking everything into a strip that leaves the board no height. -->
  <div class="builder-controls">
    <!-- Side by side, these live here rather than in a row under the board:
         the column has height going spare and the board does not. -->
    {#if isRowLayout}
      <div class="move-controls" role="group" aria-label="Move a prop">
        {#if builtPictograph}
          <button
            class="move-button blue"
            class:active={activeColor === MotionColor.BLUE}
            aria-pressed={activeColor === MotionColor.BLUE}
            aria-label="Move left prop"
            onclick={() => grid?.moveProp(MotionColor.BLUE)}
          >
            <!-- Two labels, one accessible name — same mechanism the grid's own
                 tray uses. This column can be as narrow as 13rem, which is not
                 enough for three full labels. -->
            <span class="label-full" aria-hidden="true">Move left</span>
            <span class="label-short" aria-hidden="true">Left</span>
          </button>
          <button
            class="move-button red"
            class:active={activeColor === MotionColor.RED}
            aria-pressed={activeColor === MotionColor.RED}
            aria-label="Move right prop"
            onclick={() => grid?.moveProp(MotionColor.RED)}
          >
            <span class="label-full" aria-hidden="true">Move right</span>
            <span class="label-short" aria-hidden="true">Right</span>
          </button>
        {/if}
        {#if canUndo}
          <button
            class="move-button"
            aria-label="Undo placement"
            onclick={() => grid?.undoPlacement()}
          >
            Undo
          </button>
        {/if}
      </div>
    {/if}

    <div
      class="orientation-controls"
      role="group"
      aria-label="Prop orientations: left is blue, right is red"
    >
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

    <!-- The button names what it will do. A separate "You built α1" caption said
         the same thing one row higher, and that row cost the board more height
         than the sentence was worth on a phone. -->
    <button
      class="apply-button"
      disabled={!builtPictograph || isApplying}
      onclick={handleApply}
    >
      {applyLabel}
    </button>

    <p class="sr-only" aria-live="polite" aria-atomic="true">
      {positionLabel ? `Position recognized: ${positionLabel}.` : ""}
    </p>
  </div>
  </div>
</div>

<style>
  .position-builder {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 8px clamp(12px, 3vmin, 28px);
    box-sizing: border-box;
    container-type: size;
  }

  .builder-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  /* A size container so the grid inside can lay itself out from the room IT
     has. Keying that off the viewport was wrong for an embedded pane: the
     composer page is 1080px tall while the pane it hands the builder is ~300,
     so a viewport rule reads "plenty of height" and stacks. */
  .placement-area {
    flex: 1;
    width: 100%;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
  }

  .builder-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    width: 100%;
    flex-shrink: 0;
  }

  /* Wide AND genuinely short — the composer's embedded pane, a Fold in
     landscape. Stacking there leaves the board almost no height, so it collapses
     to a speck while half the pane sits empty beside it. Standing the controls
     alongside gives the board the whole height, which is the scarce dimension.
     The height bound matters as much as the ratio: a full-height desktop pane is
     also "wide", but it has room to stack, and going two-column there only pulls
     the board off centre for nothing. */
  /* Board beside its controls whenever the host is meaningfully wider than it
     is tall. This used to also require `max-height: 620px` — only genuinely
     short hosts — which left a 4K display stacking: a 1539px square with a
     thousand pixels of dead rail either side and the controls huddled beneath
     it. A square board can only ever spend height, so on any wide host the
     width belongs to the controls.

     31rem, not 34: a size container reports its CONTENT box, so this element's
     own horizontal padding comes off the number the query sees. At 34rem the
     picker's two-column mode handed the builder a 559px column and the rule
     still missed by 9px, which left the board stacked and tiny. */
  @container (min-aspect-ratio: 5 / 4) and (min-width: 31rem) {
    .builder-layout {
      flex-direction: row;
      align-items: stretch;
      justify-content: center;
      gap: clamp(12px, 2.5cqw, 28px);
    }

    /* The board is square and bounded by height here, so its column never needs
       to be wider than the builder is tall. Sizing it off `cqh` makes it hug the
       board; left to flex it claimed the whole row and stranded the controls at
       the far edge with a canyon between them. */
    .placement-area {
      flex: 0 0 auto;
      width: min(100%, 100cqh);
      min-width: 0;
      height: 100%;
    }

    .builder-controls {
      flex: 0 1 clamp(13rem, 38cqw, 24rem);
      justify-content: center;
      min-width: 0;
    }

    /* Side by side, the two cyclers split a ~200px column and the arrows crowd
       the word between them. The column has height to spare, so they stack. */
    .orientation-controls {
      flex-direction: column;
      width: 100%;
    }

    /* The prompt sits in the narrow left column here, where it wrapped to two
       lines and took that height straight off the board. One line instead. */
    .placement-area :global(.prompt-text) {
      font-size: var(--font-size-min, 13px);
      min-height: 0;
    }
  }

  /* Vertically tight — a phone in portrait, or any host that hands the builder
     less height than the controls plus a usable board want. Every gap here is
     height the board doesn't get, and the board is the thing being used. */
  @container (max-height: 560px) {
    .builder-layout {
      gap: 6px;
    }

    .builder-controls {
      gap: 6px;
    }
  }


  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
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

  /* Reserved whether or not it currently holds buttons, so the controls below
     it do not jump as props are placed. */
  .move-controls {
    display: flex;
    gap: 8px;
    width: min(100%, 360px);
    min-height: var(--min-touch-target, 48px);
    /* Its own size container, so the buttons inside can be asked how much room
       the ROW has. Safe to contain here: this row only renders in the two-column
       layout, where its width comes from the column's definite basis rather than
       from its contents. Named, so the grid's own queries can't land on it. */
    container-type: inline-size;
    container-name: move-row;
  }

  .move-controls > * {
    flex: 1;
    min-width: 0;
  }

  .move-button {
    min-height: var(--min-touch-target, 48px);
    padding: 8px 10px;
    white-space: nowrap;
    /* Last-resort containment. The query below is what actually keeps the label
       inside the button; without these two the overflow spilled across the
       neighbouring button's border instead of being clipped. */
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1.5px solid var(--theme-stroke);
    border-radius: 10px;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
    cursor: pointer;
  }

  /* Prop colour is identity, carried before selection, deepened by it
     (`chip-primitives.md`). */
  .move-button.blue {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #3b82f6) 45%,
      var(--theme-stroke)
    );
    color: color-mix(in srgb, var(--prop-blue, #3b82f6) 45%, var(--theme-text));
  }

  .move-button.red {
    border-color: color-mix(
      in srgb,
      var(--prop-red, #ef4444) 45%,
      var(--theme-stroke)
    );
    color: color-mix(in srgb, var(--prop-red, #ef4444) 45%, var(--theme-text));
  }

  .move-button.blue.active {
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #3b82f6) 70%,
      var(--theme-stroke)
    );
    background: color-mix(in srgb, var(--prop-blue, #3b82f6) 15%, transparent);
    color: var(--theme-text);
  }

  .move-button.red.active {
    border-color: color-mix(
      in srgb,
      var(--prop-red, #ef4444) 70%,
      var(--theme-stroke)
    );
    background: color-mix(in srgb, var(--prop-red, #ef4444) 15%, transparent);
    color: var(--theme-text);
  }

  .move-button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .label-short {
    display: none;
  }

  /* Three full labels need about 19rem of row. This column bottoms out at 13rem,
     which is where "Move left" started spilling out of its button. `em`, not px,
     so the threshold tracks a boosted browser font instead of being outrun by
     it. */
  @container move-row (max-width: 21em) {
    .move-button {
      padding: 8px 6px;
    }

    .label-full {
      display: none;
    }

    .label-short {
      display: inline;
    }
  }

  /* The big-screen tiers below step the button font without touching the root,
     so the label outgrows a threshold pinned to root `em`. Each tier restates
     the switch at the width its own type actually needs. */
  @media (min-width: 1680px) {
    @container move-row (max-width: 23em) {
      .label-full {
        display: none;
      }

      .label-short {
        display: inline;
      }
    }
  }

  @media (min-width: 2600px) {
    @container move-row (max-width: 27em) {
      .label-full {
        display: none;
      }

      .label-short {
        display: inline;
      }
    }
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
      /* The shared content band. Left to span a 4K display the board and its
         controls drift to opposite edges with a canyon between them; centred in
         the band they read as one composed pair. */
      max-width: var(--shell-w, min(1720px, 92vw));
      margin-inline: auto;
    }

    .builder-controls {
      flex-basis: clamp(20rem, 30cqw, 34rem);
    }

    /* One width for the whole column. The move row used to take the full 100%
       while its two neighbours capped at 32rem, so at 2560 it stuck out 32px
       past the button below it. */
    .move-controls,
    .apply-button,
    .orientation-controls {
      width: min(100%, 32rem);
    }

    .apply-button {
      min-height: 3.5rem;
      font-size: 1.05rem;
    }

    /* The move row was the one control in this column that never stepped: at
       1920 it sat at 44px/14px between 46px cyclers and a 56px action button,
       reading as a leftover from the phone layout. Same numbers the grid's own
       tray uses at this seam. */
    .move-controls {
      min-height: 3.25rem;
    }

    .move-button {
      min-height: 3.25rem;
      font-size: 1.05rem;
    }
  }

  @media (min-width: 2600px) {
    /* A square board can always spend more height than anyone needs. Past this
       it stops being a better target and becomes a bigger black field, and it
       starves the controls beside it. Bounded to the viewport's short side so
       it still steps up on a 4K display without running away. Only at this tier
       — below it the board is the scarce thing, not the abundant one. */
    .placement-area {
      max-width: min(100%, 52vmin);
    }

    .move-controls,
    .apply-button,
    .orientation-controls {
      width: min(100%, 44rem);
    }

    .apply-button {
      min-height: 4.5rem;
      font-size: 1.4rem;
      border-radius: 16px;
    }

    .move-controls {
      min-height: 4rem;
    }

    .move-button {
      min-height: 4rem;
      font-size: 1.3rem;
      border-radius: 14px;
    }
  }
</style>

<script lang="ts">
  import {
    startPositionManager,
    type StartPositionPlacement,
  } from "$lib/shared/create/services/start-position-manager";
  import PropPlacementGrid from "$lib/shared/pictograph/grid/components/PropPlacementGrid.svelte";
  import type { PropPlacementChange } from "$lib/shared/pictograph/grid/domain/prop-placement";
  import {
    GridLocation,
    type GridMode,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { normalizeOrientationForLocation } from "$lib/shared/pictograph/grid/domain/orientation-from-drag";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    HandSide,
    type Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import GridModeToggle from "../../shared/components/GridModeToggle.svelte";
  import OrientationCycler from "./OrientationCycler.svelte";
  import { getStartPositionDisplayLabel } from "../services/start-position-display-label";

  let {
    gridMode,
    leftPropType,
    rightPropType,
    leftOrientation,
    rightOrientation,
    initialLeftLocation = null,
    initialRightLocation = null,
    showCenter = false,
    onLeftOrientationChange,
    onRightOrientationChange,
    onGridModeChange,
    onApply,
    onApplyPlacement,
  } = $props<{
    gridMode: GridMode;
    leftPropType: PropType;
    rightPropType: PropType;
    leftOrientation: Orientation;
    rightOrientation: Orientation;
    initialLeftLocation?: GridLocation | null;
    initialRightLocation?: GridLocation | null;
    showCenter?: boolean;
    onLeftOrientationChange: (orientation: Orientation) => void | Promise<void>;
    onRightOrientationChange: (orientation: Orientation) => void | Promise<void>;
    onGridModeChange?: (gridMode: GridMode) => void | Promise<void>;
    onApply?: (position: PictographData) => void | Promise<void>;
    onApplyPlacement?: (
      placement: StartPositionPlacement
    ) => void | Promise<void>;
  }>();

  let leftLocation = $state<GridLocation | null>(initialLeftLocation);
  let rightLocation = $state<GridLocation | null>(initialRightLocation);
  let isApplying = $state(false);
  let activeColor = $state<HandSide | null>(null);
  let canUndo = $state(false);
  let grid = $state<ReturnType<typeof PropPlacementGrid> | null>(null);

  // The layout mode is measured rather than left purely to a container query,
  // because it decides WHERE the move/undo controls render, not just how things
  // are arranged. Same thresholds as the stylesheet's row rule.
  let builderWidth = $state(0);
  let builderHeight = $state(0);
  const isRowLayout = $derived(
    builderWidth >= 600 &&
      builderHeight > 0 &&
      builderWidth / builderHeight >= 1.25
  );

  const builtPlacement = $derived.by((): StartPositionPlacement | null => {
    if (!leftLocation || !rightLocation) return null;

    return {
      leftLocation,
      rightLocation,
      gridMode,
      leftOrientation: normalizeOrientationForLocation(
        leftOrientation,
        leftLocation
      ),
      rightOrientation: normalizeOrientationForLocation(
        rightOrientation,
        rightLocation
      ),
      leftPropType,
      rightPropType,
      id: "start-built-position",
    };
  });

  const builtPictograph = $derived.by(() => {
    if (!builtPlacement) return null;
    // Center placements do not have a canonical TKA position name. Assemble
    // accepts the two poses directly, while Construct still requires one.
    if (
      builtPlacement.leftLocation === GridLocation.CENTER ||
      builtPlacement.rightLocation === GridLocation.CENTER
    ) {
      return null;
    }
    return startPositionManager.createStartPositionFromLocations(
      builtPlacement
    );
  });

  const canApply = $derived(
    builtPlacement !== null &&
      (onApplyPlacement !== undefined ||
        (onApply !== undefined && builtPictograph !== null))
  );

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
    leftLocation = change.leftLocation;
    rightLocation = change.rightLocation;
    activeColor = change.activeColor;
    canUndo = change.canUndo;
  }

  /** A drag on the grid commits through the same per-hand handlers the cyclers
   *  use, so the cyclers stay in step with whatever the drag just aimed. */
  function handleOrientationChange(
    color: HandSide,
    orientation: Orientation
  ) {
    if (color === HandSide.LEFT) {
      void onLeftOrientationChange(orientation);
    } else {
      void onRightOrientationChange(orientation);
    }
  }

  async function handleApply() {
    if (!builtPlacement || !canApply || isApplying) return;
    isApplying = true;
    try {
      if (onApplyPlacement) {
        await onApplyPlacement(builtPlacement);
      } else if (onApply && builtPictograph) {
        await onApply(builtPictograph);
      }
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
        {leftPropType}
        {rightPropType}
        {leftOrientation}
        {rightOrientation}
        {initialLeftLocation}
        {initialRightLocation}
        {showCenter}
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
          {#if builtPlacement}
            <button
              class="move-button blue"
              class:active={activeColor === HandSide.LEFT}
              aria-pressed={activeColor === HandSide.LEFT}
              aria-label="Move left prop"
              onclick={() => grid?.moveProp(HandSide.LEFT)}
            >
              <!-- Two labels, one accessible name — same mechanism the grid's own
                 tray uses. This column can be as narrow as 13rem, which is not
                 enough for three full labels. -->
              <span class="label-full" aria-hidden="true">Move left</span>
              <span class="label-short" aria-hidden="true">Left</span>
            </button>
            <button
              class="move-button red"
              class:active={activeColor === HandSide.RIGHT}
              aria-pressed={activeColor === HandSide.RIGHT}
              aria-label="Move right prop"
              onclick={() => grid?.moveProp(HandSide.RIGHT)}
            >
              <span class="label-full" aria-hidden="true">Move right</span>
              <span class="label-short" aria-hidden="true">Right</span>
            </button>
          {/if}
          {#if canUndo}
            <button
              data-undo-shortcut
              data-undo-shortcut-label="Placement"
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
          orientation={leftOrientation}
          onOrientationChange={onLeftOrientationChange}
          color="blue"
          centered={leftLocation === GridLocation.CENTER}
        />
        <OrientationCycler
          orientation={rightOrientation}
          onOrientationChange={onRightOrientationChange}
          color="red"
          centered={rightLocation === GridLocation.CENTER}
        />
      </div>

      {#if onGridModeChange}
        <div class="grid-mode-control">
          <GridModeToggle
            currentGridMode={gridMode}
            onGridModeChange={(mode) => void onGridModeChange(mode)}
          />
        </div>
      {/if}

      <!-- The button names what it will do. A separate "You built α1" caption said
         the same thing one row higher, and that row cost the board more height
         than the sentence was worth on a phone. -->
      <button
        class="apply-button"
        class:full-width={!onGridModeChange}
        disabled={!canApply || isApplying}
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
    --builder-support-width: clamp(15rem, 28cqw, 24rem);
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 8px 12px;
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
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 8px;
    /* The stacked board is height-bound on short screens. Keeping its controls
       on the same rail stops two short labels from stretching across empty
       space and makes the board read as the primary target. */
    width: min(100%, 22.5rem);
    flex-shrink: 0;
  }

  .orientation-controls {
    grid-column: 1 / -1;
  }

  .grid-mode-control,
  .apply-button {
    min-width: 0;
  }

  .apply-button.full-width {
    grid-column: 1 / -1;
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

     The script sees the padded 600px client box. A size query sees the content
     box, which is exactly 24px narrower here, so 36rem is the matching CSS-side
     threshold. Below that, the board and control card stay stacked. */
  @container (min-aspect-ratio: 5 / 4) and (min-width: 36rem) {
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
      flex: 1 1 24rem;
      width: auto;
      max-width: 100cqh;
      min-width: 15rem;
      height: 100%;
    }

    .builder-controls {
      flex: 0 1 var(--builder-support-width);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      align-self: center;
      gap: 10px;
      width: auto;
      min-width: 15rem;
      padding: clamp(14px, 2.25cqw, 28px);
      box-sizing: border-box;
      border: 1.5px solid var(--theme-stroke);
      border-radius: 18px;
      background: color-mix(
        in srgb,
        var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 94%,
        transparent
      );
      box-shadow: 0 12px 32px
        color-mix(in srgb, var(--theme-shadow, black) 44%, transparent);
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
    width: 100%;
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
    width: 100%;
  }

  /* Reserved whether or not it currently holds buttons, so the controls below
     it do not jump as props are placed. */
  .move-controls {
    display: flex;
    gap: 8px;
    width: 100%;
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

  .grid-mode-control {
    display: flex;
    width: 100%;
  }

  .grid-mode-control :global(.grid-mode-toggle) {
    width: 100%;
    border-radius: 12px;
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
      --builder-support-width: clamp(20rem, 30cqw, 34rem);
      /* The shared content band. Left to span a 4K display the board and its
         controls drift to opposite edges with a canyon between them; centred in
         the band they read as one composed pair. */
      max-width: var(--shell-w, min(1720px, 92vw));
      margin-inline: auto;
    }

    /* One width for the whole column. The move row used to take the full 100%
       while its two neighbours capped at 32rem, so at 2560 it stuck out 32px
       past the button below it. */
    .move-controls,
    .apply-button,
    .orientation-controls,
    .grid-mode-control {
      width: min(100%, 32rem);
      align-self: center;
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
    .position-builder {
      --builder-support-width: clamp(28rem, 24cqw, 44rem);
    }

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
    .orientation-controls,
    .grid-mode-control {
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

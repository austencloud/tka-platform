<!--
  OptionPickerHeader.svelte

  Shared controls for the construct option picker. The wide layout renders this
  as its pinned header; narrow layouts render the compact variant inside the
  option-controls popover. Both surfaces expose the same settings:
    • the All / Continuous filter (left),
    • the working Level (centered, wearing the canonical level colours),
  over a turns row that appears when the level HAS turns.

  Level gates the turn palette, per TKA canon (shared table in
  level-turn-values.ts): L1 base motions only, L2 whole turns, L3 half turns +
  floats. Every legal value is its own button — no stepper to click through, and
  the float that the stepper could never reach is now one tap.

  No Turns disclosure toggle and no Reset: Level already decides whether turns
  exist (L1 = none, so the row is simply absent), and resetting is two taps on
  the 0 buttons. Both were chrome that restated a control already on screen.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import LevelSelector from "$lib/shared/components/LevelSelector.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { growFade, popIn, flyFade } from "$lib/shared/transitions/motion";
  import { DURATION, STAGGER } from "$lib/shared/transitions/transitions";
  import {
    formatTurnValue,
    keyToTurnValue,
    turnValueToKey,
    turnValuesForLevel,
    type TurnLevel,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";

  interface Props {
    layout?: "wide" | "compact";
    /** Embedded demos can pin turns from outside the picker. In that case the
     *  filter remains useful, but showing local turn controls would be a lie. */
    showTurnControls?: boolean;
    // Filter
    showFilter: boolean;
    isContinuousOnly: boolean;
    onToggleContinuous?: (value: boolean) => void;
    // Level — gates which turn values the hands may take
    level: TurnLevel;
    onLevelChange: (level: TurnLevel) => void;
    // Turns
    blueTurns: TurnValue;
    redTurns: TurnValue;
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    onBlueChange: (value: TurnValue) => void;
    onRedChange: (value: TurnValue) => void;
    onBlueRotationChange: (dir: RotationDirection) => void;
    onRedRotationChange: (dir: RotationDirection) => void;
  }

  const {
    layout = "wide",
    showTurnControls = true,
    showFilter,
    isContinuousOnly,
    onToggleContinuous,
    level,
    onLevelChange,
    blueTurns,
    redTurns,
    blueRotation,
    redRotation,
    onBlueChange,
    onRedChange,
    onBlueRotationChange,
    onRedRotationChange,
  }: Props = $props();

  const hasBlueTurns = $derived(blueTurns === "fl" || blueTurns > 0);
  const hasRedTurns = $derived(redTurns === "fl" || redTurns > 0);

  // Level 1 is base motions — there is nothing to dial, so the row isn't there.
  const turnsAvailable = $derived(level > 1);

  // Icon-only: Level is the headline control on this band and the filter was
  // spending 240px of it on two words. SegmentedControl renders the icon alone
  // and keeps the label as the aria-label + hover title, so nothing is lost.
  const filterOptions = $derived(
    layout === "compact"
      ? [
          { value: "all", label: "All" },
          { value: "continuous", label: "Continuous" },
        ]
      : [
          { value: "all", label: "All", icon: "fas fa-asterisk" },
          {
            value: "continuous",
            label: "Continuous",
            icon: "fas fa-infinity",
          },
        ]
  );
  const filterValue = $derived(isContinuousOnly ? "continuous" : "all");

  // One button per legal turn value at this level: L2 → 0 1 2 3,
  // L3 → 0 · 0.5 · 1 · 1.5 · 2 · 2.5 · 3 · fl.
  const turnOptions = $derived(
    turnValuesForLevel(level).map((v) => ({
      value: turnValueToKey(v),
      label: formatTurnValue(v),
    }))
  );

  function opposite(d: RotationDirection): RotationDirection {
    return d === RotationDirection.CLOCKWISE
      ? RotationDirection.COUNTER_CLOCKWISE
      : RotationDirection.CLOCKWISE;
  }
  function dirIcon(d: RotationDirection): string {
    return d === RotationDirection.CLOCKWISE
      ? "fa-rotate-right"
      : "fa-rotate-left";
  }
  function dirLabel(d: RotationDirection): string {
    return d === RotationDirection.CLOCKWISE ? "CW" : "CCW";
  }
</script>

<div class="oph" class:compact={layout === "compact"}>
  <!-- Row 1: filter left, Level dead center. The right cell is an empty
       counterweight — equal-fr sides are what keep Level centered on the band
       rather than centered on "whatever is left over". -->
  <div
    class="oph-bar"
    class:filter-only={!showTurnControls}
    class:turns-only={!showFilter && showTurnControls}
  >
    <div class="oph-side start">
      {#if showFilter}
        <div class="filter-seg" role="group" aria-label="Option filter">
          {#if layout === "compact"}
            <span class="control-label">Options</span>
          {/if}
          <SegmentedControl
            options={filterOptions}
            value={filterValue}
            size="sm"
            color="accent"
            onchange={(v) => onToggleContinuous?.(v === "continuous")}
          />
        </div>
      {/if}
    </div>

    {#if showTurnControls}
      <!-- Level decides which turn buttons exist below, so it gets the center
           and the level colour system rather than neutral filter chrome. -->
      <div class="level-control">
        {#if layout === "compact"}
          <span class="control-label">Level</span>
        {/if}
        <LevelSelector
          value={level}
          compact={layout === "compact"}
          onchange={(n) => onLevelChange(n as TurnLevel)}
          ariaLabel="Working difficulty level"
        />
      </div>

      <div class="oph-side end"></div>
    {/if}
  </div>

  <!-- Row 2: blue (left half) / red (right half), present whenever the level has
       turns. The buttons fill each half; the CW/CCW spin button is pinned to the
       half's outer (colored) edge — absolutely positioned into a gutter that is
       reserved only while that hand has turns (the .has-spin state). The gutter
       padding animates, so the button and its room appear/collapse together
       rather than snapping. -->
  {#if showTurnControls && turnsAvailable}
    <!-- growFade (not svelte's slide) so the row's own height drives the reflow
         AND reduced motion collapses it — svelte's JS transitions ignore the
         media query the CSS layer respects. -->
    <div
      class="oph-turns-row"
      transition:growFade={{ axis: "y", duration: DURATION.emphasis }}
    >
      <div
        class="hand-half blue"
        class:has-spin={hasBlueTurns}
        role="group"
        aria-label="Blue turns"
        in:flyFade={{ y: 6 }}
      >
        <div class="hand-meta">
          <!-- No Blue/Red word: the half is already blue/red (tint, border,
               selected turn indicator) and the group is aria-labeled "Blue/Red
               turns" for screen readers. Colour carries the identity. -->
          <!-- Spin direction is a real choice in BOTH modes: it's baked into
               each dash/static tile, and in Continuous it decides which
               dash/static options survive the direction-reversal filter. So the
               toggle shows whenever this hand has turns, not only in All mode. -->
          <span class="spin-slot">
            {#if hasBlueTurns}
              <button
                class="spin-inline edge"
                transition:popIn
                title="Spin direction for dash & static options on this hand (shifts keep their own direction)"
                aria-label="Toggle blue dash/static spin (currently {dirLabel(
                  blueRotation
                )})"
                onclick={() => onBlueRotationChange(opposite(blueRotation))}
              >
                <i class="fas {dirIcon(blueRotation)}" aria-hidden="true"></i>
                <span class="dir">{dirLabel(blueRotation)}</span>
              </button>
            {/if}
          </span>
        </div>
        <div class="turn-seg">
          <SegmentedControl
            options={turnOptions}
            value={turnValueToKey(blueTurns)}
            size="sm"
            color="blue"
            onchange={(v) => onBlueChange(keyToTurnValue(v))}
          />
        </div>
      </div>
      <!-- Red trails blue by one micro-beat: the two halves read as one gesture
           rather than a single slab dropping in. -->
      <div
        class="hand-half red"
        class:has-spin={hasRedTurns}
        role="group"
        aria-label="Red turns"
        in:flyFade={{ y: 6, delay: STAGGER.micro }}
      >
        <div class="hand-meta">
          <span class="spin-slot">
            {#if hasRedTurns}
              <button
                class="spin-inline edge"
                transition:popIn
                title="Spin direction for dash & static options on this hand (shifts keep their own direction)"
                aria-label="Toggle red dash/static spin (currently {dirLabel(
                  redRotation
                )})"
                onclick={() => onRedRotationChange(opposite(redRotation))}
              >
                <i class="fas {dirIcon(redRotation)}" aria-hidden="true"></i>
                <span class="dir">{dirLabel(redRotation)}</span>
              </button>
            {/if}
          </span>
        </div>
        <div class="turn-seg">
          <SegmentedControl
            options={turnOptions}
            value={turnValueToKey(redTurns)}
            size="sm"
            color="red"
            onchange={(v) => onRedChange(keyToTurnValue(v))}
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Header band: faint top gradient + hairline divider separate it from options. */
  .oph {
    display: flex;
    flex-direction: column;
    /* No gap: the row/row spacing lives on .oph-turns-row's margin-top instead,
       because growFade collapses margins with the height. A flex `gap` would
       survive the collapse and snap away 12px at the end of the transition. */
    gap: 0;
    width: 100%;
    padding: 12px 16px 14px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.045) 0%,
      rgba(255, 255, 255, 0) 100%
    );
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* Row 1: [filter | LEVEL | counterweight]. Equal-fr sides put Level on the
     band's true center; the turn buttons are NOT here — they live on row 2 — so
     this row's height never changes. */
  .oph-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    min-height: var(--min-touch-target, 44px);
  }

  .oph-side {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .oph-side.end {
    justify-content: flex-end;
  }

  .oph-bar.filter-only {
    grid-template-columns: 1fr;
  }

  .level-control {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .control-label {
    display: none;
  }

  /* Icon-sized. Two 44px targets plus the control's own padding — the ~130px
     this gives back goes to the level buttons and the turn rows. */
  .filter-seg {
    width: 7rem;
  }

  /* Row 2: two equal halves — blue (left), red (right) — revealed by sliding
     down. Each half centers [label][stepper]; the spin button is pinned to the
     half's colored edge, out of flow. */
  .oph-turns-row {
    display: flex;
    gap: 10px;
    margin-top: 12px;
  }

  .hand-half {
    position: relative;
    flex: 1 1 0;
    display: flex;
    align-items: center;
    gap: 10px;
    /* The turn buttons fill the half; the spin button is pinned out of flow on
       the colored edge. Its gutter is reserved only while this hand has turns
       (.has-spin) — the padding animates so the turn buttons slide as the gutter
       and its CW/CCW button appear or collapse together, never a snap. The
       gutter is a touch wider than the button so it clears the panel edge (outer
       inset below) AND the stepper (inner gap) instead of hugging either. */
    --spin-gutter: 88px;
    padding: 8px 12px;
    min-width: 260px;
    border-radius: 12px;
    border: 1px solid;
    transition: padding var(--duration-normal, 200ms) ease;
  }

  .hand-half.blue.has-spin {
    padding-left: var(--spin-gutter);
  }

  .hand-half.red.has-spin {
    padding-right: var(--spin-gutter);
  }

  /* One button per legal turn value — grows to fill whatever the level's palette
     needs (4 buttons at L2, 8 at L3) inside a fixed-height row. */
  .turn-seg {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* The meta wrapper is structural on compact screens. On desktop its children
     participate directly in the hand row, preserving the established layout. */
  .hand-meta,
  .spin-slot {
    display: contents;
  }

  .hand-half.blue {
    --hand-color: var(--prop-blue, #3b82f6);
    --prop-color-rgb: 59, 130, 246;
    background: linear-gradient(
      180deg,
      rgba(59, 130, 246, 0.16) 0%,
      rgba(59, 130, 246, 0.06) 100%
    );
    border-color: rgba(59, 130, 246, 0.4);
  }

  .hand-half.red {
    --hand-color: var(--prop-red, #ef4444);
    --prop-color-rgb: 239, 68, 68;
    background: linear-gradient(
      180deg,
      rgba(239, 68, 68, 0.16) 0%,
      rgba(239, 68, 68, 0.06) 100%
    );
    border-color: rgba(239, 68, 68, 0.4);
  }

  .spin-inline:focus-visible {
    outline: 2px solid var(--theme-accent, #6ea8fe);
    outline-offset: 2px;
  }

  /* Dash/static spin — themed via the half's --prop-color-rgb. */
  .spin-inline {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 10px;
    border-radius: 7px;
    border: 1px solid rgba(var(--prop-color-rgb), 0.5);
    background: rgba(var(--prop-color-rgb), 0.22);
    color: rgba(255, 255, 255, 0.92);
    font-size: 0.72rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .spin-inline:hover {
    background: rgba(var(--prop-color-rgb), 0.34);
    border-color: rgba(var(--prop-color-rgb), 0.7);
  }

  .spin-inline:active {
    transform: scale(0.96);
  }

  /* Pin the spin button to the half's outer (colored) edge, vertically centered.
     Out of flow, so it has its own room and never shifts the centered stepper. */
  .spin-inline.edge {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .hand-half.blue .spin-inline.edge {
    left: 14px;
  }

  .hand-half.red .spin-inline.edge {
    right: 14px;
  }

  .spin-inline.edge:active {
    transform: translateY(-50%) scale(0.96);
  }

  /* Fixed-width direction label so CW <-> CCW toggling never resizes the chip. */
  .spin-inline .dir {
    display: inline-block;
    min-width: 2.4ch;
    text-align: left;
  }

  /* Popover layout: Options and Level share the first row; each hand gets one
     horizontal row beneath it. This keeps the complete Level 3 palette above
     the picker on short phones without shrinking any touch target. */
  .oph.compact {
    padding: 8px;
    background: transparent;
    border-bottom: none;
  }

  .oph.compact .oph-bar {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    gap: 8px;
    min-height: 0;
  }

  .oph.compact .oph-bar.filter-only,
  .oph.compact .oph-bar.turns-only {
    grid-template-columns: minmax(0, 1fr);
  }

  .oph.compact .oph-bar.turns-only .oph-side.start,
  .oph.compact .oph-side.end {
    display: none;
  }

  .oph.compact .oph-side.start,
  .oph.compact .filter-seg,
  .oph.compact .level-control {
    width: 100%;
  }

  .oph.compact .filter-seg,
  .oph.compact .level-control {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  /* The compact tray sits over animated backgrounds. A deeper accent keeps
     the selected filter label readable at enhanced contrast without changing
     the shared control everywhere else it appears. */
  .oph.compact .filter-seg :global(.segmented-control.accent .indicator) {
    background: color-mix(in srgb, var(--theme-accent, #8b6cff) 48%, black);
  }

  .oph.compact .control-label {
    display: block;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .oph.compact :global(.level-selector) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
  }

  .oph.compact :global(.level-selector .lvl) {
    width: 100%;
    height: var(--min-touch-target, 44px);
    padding: 0;
  }

  .oph.compact .oph-turns-row {
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .oph.compact .hand-half {
    flex: 0 0 auto;
    display: grid;
    /* [spin 44px][turn palette]. The Blue/Red word column is gone — colour
       carries hand identity — so the palette gets that 30px back. */
    grid-template-columns: var(--min-touch-target, 44px) minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    width: 100%;
    min-width: 0;
    padding: 6px;
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--hand-color) 9%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
    border-color: color-mix(
      in srgb,
      var(--hand-color) 26%,
      var(--theme-stroke, rgba(255, 255, 255, 0.12))
    );
    box-shadow: inset 3px 0 0
      color-mix(in srgb, var(--hand-color) 62%, transparent);
  }

  .oph.compact .hand-half.blue,
  .oph.compact .hand-half.red {
    padding: 6px;
    background: color-mix(
      in srgb,
      var(--hand-color) 9%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
    border-color: color-mix(
      in srgb,
      var(--hand-color) 26%,
      var(--theme-stroke, rgba(255, 255, 255, 0.12))
    );
  }

  /* hand-meta falls back to the base display:contents, so its only remaining
     child — the spin slot — is the hand-half grid's first (44px) column. */

  .oph.compact .spin-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
  }

  .oph.compact .turn-seg {
    width: 100%;
  }

  .oph.compact .turn-seg :global(.segment) {
    padding-inline: 0.2rem;
  }

  .oph.compact .spin-inline.edge {
    position: static;
    justify-content: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    padding: 0;
    transform: none;
  }

  .oph.compact .spin-inline .dir {
    /* The rotation icon communicates the state visually; the button's full
       aria-label keeps CW / CCW explicit without stealing Level 3 width. */
    display: none;
  }

  .oph.compact .spin-inline.edge:active {
    transform: scale(0.96);
  }

  @media (prefers-reduced-motion: reduce) {
    .hand-half {
      transition: none;
    }
    .spin-inline {
      transition: none;
    }
    .spin-inline:active {
      transform: none;
    }
    /* Keep the edge button's positioning transform under reduced motion. */
    .spin-inline.edge:active {
      transform: translateY(-50%);
    }

    .oph.compact .spin-inline.edge:active {
      transform: none;
    }
  }
</style>

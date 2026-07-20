<!--
  OptionPickerHeader.svelte

  Unified header for the construct option picker (desktop wide layout). Combines:
    • the All / Continuous filter (a SegmentedControl),
    • the working Level (a SegmentedControl — 1/2/3), and
    • a collapsible Turns section (blue/red turn buttons + dash/static spin),
  into one band that hugs the option grid. Turns is collapsed by default; when
  turns are set the toggle shows a badge so active turns are never hidden.

  Level gates the turn palette, per TKA canon (shared table in
  level-turn-values.ts): L1 base motions only, L2 whole turns, L3 half turns +
  floats. Every legal value is its own button — no stepper to click through, and
  the float that the stepper could never reach is now one tap.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { slide, fade } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";
  import {
    TURN_LEVELS,
    formatTurnValue,
    keyToTurnValue,
    turnValueToKey,
    turnValuesForLevel,
    type TurnLevel,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";

  interface Props {
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
    onReset: () => void;
  }

  const {
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
    onReset,
  }: Props = $props();

  // Persist the Turns drawer open/closed state across reloads.
  const expandedPersistence = createPersistenceHelper<boolean>({
    key: "tka-option-picker-turns-expanded",
    defaultValue: false,
  });
  let expanded = $state(expandedPersistence.load());

  $effect(() => {
    void expanded;
    expandedPersistence.setupAutoSave(expanded);
  });

  const hasBlueTurns = $derived(blueTurns === "fl" || blueTurns > 0);
  const hasRedTurns = $derived(redTurns === "fl" || redTurns > 0);
  const hasAnyTurns = $derived(hasBlueTurns || hasRedTurns);

  // Level 1 is base motions — there is nothing to dial, so the drawer stays shut.
  const turnsAvailable = $derived(level > 1);
  const isOpen = $derived(expanded && turnsAvailable);

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "continuous", label: "Continuous" },
  ];
  const filterValue = $derived(isContinuousOnly ? "continuous" : "all");

  const levelOptions = TURN_LEVELS.map((n) => ({
    value: String(n),
    label: `L${n}`,
  }));

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
    return d === RotationDirection.CLOCKWISE ? "fa-rotate-right" : "fa-rotate-left";
  }
  function dirLabel(d: RotationDirection): string {
    return d === RotationDirection.CLOCKWISE ? "CW" : "CCW";
  }
</script>

<div class="oph">
  <div class="oph-bar">
    <!-- Row 1: filter (left), persistent controls (right). Never changes height. -->
    <div class="oph-filter">
      {#if showFilter}
        <div class="filter-seg">
          <SegmentedControl
            options={filterOptions}
            value={filterValue}
            size="sm"
            color="accent"
            onchange={(v) => onToggleContinuous?.(v === "continuous")}
          />
        </div>
      {/if}

      <!-- Level decides which turn buttons exist below. Sits beside the filter
           so both "what am I shown" controls read as one group. -->
      <div class="level-seg" title="Level 1 base motions · Level 2 whole turns · Level 3 half turns and floats">
        <span class="group-tag">Level</span>
        <SegmentedControl
          options={levelOptions}
          value={String(level)}
          size="sm"
          color="accent"
          onchange={(v) => onLevelChange(Number(v) as TurnLevel)}
        />
      </div>
    </div>

    <!-- Persistent controls (pinned right, never reflow). Reset is always present
         — disabled when there are no turns — so it never appears/disappears. -->
    <div class="oph-controls">
      <button
        class="turns-toggle"
        class:active={isOpen}
        disabled={!turnsAvailable}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Hide turns" : "Show turns"}
        title={turnsAvailable ? undefined : "Level 1 is base motions — switch to Level 2 or 3 to add turns"}
        onclick={() => (expanded = !expanded)}
      >
        <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
        <span>Turns</span>
        {#if !isOpen && hasBlueTurns}
          <span class="badge blue">{formatTurnValue(blueTurns)}</span>
        {/if}
        {#if !isOpen && hasRedTurns}
          <span class="badge red">{formatTurnValue(redTurns)}</span>
        {/if}
        <i class="fas fa-chevron-down chevron" aria-hidden="true"></i>
      </button>

      <button
        class="reset-btn"
        disabled={!hasAnyTurns}
        aria-label="Reset turns to 0"
        onclick={onReset}
      >
        <i class="fas fa-rotate-left" aria-hidden="true"></i>
        <span>Reset</span>
      </button>
    </div>
  </div>

  <!-- Row 2: blue (left half) / red (right half), slides down to appear. The
       stepper sits centered in each half; the CW/CCW spin button is pinned to the
       half's outer (colored) edge — absolutely positioned, so it has its own room
       and its appearance never nudges the centered stepper. -->
  {#if isOpen}
    <div class="oph-turns-row" transition:slide={{ duration: 240, easing: quintOut }}>
      <div class="hand-half blue">
        <span class="hand-tag">Blue</span>
        <div class="turn-seg">
          <SegmentedControl
            options={turnOptions}
            value={turnValueToKey(blueTurns)}
            size="sm"
            color="blue"
            onchange={(v) => onBlueChange(keyToTurnValue(v))}
          />
        </div>
        {#if !isContinuousOnly && hasBlueTurns}
          <button
            class="spin-inline edge"
            transition:fade={{ duration: 140 }}
            title="Spin direction for dash & static options on this hand (shifts keep their own direction)"
            aria-label="Toggle blue dash/static spin (currently {dirLabel(blueRotation)})"
            onclick={() => onBlueRotationChange(opposite(blueRotation))}
          >
            <i class="fas {dirIcon(blueRotation)}" aria-hidden="true"></i>
            <span class="dir">{dirLabel(blueRotation)}</span>
          </button>
        {/if}
      </div>
      <div class="hand-half red">
        <span class="hand-tag">Red</span>
        <div class="turn-seg">
          <SegmentedControl
            options={turnOptions}
            value={turnValueToKey(redTurns)}
            size="sm"
            color="red"
            onchange={(v) => onRedChange(keyToTurnValue(v))}
          />
        </div>
        {#if !isContinuousOnly && hasRedTurns}
          <button
            class="spin-inline edge"
            transition:fade={{ duration: 140 }}
            title="Spin direction for dash & static options on this hand (shifts keep their own direction)"
            aria-label="Toggle red dash/static spin (currently {dirLabel(redRotation)})"
            onclick={() => onRedRotationChange(opposite(redRotation))}
          >
            <i class="fas {dirIcon(redRotation)}" aria-hidden="true"></i>
            <span class="dir">{dirLabel(redRotation)}</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Header band: faint top gradient + hairline divider separate it from options. */
  .oph {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    padding: 8px 18px 10px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.045) 0%,
      rgba(255, 255, 255, 0) 100%
    );
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  /* Row 1: filter left, persistent controls right. The steppers are NOT here —
     they live on row 2 — so this row's height and contents never change. */
  .oph-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: var(--min-touch-target, 44px);
  }

  .oph-filter {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .filter-seg {
    width: 240px;
    max-width: 50vw;
  }

  /* Level sits beside the filter. Fixed width so switching L1/L2/L3 — which
     changes the turn row's button count — never resizes this row. */
  .level-seg {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 190px;
    flex: 0 0 auto;
  }

  .group-tag {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.55);
  }

  .oph-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Row 2: two equal halves — blue (left), red (right) — revealed by sliding
     down. Each half centers [label][stepper]; the spin button is pinned to the
     half's colored edge, out of flow. */
  .oph-turns-row {
    display: flex;
    gap: 10px;
  }

  .hand-half {
    position: relative;
    flex: 1 1 0;
    display: flex;
    align-items: center;
    gap: 10px;
    /* The turn buttons fill the half; the spin button is pinned out of flow on
       the colored edge. Its gutter is reserved PERMANENTLY (not only while it
       shows), so the buttons never resize when spin appears or disappears. */
    --spin-gutter: 86px;
    padding: 6px 12px;
    min-width: 260px;
    border-radius: 10px;
    border: 1px solid;
  }

  .hand-half.blue {
    padding-left: var(--spin-gutter);
  }

  .hand-half.red {
    padding-right: var(--spin-gutter);
  }

  /* One button per legal turn value — grows to fill whatever the level's palette
     needs (4 buttons at L2, 8 at L3) inside a fixed-height row. */
  .turn-seg {
    flex: 1 1 auto;
    min-width: 0;
  }

  .hand-half.blue {
    --prop-color-rgb: 59, 130, 246;
    background: linear-gradient(
      180deg,
      rgba(59, 130, 246, 0.16) 0%,
      rgba(59, 130, 246, 0.06) 100%
    );
    border-color: rgba(59, 130, 246, 0.4);
  }

  .hand-half.red {
    --prop-color-rgb: 239, 68, 68;
    background: linear-gradient(
      180deg,
      rgba(239, 68, 68, 0.16) 0%,
      rgba(239, 68, 68, 0.06) 100%
    );
    border-color: rgba(239, 68, 68, 0.4);
  }

  .hand-tag {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hand-half.blue .hand-tag {
    color: #9ec1ff;
  }

  .hand-half.red .hand-tag {
    color: #ffaba6;
  }

  .turns-toggle,
  .reset-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: var(--min-touch-target, 44px);
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .turns-toggle:hover,
  .reset-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: white;
  }

  .reset-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .turns-toggle.active {
    background: rgba(110, 168, 254, 0.16);
    border-color: rgba(110, 168, 254, 0.45);
    color: #cfe0ff;
  }

  .turns-toggle .chevron {
    font-size: 0.6rem;
    opacity: 0.7;
    transition: transform var(--duration-fast, 0.15s) ease;
  }

  .turns-toggle.active .chevron {
    transform: rotate(180deg);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.2rem;
    padding: 0.05rem 0.35rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .badge.blue {
    background: rgba(59, 130, 246, 0.25);
    color: #bcd4ff;
  }

  .badge.red {
    background: rgba(239, 68, 68, 0.25);
    color: #ffc4bf;
  }

  .turns-toggle:focus-visible,
  .reset-btn:focus-visible,
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
    left: 10px;
  }

  .hand-half.red .spin-inline.edge {
    right: 10px;
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

  @media (prefers-reduced-motion: reduce) {
    .turns-toggle,
    .reset-btn,
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
  }
</style>

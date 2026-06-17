<!--
  OptionPickerHeader.svelte

  Unified header for the construct option picker (desktop wide layout). Combines:
    • the All / Continuous filter (a SegmentedControl), and
    • a collapsible Turns section (blue/red steppers + dash/static spin),
  into one band that hugs the option grid. Turns is collapsed by default; when
  turns are set the toggle shows a badge so active turns are never hidden.
-->
<script lang="ts">
  import PropTurnsControl from "$lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { slide, fade } from "svelte/transition";
  import { quintOut } from "svelte/easing";

  interface Props {
    // Filter
    showFilter: boolean;
    isContinuousOnly: boolean;
    onToggleContinuous?: (value: boolean) => void;
    // Turns
    blueTurns: number | "fl";
    redTurns: number | "fl";
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    onBlueChange: (delta: number) => void;
    onRedChange: (delta: number) => void;
    onBlueRotationChange: (dir: RotationDirection) => void;
    onRedRotationChange: (dir: RotationDirection) => void;
    onReset: () => void;
  }

  const {
    showFilter,
    isContinuousOnly,
    onToggleContinuous,
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

  let expanded = $state(false);

  const hasBlueTurns = $derived(typeof blueTurns === "number" && blueTurns > 0);
  const hasRedTurns = $derived(typeof redTurns === "number" && redTurns > 0);
  const hasAnyTurns = $derived(hasBlueTurns || hasRedTurns);

  // Spin direction only matters for dash/static hands with turns, only when the
  // steppers are open, and only when NOT continuous (continuous predetermines it).
  const showSpin = $derived(expanded && !isContinuousOnly && hasAnyTurns);

  const filterOptions = [
    { value: "all", label: "All" },
    { value: "continuous", label: "Continuous" },
  ];
  const filterValue = $derived(isContinuousOnly ? "continuous" : "all");

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

    <div class="oph-right">
      {#if expanded}
        <div
          class="oph-steppers"
          transition:slide={{ axis: "x", duration: 240, easing: quintOut }}
        >
          <div class="hand-stepper blue">
            <span class="hand-tag">Blue</span>
            <PropTurnsControl
              color="blue"
              turns={blueTurns}
              rotationDirection={blueRotation}
              showRotation={false}
              compact
              onTurnsChange={onBlueChange}
              onRotationChange={() => {}}
            />
          </div>
          <div class="hand-stepper red">
            <span class="hand-tag">Red</span>
            <PropTurnsControl
              color="red"
              turns={redTurns}
              rotationDirection={redRotation}
              showRotation={false}
              compact
              onTurnsChange={onRedChange}
              onRotationChange={() => {}}
            />
          </div>
        </div>
      {/if}

      <button
        class="turns-toggle"
        class:active={expanded}
        aria-expanded={expanded}
        aria-label={expanded ? "Hide turns" : "Show turns"}
        onclick={() => (expanded = !expanded)}
      >
        <i class="fas fa-arrows-rotate" aria-hidden="true"></i>
        <span>Turns</span>
        {#if !expanded && hasBlueTurns}
          <span class="badge blue">{blueTurns}</span>
        {/if}
        {#if !expanded && hasRedTurns}
          <span class="badge red">{redTurns}</span>
        {/if}
        <i class="fas fa-chevron-down chevron" aria-hidden="true"></i>
      </button>

      {#if expanded && hasAnyTurns}
        <button
          class="reset-btn"
          aria-label="Reset turns to 0"
          onclick={onReset}
          transition:fade={{ duration: 150 }}
        >
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
          <span>Reset</span>
        </button>
      {/if}
    </div>
  </div>

  {#if showSpin}
    <div class="spin-strip" transition:slide={{ duration: 200, easing: quintOut }}>
      <span class="spin-label">Dash &amp; static spin</span>
      {#if hasBlueTurns}
        <button
          class="spin-toggle blue"
          aria-label="Toggle blue dash/static spin (currently {dirLabel(blueRotation)})"
          onclick={() => onBlueRotationChange(opposite(blueRotation))}
        >
          <span class="hand">Blue</span>
          <i class="fas {dirIcon(blueRotation)}" aria-hidden="true"></i>
          <span class="dir">{dirLabel(blueRotation)}</span>
        </button>
      {/if}
      {#if hasRedTurns}
        <button
          class="spin-toggle red"
          aria-label="Toggle red dash/static spin (currently {dirLabel(redRotation)})"
          onclick={() => onRedRotationChange(opposite(redRotation))}
        >
          <span class="hand">Red</span>
          <i class="fas {dirIcon(redRotation)}" aria-hidden="true"></i>
          <span class="dir">{dirLabel(redRotation)}</span>
        </button>
      {/if}
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* One wrapping row: filter on the left, the turns cluster on the right.
     flex-wrap keeps it a single line on a wide panel and drops the cluster to a
     second line only when the panel is too narrow — never a tall stacked block. */
  .oph-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    min-height: var(--min-touch-target, 44px);
  }

  .filter-seg {
    width: 240px;
    max-width: 50vw;
    flex: 0 1 auto;
  }

  .oph-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 8px;
    margin-left: auto;
  }

  /* Inline hand steppers — slim chips, label beside the +/- row (not stacked
     above it like the glass card), so each is one ~44px row with no vertical air.
     Reuses PropTurnsControl (compact, showRotation off) for the actual stepper. */
  .oph-steppers {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  }

  .hand-stepper {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px 3px 10px;
    border-radius: 10px;
    border: 1px solid;
  }

  .hand-stepper.blue {
    --prop-color-rgb: 59, 130, 246;
    background: rgba(59, 130, 246, 0.12);
    border-color: rgba(59, 130, 246, 0.4);
  }

  .hand-stepper.red {
    --prop-color-rgb: 239, 68, 68;
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.4);
  }

  .hand-tag {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hand-stepper.blue .hand-tag {
    color: #9ec1ff;
  }

  .hand-stepper.red .hand-tag {
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
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .turns-toggle:hover,
  .reset-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
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
  .spin-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6ea8fe);
    outline-offset: 2px;
  }

  /* Dash/static spin direction — labeled, separate from the steppers. */
  .spin-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .spin-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.3px;
    color: rgba(255, 255, 255, 0.55);
  }

  .spin-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .spin-toggle .hand {
    font-weight: 700;
  }

  .spin-toggle.blue {
    background: rgba(59, 130, 246, 0.18);
    border-color: rgba(59, 130, 246, 0.45);
    color: #9ec1ff;
  }

  .spin-toggle.blue:hover {
    background: rgba(59, 130, 246, 0.28);
  }

  .spin-toggle.red {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.45);
    color: #ffaba6;
  }

  .spin-toggle.red:hover {
    background: rgba(239, 68, 68, 0.28);
  }

  .spin-toggle:active {
    transform: scale(0.96);
  }

  @media (prefers-reduced-motion: reduce) {
    .turns-toggle,
    .reset-btn,
    .spin-toggle {
      transition: none;
    }
    .spin-toggle:active {
      transform: none;
    }
  }
</style>

<!--
  PendingTurnsBar.svelte

  Slim turns-only toolbar above the construct option picker. Two compact
  PropTurnsControl steppers (blue + red). Below them, a "Dash & static spin" strip
  exposes the CW/CCW choice for dash/static hands — the one ambiguity turns add.
  That strip is hidden under Continuous (which predetermines the direction) and
  when no hand has turns.
-->
<script lang="ts">
  import PropControlPair from "$lib/features/create/shared/components/sequence-actions/PropControlPair.svelte";
  import PropTurnsControl from "$lib/features/create/shared/components/sequence-actions/PropTurnsControl.svelte";
  import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  interface Props {
    blueTurns: number | "fl";
    redTurns: number | "fl";
    blueRotation: RotationDirection;
    redRotation: RotationDirection;
    isContinuousOnly: boolean;
    onBlueChange: (delta: number) => void;
    onRedChange: (delta: number) => void;
    onBlueRotationChange: (dir: RotationDirection) => void;
    onRedRotationChange: (dir: RotationDirection) => void;
    onReset: () => void;
  }

  const {
    blueTurns,
    redTurns,
    blueRotation,
    redRotation,
    isContinuousOnly,
    onBlueChange,
    onRedChange,
    onBlueRotationChange,
    onRedRotationChange,
    onReset,
  }: Props = $props();

  const hasBlueTurns = $derived(typeof blueTurns === "number" && blueTurns > 0);
  const hasRedTurns = $derived(typeof redTurns === "number" && redTurns > 0);
  const isCleared = $derived(blueTurns === 0 && redTurns === 0);

  // Spin direction only matters for dash/static hands with turns, and only when
  // NOT continuous (continuous predetermines the direction).
  const showSpin = $derived(!isContinuousOnly && (hasBlueTurns || hasRedTurns));

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

<div class="pending-turns-bar">
  <div class="bar-row">
    <span class="bar-title">Turns</span>

    <div class="pair-wrap">
      <PropControlPair compact>
        {#snippet blueContent()}
          <PropTurnsControl
            color="blue"
            turns={blueTurns}
            rotationDirection={blueRotation}
            showRotation={false}
            compact
            onTurnsChange={onBlueChange}
            onRotationChange={() => {}}
          />
        {/snippet}
        {#snippet redContent()}
          <PropTurnsControl
            color="red"
            turns={redTurns}
            rotationDirection={redRotation}
            showRotation={false}
            compact
            onTurnsChange={onRedChange}
            onRotationChange={() => {}}
          />
        {/snippet}
      </PropControlPair>
    </div>

    <button
      class="reset-btn"
      disabled={isCleared}
      aria-label="Reset turns to 0"
      onclick={onReset}
    >
      <i class="fas fa-rotate-left" aria-hidden="true"></i>
      <span>Reset</span>
    </button>
  </div>

  {#if showSpin}
    <div class="spin-strip">
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
  .pending-turns-bar {
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

  /* Row 1: label anchored left, steppers centered (middle column), reset right. */
  .bar-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
  }

  .bar-title {
    justify-self: start;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }

  .pair-wrap {
    justify-self: center;
  }

  .reset-btn {
    justify-self: end;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--min-touch-target, 44px);
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.75);
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 0.15s) ease;
  }

  .reset-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .reset-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .reset-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6ea8fe);
    outline-offset: 2px;
  }

  /* Row 2: dash/static spin direction — separate from the steppers, with a label
     so it's clear what it controls and why. */
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
    letter-spacing: 0.3px;
  }

  .spin-toggle.blue {
    background: rgba(59, 130, 246, 0.18);
    border-color: rgba(59, 130, 246, 0.45);
    color: #9ec1ff;
  }

  .spin-toggle.blue:hover {
    background: rgba(59, 130, 246, 0.28);
    border-color: rgba(59, 130, 246, 0.65);
  }

  .spin-toggle.red {
    background: rgba(239, 68, 68, 0.18);
    border-color: rgba(239, 68, 68, 0.45);
    color: #ffaba6;
  }

  .spin-toggle.red:hover {
    background: rgba(239, 68, 68, 0.28);
    border-color: rgba(239, 68, 68, 0.65);
  }

  .spin-toggle:active {
    transform: scale(0.96);
  }

  .spin-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #6ea8fe);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .reset-btn,
    .spin-toggle {
      transition: none;
    }
    .spin-toggle:active {
      transform: none;
    }
  }
</style>

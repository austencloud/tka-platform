<!--
  PendingTurnsBar.svelte

  Slim turns-only toolbar shown above the construct option picker. Two compact
  PropTurnsControl steppers (blue + red) with no rotation-direction or path-shape
  controls. Setting a value applies those turns to every option in the picker
  (handled by the parent).
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
    onBlueChange,
    onRedChange,
    onBlueRotationChange,
    onRedRotationChange,
    onReset,
  }: Props = $props();

  // Spin direction matters only for dash/static hands with turns; the toggle
  // appears once a hand has turns dialed up. Shifts ignore it.
  const showBlueRotation = $derived(typeof blueTurns === "number" && blueTurns > 0);
  const showRedRotation = $derived(typeof redTurns === "number" && redTurns > 0);
  const isCleared = $derived(blueTurns === 0 && redTurns === 0);
</script>

<div class="pending-turns-bar">
  <span class="bar-title">Turns</span>

  <div class="pair-wrap">
    <PropControlPair compact>
      {#snippet blueContent()}
        <PropTurnsControl
          color="blue"
          turns={blueTurns}
          rotationDirection={blueRotation}
          showRotation={showBlueRotation}
          compact
          onTurnsChange={onBlueChange}
          onRotationChange={onBlueRotationChange}
        />
      {/snippet}
      {#snippet redContent()}
        <PropTurnsControl
          color="red"
          turns={redTurns}
          rotationDirection={redRotation}
          showRotation={showRedRotation}
          compact
          onTurnsChange={onRedChange}
          onRotationChange={onRedRotationChange}
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

<style>
  /* Header band: label anchored left, steppers truly centered (middle grid
     column), reset anchored right — reads as a designed toolbar, not floating
     chips. Faint top gradient + hairline divider separate it from the options. */
  .pending-turns-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    width: 100%;
    padding: 8px 18px 10px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.045) 0%,
      rgba(255, 255, 255, 0) 100%
    );
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .bar-title {
    justify-self: start;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
  }

  /* Hold the compact pair at content width, centered in the middle column */
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

  @media (prefers-reduced-motion: reduce) {
    .reset-btn {
      transition: none;
    }
  }
</style>

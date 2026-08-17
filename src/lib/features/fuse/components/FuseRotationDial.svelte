<!--
  FuseRotationDial — the rotation amount, on the shape the amount lives on.

  Eight 45° steps were eight segments in a row, which asks you to read "225°"
  and picture where that lands. The amounts are positions on a circle, so the
  control is the circle: press the point you want the path rotated to. The
  filled sweep from twelve o'clock to that point IS the amount, so the numbers
  stop being the thing you have to decode.

  Twelve o'clock is no rotation. The eight points are the same eight the grid
  has, which is not a coincidence — a 45° step is one grid point clockwise.
-->
<script lang="ts">
  import { FUSE_ROTATIONS } from "../domain/fuse-rule";

  let {
    value,
    accent,
    disabled = false,
    labelledBy,
    onchange,
  }: {
    /** 0–7, in 45° steps clockwise from no rotation. */
    value: number;
    /** The ROTATED primitive's colour — the sweep and the selected point. */
    accent: string;
    disabled?: boolean;
    labelledBy?: string;
    onchange: (steps: number) => void;
  } = $props();

  const STEP_DEG = 45;
  const points = FUSE_ROTATIONS.map((option, index) => ({
    steps: option.steps,
    label: option.label,
    // CSS angles run clockwise from twelve o'clock, which is exactly how the
    // steps run, so the step index is the angle.
    deg: index * STEP_DEG,
    ariaLabel:
      option.steps === 0 ? "No rotation" : `Rotate ${option.label} clockwise`,
  }));

  const selected = $derived(points.find((p) => p.steps === value) ?? points[0]!);

  // A zero-width conic sweep is invisible, which is correct: nothing has been
  // rotated. Every other amount paints its own arc.
  const sweepDeg = $derived(selected.deg);

  function move(delta: number): void {
    if (disabled) return;
    onchange((((value + delta) % 8) + 8) % 8);
  }

  function onKeydown(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (step === undefined) return;
    event.preventDefault();
    move(step);
  }
</script>

<div
  class="dial"
  class:disabled
  role="radiogroup"
  aria-labelledby={labelledBy}
  onkeydown={onKeydown}
  style="--dial-accent: {accent}; --dial-sweep: {sweepDeg}deg;"
>
  <div class="dial-face" aria-hidden="true">
    <span class="dial-sweep"></span>
    <span class="dial-ring"></span>
  </div>

  {#each points as point (point.steps)}
    <button
      type="button"
      class="dial-point"
      class:selected={point.steps === value}
      style="--point-deg: {point.deg}deg;"
      role="radio"
      aria-checked={point.steps === value}
      aria-label={point.ariaLabel}
      title={point.ariaLabel}
      tabindex={point.steps === value ? 0 : -1}
      {disabled}
      onclick={() => onchange(point.steps)}
    >
      <span class="point-dot"></span>
    </button>
  {/each}

  <!-- The readout is the only place the number appears, so it carries the whole
       answer rather than repeating a label the ring already draws. -->
  <span class="dial-readout" aria-hidden="true">
    {#if value === 0}
      <strong>None</strong>
    {:else}
      <strong>{selected.label}</strong>
      <span>clockwise</span>
    {/if}
  </span>
</div>

<style>
  .dial {
    --dial-size: clamp(9rem, 26cqw, 12rem);
    --dial-inset: 1.1rem;

    position: relative;
    display: grid;
    place-items: center;
    width: var(--dial-size);
    height: var(--dial-size);
    margin-inline: auto;
    touch-action: manipulation;
  }

  .dial-face {
    position: absolute;
    inset: var(--dial-inset);
    border-radius: 50%;
  }

  /* The arc from twelve o'clock to the chosen point. This is the control's whole
     argument: the amount is a shape, not a number you convert. */
  .dial-sweep {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      color-mix(in srgb, var(--dial-accent) 42%, transparent) 0deg,
      color-mix(in srgb, var(--dial-accent) 42%, transparent)
        var(--dial-sweep, 0deg),
      transparent var(--dial-sweep, 0deg)
    );
    transition: background var(--duration-fast, 140ms) ease;
  }

  .dial-ring {
    position: absolute;
    inset: 0;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 50%;
    /* Punches the middle out so the readout sits on the panel, not on the arc. */
    mask:
      radial-gradient(circle, transparent 0 55%, black 55.5%) content-box,
      linear-gradient(black, black);
    mask-composite: intersect;
    background: color-mix(in srgb, var(--theme-text, #fff) 5%, transparent);
  }

  /* Each point sits on the circle by rotating out to the radius and unrotating
     itself, so the hit target stays an upright square at every angle. */
  .dial-point {
    position: absolute;
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    transform: rotate(var(--point-deg))
      translateY(calc(var(--dial-size) / -2 + var(--dial-inset)))
      rotate(calc(var(--point-deg) * -1));
  }

  .dial-point:disabled {
    cursor: not-allowed;
  }

  .point-dot {
    width: 0.6rem;
    height: 0.6rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-text, #fff) 22%, transparent);
    transition:
      transform var(--duration-fast, 140ms) ease,
      background var(--duration-fast, 140ms) ease,
      box-shadow var(--duration-fast, 140ms) ease;
  }

  .dial-point:hover:not(:disabled) .point-dot {
    background: color-mix(in srgb, var(--dial-accent) 55%, transparent);
    transform: scale(1.25);
  }

  .dial-point.selected .point-dot {
    border-color: var(--dial-accent);
    background: var(--dial-accent);
    transform: scale(1.5);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--dial-accent) 24%, transparent);
  }

  .dial-point:focus-visible {
    outline: 2px solid var(--dial-accent);
    outline-offset: -6px;
    border-radius: 50%;
  }

  .dial-readout {
    display: grid;
    justify-items: center;
    gap: 1px;
    pointer-events: none;
    text-align: center;
  }

  .dial-readout strong {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 15px);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .dial-readout span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  .dial.disabled {
    opacity: 0.55;
  }

  /* A tall panel leaves real space under this card, and the dial is the control
     the panel is for — it takes the room rather than sitting at its floor. */
  @media (min-height: 1150px) {
    .dial {
      --dial-size: clamp(12rem, 34cqw, 15rem);
      --dial-inset: 1.4rem;
    }
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .dial {
      --dial-size: clamp(14rem, 38cqw, 18rem);
    }

    .point-dot {
      width: 0.75rem;
      height: 0.75rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dial-sweep,
    .point-dot {
      transition: none;
    }
  }
</style>

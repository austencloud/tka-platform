<script lang="ts">
  /**
   * The stage: home base, the hand path, the tether, and the traced shape.
   *
   * Everything here is computed from qft-model. Nothing is traced from the
   * original 2011 animations.
   */
  import {
    pointAt,
    posesAt,
    tracePath,
    PROP_LENGTH,
    type QftIncrement,
    type QftKnobs
  } from "$lib/shared/notation/qft/qft-model";

  interface Props {
    knobs: QftKnobs;
    increments: QftIncrement[];
    /** Continuous position in the eight-step cycle. */
    cursor: number;
  }

  let { knobs, increments, cursor }: Props = $props();

  /** Pixels per prop length. The head reaches radius + 1, so 2.5 at the widest. */
  const UNIT = 100;
  const EXTENT = 270;

  const HOME_BASE = [1, 2, 3, 4, 5, 6, 7, 8];
  const RING = PROP_LENGTH * UNIT;

  const step = $derived(Math.floor(cursor) % 8);
  const row = $derived(increments[step]);

  const poses = $derived(posesAt(knobs, cursor));
  const hand = $derived({ x: poses.hand.x * UNIT, y: poses.hand.y * UNIT });
  const head = $derived({ x: poses.head.x * UNIT, y: poses.head.y * UNIT });

  const trail = $derived(
    tracePath(knobs)
      .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * UNIT).toFixed(2)},${(p.y * UNIT).toFixed(2)}`)
      .join(" ")
  );

  const labelPoint = (position: number) => {
    const p = pointAt(position, PROP_LENGTH * 1.28);
    return { x: p.x * UNIT, y: p.y * UNIT };
  };
</script>

<svg
  class="stage"
  viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`}
  role="img"
  aria-label={`QfT home base with the prop at position ${row?.propDepart ?? 8} and the hand at position ${row?.handDepart ?? 8}`}
>
  <circle class="ring" cx="0" cy="0" r={RING} />

  {#if knobs.radius > 0.01}
    <circle class="hand-path" cx="0" cy="0" r={knobs.radius * UNIT} />
  {/if}

  <path class="trail" d={trail} />

  {#each HOME_BASE as position (position)}
    {@const p = labelPoint(position)}
    {@const isOrigin = row?.propDepart === position}
    {@const isArrival = row?.propArrive === position}
    <g class="point" class:origin={isOrigin} class:arrival={isArrival}>
      <circle cx={p.x} cy={p.y} r="26" />
      <text x={p.x} y={p.y} dy="9">{position}</text>
    </g>
  {/each}

  <line class="tether" x1={hand.x} y1={hand.y} x2={head.x} y2={head.y} />
  <circle class="hand" cx={hand.x} cy={hand.y} r="13" />
  <circle class="head" cx={head.x} cy={head.y} r="22" />
</svg>

<style>
  .stage {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    overflow: visible;
  }

  .ring {
    fill: none;
    stroke: var(--semantic-border-subtle, rgb(255 255 255 / 0.14));
    stroke-width: 2;
    stroke-dasharray: 6 10;
  }

  .hand-path {
    fill: none;
    stroke: var(--semantic-border, rgb(255 255 255 / 0.3));
    stroke-width: 2;
  }

  .trail {
    fill: none;
    stroke: var(--theme-accent, #8b5cf6);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.5;
  }

  .point circle {
    fill: var(--semantic-surface-raised, rgb(0 0 0 / 0.5));
    stroke: var(--semantic-border, rgb(255 255 255 / 0.28));
    stroke-width: 2;
    transition: fill 160ms ease, stroke 160ms ease;
  }

  .point text {
    fill: var(--semantic-text-secondary, rgb(255 255 255 / 0.66));
    font-size: 1.75rem;
    font-weight: 600;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }

  .point.arrival circle {
    stroke: var(--theme-accent, #8b5cf6);
  }

  .point.origin circle {
    fill: var(--theme-accent, #8b5cf6);
    stroke: var(--theme-accent, #8b5cf6);
  }

  .point.origin text {
    fill: #fff;
  }

  .tether {
    stroke: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
    stroke-width: 4;
    stroke-linecap: round;
  }

  .hand {
    fill: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
  }

  .head {
    fill: var(--theme-accent, #8b5cf6);
    stroke: #fff;
    stroke-width: 3;
  }

  @media (prefers-reduced-motion: reduce) {
    .point circle {
      transition: none;
    }
  }
</style>

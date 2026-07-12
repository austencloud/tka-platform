<!--
  Mandala Match — hub preview. What a sequence mandala actually is: smooth
  overlapping stroked loci in the REAL motion palette (mandala-constants —
  the exact stroke colors SequenceMandala renders with), slowly
  counter-rotating around a shared center with a soft accent bloom. Replaces
  the old dotted concentric rings, which read as generic sci-fi, not TKA.
-->
<script lang="ts">
  import {
    DARK_MOTION_BLUE_STROKE,
    DARK_MOTION_RED_STROKE,
  } from "$lib/shared/mandala/domain/mandala-constants";

  let { accent }: { accent: string } = $props();
</script>

<div class="stage" style="--accent: {accent}" aria-hidden="true">
  <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
    <!-- soft accent bloom behind the figure -->
    <circle cx="60" cy="60" r="30" class="bloom" />

    <!-- blue locus pair: two offset circles orbiting the shared center,
         the way a staff's two ends trace paired loops -->
    <g class="locus blue" style="--stroke: {DARK_MOTION_BLUE_STROKE}">
      <circle cx="60" cy="47" r="26" />
      <circle cx="60" cy="73" r="26" />
    </g>

    <!-- red locus pair, counter-rotating -->
    <g class="locus red" style="--stroke: {DARK_MOTION_RED_STROKE}">
      <circle cx="47" cy="60" r="26" />
      <circle cx="73" cy="60" r="26" />
    </g>
  </svg>
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  svg {
    height: 94%;
    aspect-ratio: 1;
  }

  .bloom {
    fill: color-mix(in srgb, var(--accent) 16%, transparent);
    filter: blur(6px);
  }

  .locus circle {
    fill: none;
    stroke: var(--stroke);
    stroke-width: 1.6;
    opacity: 0.85;
  }

  .locus {
    transform-box: view-box;
    transform-origin: 50% 50%;
    animation: turn 14s linear infinite;
  }

  .locus.red {
    animation-direction: reverse;
    animation-duration: 18s;
  }

  @keyframes turn {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .locus {
      animation: none;
    }
  }
</style>

<!--
  Read the Performer — hub preview. The props are the story, not the figure:
  a dim, slim silhouette holds a short two-ended staff in each hand, and the
  staff tips sweep blue/red trail arcs — the REAL motion palette
  (mandala-constants, the same stroke colors the app's mandalas and motions
  render with), not decorative colors. Staffs spin slowly (transform-only);
  trails are stroked arcs with fading tails.
-->
<script lang="ts">
  import {
    DARK_MOTION_BLUE_STROKE,
    DARK_MOTION_RED_STROKE,
  } from "$lib/shared/mandala/domain/mandala-constants";

  let { accent }: { accent: string } = $props();
</script>

<div class="stage" style="--accent: {accent}" aria-hidden="true">
  <svg viewBox="0 0 200 125" preserveAspectRatio="xMidYMid meet">
    <!-- dim figure: head, torso, legs — deliberately quiet -->
    <g class="figure" stroke="rgba(255,255,255,0.28)" stroke-width="3" fill="none" stroke-linecap="round">
      <circle cx="100" cy="34" r="9" />
      <line x1="100" y1="43" x2="100" y2="82" />
      <line x1="100" y1="82" x2="88" y2="112" />
      <line x1="100" y1="82" x2="112" y2="112" />
      <!-- arms out to the prop hands -->
      <line x1="100" y1="52" x2="64" y2="62" />
      <line x1="100" y1="52" x2="136" y2="62" />
    </g>

    <!-- blue hand: staff + tip trail, real motion blue -->
    <g class="prop blue" style="--tip: {DARK_MOTION_BLUE_STROKE}">
      <circle class="trail" cx="64" cy="62" r="26" />
      <g class="staff">
        <line x1="64" y1="36" x2="64" y2="88" />
        <circle cx="64" cy="36" r="3.4" fill="var(--tip)" stroke="none" />
        <circle cx="64" cy="88" r="3.4" fill="var(--tip)" stroke="none" />
      </g>
    </g>

    <!-- red hand: staff + tip trail, real motion red, counter-rotating -->
    <g class="prop red" style="--tip: {DARK_MOTION_RED_STROKE}">
      <circle class="trail" cx="136" cy="62" r="26" />
      <g class="staff">
        <line x1="136" y1="36" x2="136" y2="88" />
        <circle cx="136" cy="36" r="3.4" fill="var(--tip)" stroke="none" />
        <circle cx="136" cy="88" r="3.4" fill="var(--tip)" stroke="none" />
      </g>
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
    width: 92%;
    height: 92%;
  }

  .prop line {
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 3.2;
    stroke-linecap: round;
  }

  /* Tip trail: the circle the staff ends carve, drawn as a partial arc that
     chases the spin. r=26 → circumference ≈ 163: one-third lit, two-thirds
     gap, offset animated a full lap per staff revolution. */
  .trail {
    fill: none;
    stroke: var(--tip);
    stroke-width: 2.4;
    stroke-linecap: round;
    opacity: 0.8;
    stroke-dasharray: 55 110;
    stroke-dashoffset: 0;
    animation: trail-chase 3.2s linear infinite;
  }

  .staff {
    animation: spin 3.2s linear infinite;
    transform-box: fill-box;
    transform-origin: center;
  }

  .prop.red .staff {
    animation-direction: reverse;
  }

  .prop.red .trail {
    animation-direction: reverse;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes trail-chase {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: -165; }
  }

  @media (prefers-reduced-motion: reduce) {
    .staff,
    .trail {
      animation: none;
    }
  }
</style>

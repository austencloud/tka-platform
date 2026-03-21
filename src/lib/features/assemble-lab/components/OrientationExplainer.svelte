<!--
  OrientationExplainer.svelte - Bottom sheet explaining the orientation concept.
  Interactive SVG demo using the actual staff.svg prop shape, positioned at the
  south hand point with correct proportional distance from center (950x950 scene).
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  let demoOrientation = $state<Orientation>(Orientation.IN);

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in" },
    { value: Orientation.OUT, label: "out" },
    { value: Orientation.CLOCK, label: "clock" },
    { value: Orientation.COUNTER, label: "counter" },
  ] as const;

  // Rotation angle for the demo prop at "south" position.
  // Values match DIAMOND_PROP_ANGLES from rotation-maps.ts for location "s".
  // CSS rotate: 0°=right, 90°=down, 180°=left, -90°=up.
  const demoRotation = $derived.by(() => {
    switch (demoOrientation) {
      case Orientation.IN: return -90;      // reference end points UP (toward center)
      case Orientation.OUT: return 90;      // reference end points DOWN (away from center)
      case Orientation.CLOCK: return 180;   // reference end points LEFT (clockwise tangent)
      case Orientation.COUNTER: return 0;   // reference end points RIGHT (counter-clockwise tangent)
      default: return -90;
    }
  });

  function handleClose() {
    isOpen = false;
  }
</script>

<Drawer
  bind:isOpen
  placement="bottom"
  ariaLabel="Orientation explained"
  showHandle={true}
  closeOnBackdrop={true}
  class="orientation-explainer-sheet"
>
  <div class="explainer">
    <h3 class="explainer-title">Orientation</h3>
    <p class="explainer-desc">
      Orientation is which direction the prop faces relative to the center of the grid.
      The crossbar marks the thumb (reference) end. Tap each option to see the prop rotate.
    </p>

    <!-- Interactive demo: uses actual staff.svg path at real grid proportions.
         Coordinates from the 950x950 pictograph scene:
         - Center: (475, 475)
         - South hand point: (475, 618.1)
         - Staff viewBox: 0 0 252.8 77.8, center at (126.4, 38.9)
         - Staff origin: hand point minus staff center = (348.6, 579.2) -->
    <div class="demo-area">
      <svg viewBox="300 410 350 360" class="demo-svg">
        <!-- Center dot + label -->
        <circle cx="475" cy="475" r="10" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" />
        <circle cx="475" cy="475" r="3" fill="rgba(255,255,255,0.7)" />
        <text x="475" y="455" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="18" font-weight="600">
          center
        </text>

        <!-- Dashed line from center to hand point -->
        <line
          x1="475" y1="482" x2="475" y2="610"
          stroke="rgba(255,255,255,0.08)"
          stroke-width="1.5"
          stroke-dasharray="6 6"
        />

        <!-- Hand point dot (south position) -->
        <circle cx="475" cy="618.1" r="6" fill="rgba(255,255,255,0.35)" />

        <!-- Staff prop: actual staff.svg path from static/images/props/pictograph/staff.svg.
             The T-shaped crossbar at the right end is the thumb reference indicator. -->
        <g class="demo-prop" style="transform-origin: 475px 618.1px; transform: rotate({demoRotation}deg)">
          <g transform="translate(348.6, 579.2)">
            <path d="M251.4 67.7V10.1c0-4.8-4.1-8.7-9.1-8.7s-9.1 3.9-9.1 8.7v19.2H10.3c-4.9 0-8.9 3.8-8.9 8.5V41c0 4.6 4 8.5 8.9 8.5h222.9v18.2c0 4.8 4.1 8.7 9.1 8.7s9.1-3.9 9.1-8.7z" fill="#2e3192"/>
          </g>
        </g>
      </svg>
    </div>

    <!-- Orientation pills -->
    <div class="demo-pills" role="radiogroup" aria-label="Demo orientation">
      {#each ORIENTATIONS as ori}
        <button
          class="demo-pill"
          class:active={demoOrientation === ori.value}
          role="radio"
          aria-checked={demoOrientation === ori.value}
          onclick={() => { demoOrientation = ori.value; }}
        >
          {ori.label}
        </button>
      {/each}
    </div>

    <button class="got-it-btn" onclick={handleClose}>
      Got it
    </button>
  </div>
</Drawer>

<style>
  :global(.orientation-explainer-sheet) {
    --sheet-bg: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    --sheet-filter: none;
    z-index: 300 !important;
  }

  .explainer {
    padding: 8px 24px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .explainer-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
  }

  .explainer-desc {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-align: center;
    margin: 0;
    max-width: 300px;
    line-height: 1.5;
  }

  .demo-area {
    width: 100%;
    max-width: 240px;
  }

  .demo-svg {
    width: 100%;
    height: auto;
  }

  .demo-prop {
    transition: transform 250ms ease;
    filter: drop-shadow(0 0 4px rgba(46, 49, 146, 0.6));
  }

  .demo-pills {
    display: flex;
    gap: 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 12px;
    padding: 4px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .demo-pill {
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    transition: background 0.15s ease, color 0.15s ease;
  }

  .demo-pill.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
  }

  .demo-pill:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  .got-it-btn {
    padding: 12px 32px;
    border: 1.5px solid var(--theme-accent, #6366f1);
    border-radius: 12px;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    min-height: var(--min-touch-target, 44px);
    width: 100%;
    max-width: 300px;
  }

  .got-it-btn:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 30%, var(--theme-card-bg, rgba(0, 0, 0, 0.6)));
  }

  .got-it-btn:focus-visible {
    outline: 2px solid var(--theme-text, #fff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .demo-prop {
      transition: none;
    }
  }
</style>

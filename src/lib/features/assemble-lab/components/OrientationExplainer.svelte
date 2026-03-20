<!--
  OrientationExplainer.svelte - Bottom sheet explaining the orientation concept.
  Interactive SVG demo with a staff prop (including gold reference-end markers)
  that rotates to show each orientation relative to center.
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
  // "In" points toward center (up), others rotate from there.
  const demoRotation = $derived.by(() => {
    switch (demoOrientation) {
      case Orientation.IN: return 0;
      case Orientation.OUT: return 180;
      case Orientation.CLOCK: return 90;
      case Orientation.COUNTER: return -90;
      default: return 0;
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
      The gold bands mark the reference end. Tap each option to see the prop rotate.
    </p>

    <!-- Interactive demo -->
    <div class="demo-area">
      <svg viewBox="0 0 200 180" class="demo-svg">
        <!-- Center dot + label -->
        <circle cx="100" cy="45" r="4" fill="rgba(255,255,255,0.3)" />
        <text x="100" y="36" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="11">
          center
        </text>

        <!-- Dashed line from center to grid point -->
        <line
          x1="100" y1="50" x2="100" y2="115"
          stroke="rgba(255,255,255,0.08)"
          stroke-width="1"
          stroke-dasharray="4 4"
        />

        <!-- Grid point dot -->
        <circle cx="100" cy="125" r="4" fill="rgba(255,255,255,0.35)" />

        <!-- Staff prop with gold reference bands -->
        <g class="demo-prop" style="transform-origin: 100px 125px; transform: rotate({demoRotation}deg)">
          <!-- Staff body -->
          <rect x="64" y="121" width="72" height="8" rx="4" fill="#2e3192" />
          <!-- Gold reference-end double bands (on one end) -->
          <rect x="123" y="119" width="2.5" height="12" rx="1.25" fill="#c9ac68" />
          <rect x="128" y="119" width="2.5" height="12" rx="1.25" fill="#c9ac68" />
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
    max-width: 200px;
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

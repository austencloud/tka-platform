<!--
  OrientationExplainer.svelte - Slide-up panel explaining orientation concept.
  Uses component-local state for the interactive demo.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { PropRotAngleManager } from "$lib/shared/pictograph/prop/services/implementations/PropRotAngleManager";
  import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/implementations/PropSvgLoader";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import type { PropRenderData } from "$lib/shared/pictograph/prop/domain/models/PropRenderData";
  import { LOCATION_ANGLES } from "$lib/features/compose/shared/domain/math-constants";

  let { isOpen = $bindable(false) }: { isOpen: boolean } = $props();

  // Local demo state — completely isolated from builder
  let demoOrientation = $state<Orientation>(Orientation.IN);
  let showArrow = $state(false);
  let arrowTimeout: ReturnType<typeof setTimeout> | null = null;

  const DEMO_LOCATION = GridLocation.SOUTH;

  const ORIENTATIONS = [
    { value: Orientation.IN, label: "in" },
    { value: Orientation.OUT, label: "out" },
    { value: Orientation.CLOCK, label: "clock" },
    { value: Orientation.COUNTER, label: "counter" },
  ] as const;

  // Load a prop SVG for the demo
  let demoPropData = $state<PropRenderData | null>(null);

  $effect(() => {
    const settings = getSettings();
    const propType = settings.bluePropType ?? PropType.STAFF;
    const motion = createMotionData({ propType, color: MotionColor.BLUE });
    propSvgLoader.loadPropSvg(
      { positionX: 0, positionY: 0, rotationAngle: 0 },
      motion,
      false,
    ).then(data => { demoPropData = data; }).catch(() => {});
  });

  const propCenter = $derived(demoPropData?.svgData?.center ?? { x: 0, y: 0 });

  const demoRotation = $derived(
    PropRotAngleManager.calculateRotation(DEMO_LOCATION, demoOrientation, GridMode.DIAMOND)
  );

  // Arrow direction for demo
  const arrowDeg = $derived.by(() => {
    const theta = LOCATION_ANGLES[DEMO_LOCATION];
    const thetaDeg = theta * (180 / Math.PI);
    switch (demoOrientation) {
      case Orientation.IN: return thetaDeg + 180;
      case Orientation.OUT: return thetaDeg;
      case Orientation.CLOCK: return thetaDeg + 90;
      case Orientation.COUNTER: return thetaDeg - 90;
      default: return thetaDeg;
    }
  });

  function selectDemo(ori: Orientation): void {
    demoOrientation = ori;
    showArrow = true;
    if (arrowTimeout) clearTimeout(arrowTimeout);
    arrowTimeout = setTimeout(() => { showArrow = false; }, 1000);
  }
</script>

<Drawer bind:isOpen placement="bottom" ariaLabel="Orientation explained">
  <div class="explainer">
    <h3 class="explainer-title">Orientation</h3>
    <p class="explainer-desc">
      Orientation is which direction the prop faces relative to the center of the grid.
      Tap each option to see the prop rotate.
    </p>

    <!-- Interactive demo -->
    <div class="demo-area">
      <svg viewBox="0 0 300 300" class="demo-svg">
        <!-- Center dot -->
        <circle cx="150" cy="120" r="6" fill="var(--theme-text-muted, rgba(255,255,255,0.3))" />
        <text x="150" y="108" text-anchor="middle" fill="var(--theme-text-muted, rgba(255,255,255,0.3))" font-size="12">center</text>
        <!-- Grid point dot (south of center) -->
        <circle cx="150" cy="220" r="6" fill="var(--theme-text-dim, rgba(255,255,255,0.5))" />

        <!-- Prop at south position -->
        {#if demoPropData?.svgData}
          <g
            class="demo-prop"
            style="transform: translate(150px, 220px) rotate({demoRotation}deg) translate({-propCenter.x}px, {-propCenter.y}px)"
          >
            {@html demoPropData.svgData.svgContent}
          </g>
        {:else}
          <rect
            x="120"
            y="217"
            width="60"
            height="6"
            rx="3"
            fill="var(--prop-blue, #2e8bf0)"
            class="demo-prop"
            style="transform-origin: 150px 220px; transform: rotate({demoRotation}deg)"
          />
        {/if}

        <!-- Direction arrow -->
        {#if showArrow}
          <g
            class="demo-arrow"
            style="transform: translate(150px, 220px) rotate({arrowDeg}deg)"
          >
            <line x1="0" y1="0" x2="50" y2="0" stroke="var(--theme-accent, #6366f1)" stroke-width="3" stroke-linecap="round" />
            <polygon points="50,-6 62,0 50,6" fill="var(--theme-accent, #6366f1)" />
          </g>
        {/if}
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
          onclick={() => selectDemo(ori.value)}
        >
          {ori.label}
        </button>
      {/each}
    </div>

    <button class="got-it-btn" onclick={() => { isOpen = false; }}>
      Got it
    </button>
  </div>
</Drawer>

<style>
  .explainer {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
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
    max-width: 280px;
    aspect-ratio: 1;
  }

  .demo-svg {
    width: 100%;
    height: 100%;
  }

  .demo-prop {
    transition: transform 200ms ease;
    filter: drop-shadow(0 0 6px var(--prop-blue, #2e8bf0));
  }

  .demo-arrow {
    animation: demo-arrow-fade 1s ease forwards;
    filter: drop-shadow(0 0 8px var(--theme-accent, #6366f1));
  }

  @keyframes demo-arrow-fade {
    0% { opacity: 0; }
    10% { opacity: 0.9; }
    70% { opacity: 0.9; }
    100% { opacity: 0; }
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

    .demo-arrow {
      animation: none;
      opacity: 0.7;
    }
  }
</style>

<!--
  ShopMorphLayer — the shared-element morph overlay for the shop.

  Mounted once (persists across grid<->detail navigation), it registers a ghost
  runner with the coordinator. When a morph starts, it renders a fixed-position
  "ghost" cover sized to the DESTINATION rect, pre-transformed to the SOURCE rect
  (FLIP inverse), then springs the transform to identity with Motion — an
  interruptible, velocity-carrying, compositor (WAAPI) animation. The real
  destination cover is hidden until the ghost lands, then revealed (onDone).
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { animate } from "motion";
  import CardMockupPreview from "../components/CardMockupPreview.svelte";
  import {
    setMorphRunner,
    type MorphRect,
    type MorphVisual,
  } from "./shop-morph";

  let ghostEl: HTMLDivElement | undefined = $state();
  let active = $state(false);
  let visual = $state<MorphVisual | null>(null);
  let box = $state<MorphRect>({ top: 0, left: 0, width: 0, height: 0 });
  // Inline transform for the FIRST paint so the ghost appears at the SOURCE rect
  // with no flash at the destination before Motion takes over.
  let initialTransform = $state("");

  let controls: { stop: () => void } | null = null;
  let currentOnDone: (() => void) | null = null;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;

  function finish() {
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
    controls = null;
    active = false;
    visual = null;
    const done = currentOnDone;
    currentOnDone = null;
    done?.();
  }

  onMount(() => {
    setMorphRunner((from, to, v, onDone) => {
      // Interruption: stop any in-flight morph and reveal its target first so
      // nothing is ever left stuck-hidden, then start the new one.
      controls?.stop();
      if (currentOnDone) {
        const prev = currentOnDone;
        currentOnDone = null;
        prev();
      }
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }

      currentOnDone = onDone;
      visual = v;
      box = { top: to.top, left: to.left, width: to.width, height: to.height };

      // FLIP: the ghost lives at the destination box. Invert it to the source.
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = from.width / to.width;
      const sy = from.height / to.height;
      initialTransform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      active = true;

      // Safety net: if Motion never resolves (error / lost frame), reveal anyway.
      safetyTimer = setTimeout(finish, 1400);

      tick().then(() => {
        if (!ghostEl) {
          finish();
          return;
        }
        ghostEl.style.transformOrigin = "top left";
        try {
          controls = animate(
            ghostEl,
            { x: [dx, 0], y: [dy, 0], scaleX: [sx, 1], scaleY: [sy, 1] },
            {
              // Near-critically-damped spring (bounce ~0.16): premium "lands and
              // settles", no toy-like overshoot. Interruptible + velocity-aware.
              type: "spring",
              duration: 0.55,
              bounce: 0.16,
              onComplete: finish,
            }
          );
        } catch {
          finish();
        }
      });
    });

    return () => {
      setMorphRunner(null);
      controls?.stop();
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  });
</script>

{#if active && visual}
  <div
    bind:this={ghostEl}
    class="morph-ghost"
    style:top="{box.top}px"
    style:left="{box.left}px"
    style:width="{box.width}px"
    style:height="{box.height}px"
    style:transform={initialTransform}
    style:transform-origin="top left"
    aria-hidden="true"
  >
    <CardMockupPreview
      coverImageUrl={visual.coverImageUrl}
      productName={visual.productName}
    />
  </div>
{/if}

<style>
  .morph-ghost {
    position: fixed;
    z-index: 50; /* above page content, below modals/header */
    pointer-events: none;
    will-change: transform;
  }

  /* Force the inner cover to fill the ghost box exactly (the box is already a 3/4
     cover rect, so this matches the real cover's aspect). */
  .morph-ghost :global(.mockup-container) {
    width: 100%;
    height: 100%;
  }
</style>

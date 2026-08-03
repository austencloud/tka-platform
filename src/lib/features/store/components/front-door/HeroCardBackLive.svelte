<!-- src/lib/features/store/components/front-door/HeroCardBackLive.svelte -->
<!--
  The hero's back card: a real CardBack render of the SAME sequence the printed
  front shows, with its mandala drawn live instead of standing still.

  The printed card's mandala is a finished figure. On screen the props trace it
  in front of you, so what the card records and what the card describes are the
  same picture — the argument the hero is making, made visually.

  ALIGNMENT — SIZE. The player's canvas and the card's mandala are two
  coordinate frames that have to coincide. The animation engine puts the hand
  orbit at 150 of a 950 viewBox — 0.1579 of its square. The mandala renderer
  self-fits: its hand circle lands at MANDALA_GRID_RADIUS / (2 · maxExtent ·
  1.05) of its own box. `alignScale` (shape-matrix/services/mandala-hero.ts) is
  the ratio between them, and ShapeMatrixDrill applies it by shrinking the
  MANDALA into the engine's square. Here the mandala is the printed one and may
  not move, so the same equation is solved the other way: the engine's square
  is scaled UP by 1/alignScale. Same correspondence, opposite side. The square
  then runs wider than the card, but nothing is painted out there — the props
  reach the mandala's own radius and stop — so the card's overflow clip never
  cuts anything visible.

  ALIGNMENT — CENTRE. Size is arithmetic; position is not. The scaled square is
  larger than every box it sits in, and CSS centring of an overflowing item is
  not something to take on faith (grid gave it its own auto track and
  start-aligned it, which put the drawn figure 39px down-right of the printed
  one). So the centre is MEASURED: the printed mandala's box comes back from
  CardBack's `onMandalaBox` hook, the engine's canvas is read from inside this
  square, and the leftover difference between the two centres is applied as a
  translate. Both reads are in untransformed layout space (hero-layout-measure),
  because the card is rotated 5° and a viewport-space delta would arrive at the
  wrong angle. Re-measured whenever either box changes size or mounts.

  Three props make the layering work, all load-bearing (see ShapeMatrixDrill):
  backgroundAlpha 0 keeps the canvas transparent so the printed mandala shows
  through; trailSettingsOverride carries the hero-scale trail without touching
  the global settings singleton; tipEffectMap is what the render loop's trail
  gate actually reads — omit it and zero trails draw whatever the settings say.
-->
<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import CardBack from "$lib/features/choreo-card/components/card-back/CardBack.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import { alignScale } from "$lib/shared/shape-matrix/services/mandala-hero";
  import { MANDALA_STANDARD_TIP_DX } from "$lib/shared/mandala/domain/mandala-constants";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import {
    HERO_TRAIL_PRESET,
    HERO_TIP_EFFECT_MAP,
  } from "$lib/shared/landing/data/hero-trail-preset";
  import { layoutCentreWithin, observeLayout } from "./hero-layout-measure";

  interface Props {
    sequence: SequenceData;
    /** Latched by the scan cue's first sweep. Mounts the player once. */
    drawActive: boolean;
    /** Sweep counter — the card flares on each new pass. */
    cycle: number;
    /** False under reduced motion: no overlay at all, and the printed mandala
     *  keeps its full strength instead of ghosting under a layer that will
     *  never draw. */
    live: boolean;
  }
  let { sequence, drawActive, cycle, live }: Props = $props();

  // CardBack never overrides tipDx, so its mandala is drawn at the standard tip
  // distance; that is the figure the engine box has to agree with.
  const ENGINE_BOX_RATIO = 1 / alignScale(MANDALA_STANDARD_TIP_DX);

  // The square grows about the overlay box's centre, so it hangs out by half
  // the excess on every side. Expressing that as a negative inset (rather than
  // a width plus a -50% translate) keeps the centring in LAYOUT — transforms
  // are invisible to offsetLeft/offsetTop, and the residual measurement below
  // reads exactly those.
  const ENGINE_INSET = ((1 - ENGINE_BOX_RATIO) / 2) * 100;

  // Same prop types the card's own mandala derives its tip count from, so the
  // traced locus and the drawn locus are the same curve.
  const bluePropType = $derived(settingsService.settings.bluePropType);
  const redPropType = $derived(settingsService.settings.redPropType);

  // ── measured centring (see ALIGNMENT — CENTRE above) ─────────────────────
  let heroBackEl = $state<HTMLDivElement | null>(null);
  let engineBoxEl = $state<HTMLDivElement | null>(null);
  let printedMandalaEl = $state<HTMLDivElement | null>(null);
  let offset = $state({ x: 0, y: 0 });

  $effect(() => {
    const root = heroBackEl;
    const printed = printedMandalaEl;
    const box = engineBoxEl;
    if (!root || !printed || !box) return;

    return observeLayout(root, () => {
      // The engine's own canvas, not the square it was given — the player may
      // letterbox inside it, and the canvas is what paints.
      const canvas = box.querySelector("canvas");
      if (!canvas) return false;
      const target = layoutCentreWithin(printed, root);
      // Read the canvas where it lies; the correcting translate is a transform,
      // which layout offsets ignore, so this never chases its own tail.
      const drawn = layoutCentreWithin(canvas, root);
      if (!target || !drawn || !canvas.offsetWidth) return false;
      const x = Math.round((target.x - drawn.x) * 100) / 100;
      const y = Math.round((target.y - drawn.y) * 100) / 100;
      if (x !== offset.x || y !== offset.y) offset = { x, y };
      return true;
    });
  });
</script>

{#snippet drawnMandala()}
  <div
    class="engine-box"
    bind:this={engineBoxEl}
    style:inset="{ENGINE_INSET}%"
    style:transform="translate({offset.x}px, {offset.y}px)"
  >
    <LazyMount
      loader={() =>
        import(
          "$lib/features/browse/sequences/display/components/media-viewer/InlineAnimationPlayer.svelte"
        )}
      active={drawActive}
      debugName="shop hero animation player"
      props={{
        sequence,
        autoPlay: true,
        chrome: "minimal",
        fill: true,
        showControls: false,
        interactive: false,
        disableContextMenu: true,
        beatIndicators: false,
        hideStepNumbers: true,
        hideTkaGlyph: true,
        gridVisible: false,
        bluePropType,
        redPropType,
        trailSettingsOverride: HERO_TRAIL_PRESET,
        tipEffectMap: HERO_TIP_EFFECT_MAP,
        backgroundAlpha: 0,
      }}
    />
  </div>
{/snippet}

<div class="hero-back" bind:this={heroBackEl}>
  <CardBack
    {sequence}
    mandalaOverlay={live ? drawnMandala : undefined}
    onMandalaBox={(el) => (printedMandalaEl = el)}
  />

  <!-- Each sweep lands on the card, not only the first: a short bloom, keyed so
       it restarts per pass without remounting the engine underneath. -->
  {#if live && cycle > 0}
    {#key cycle}
      <span class="flare" aria-hidden="true"></span>
    {/key}
  {/if}
</div>

<style>
  .hero-back {
    position: relative;
    width: 100%;
    height: 100%;
  }

  /* Sized and centred by the negative inset above, on the overlay box CardBack
     hands us — which is the printed mandala's box — then nudged by the
     measured residual. */
  .engine-box {
    position: absolute;
    pointer-events: none;
  }

  .flare {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: card-flare 1100ms ease-out forwards;
  }

  @keyframes card-flare {
    0% {
      box-shadow: inset 0 0 0 0.2rem rgba(126, 224, 255, 0.5);
    }
    100% {
      box-shadow: inset 0 0 0 0.2rem rgba(126, 224, 255, 0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flare {
      animation: none;
    }
  }
</style>

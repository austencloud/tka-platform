<!-- src/lib/features/store/components/front-door/HeroCardBackLive.svelte -->
<!--
  The hero's back card: a real CardBack render of the SAME sequence the printed
  front shows, with its mandala drawn live instead of standing still.

  The printed card's mandala is a finished figure. On screen the props trace it
  in front of you, so what the card records and what the card describes are the
  same picture — the argument the hero is making, made visually.

  ALIGNMENT. The player's canvas and the card's mandala are two coordinate
  frames that have to coincide. The animation engine puts the hand orbit at
  150 of a 950 viewBox — 0.1579 of its square. The mandala renderer self-fits:
  its hand circle lands at MANDALA_GRID_RADIUS / (2 · maxExtent · 1.05) of its
  own box. `alignScale` (shape-matrix/services/mandala-hero.ts) is the ratio
  between them, and ShapeMatrixDrill applies it by shrinking the MANDALA into
  the engine's square. Here the mandala is the printed one and may not move, so
  the same equation is solved the other way: the engine's square is scaled UP by
  1/alignScale about the mandala's centre. Same correspondence, opposite side.
  The overlay box then runs wider than the card, but nothing is painted out
  there — the props reach the mandala's own radius and stop — so the card's
  overflow clip never cuts anything visible.

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

  // Same prop types the card's own mandala derives its tip count from, so the
  // traced locus and the drawn locus are the same curve.
  const bluePropType = $derived(settingsService.settings.bluePropType);
  const redPropType = $derived(settingsService.settings.redPropType);
</script>

{#snippet drawnMandala()}
  <div
    class="engine-box"
    style:width="calc(var(--card-mandala-size, 72cqi) * {ENGINE_BOX_RATIO})"
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

<div class="hero-back">
  <CardBack {sequence} mandalaOverlay={live ? drawnMandala : undefined} />

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

  .engine-box {
    aspect-ratio: 1;
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

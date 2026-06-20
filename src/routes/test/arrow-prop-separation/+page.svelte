<script lang="ts">
  // THROWAWAY comparison harness for brainstorming arrow/prop separation treatments.
  // Reconstructs the exact Δ (doublestar) overlap pictograph from Austen's data dump
  // and renders it under several CSS-only arrow treatments scoped to `.arrow-svg`.
  // Props are a different class, so they stay untouched — only the arrow gets the halo/outline/shade.
  import { onMount } from "svelte";
  import PictographRenderer from "$lib/shared/pictograph/shared/components/PictographRenderer.svelte";
  import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/create-pictograph-data";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import type { PreparedPictographData } from "$lib/shared/pictograph/shared/domain/models/prepared-pictograph-data";
  import {
    MotionType,
    MotionColor,
    RotationDirection,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    GridLocation,
    GridMode,
    GridPosition,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // Exact reconstruction of the reported step (Δ, alpha3 → gamma1, doublestar)
  const blue = createMotionData({
    color: MotionColor.BLUE,
    motionType: MotionType.STATIC,
    turns: 1.5,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.WEST,
    endLocation: GridLocation.WEST,
    arrowLocation: GridLocation.WEST,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.CLOCK,
    propType: PropType.DOUBLESTAR,
    gridMode: GridMode.DIAMOND,
  });

  const red = createMotionData({
    color: MotionColor.RED,
    motionType: MotionType.ANTI,
    turns: 0,
    rotationDirection: RotationDirection.CLOCKWISE,
    startLocation: GridLocation.EAST,
    endLocation: GridLocation.NORTH,
    arrowLocation: GridLocation.NORTHEAST,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.OUT,
    propType: PropType.DOUBLESTAR,
    gridMode: GridMode.DIAMOND,
  });

  const raw = createPictographData({
    // letter glyph intentionally omitted (showTKA={false}); only prop/arrow overlap matters here
    startPosition: GridPosition.ALPHA3,
    endPosition: GridPosition.GAMMA1,
    motions: { blue, red },
  });

  let prepared = $state<PreparedPictographData | null>(null);
  let preparedLight = $state<PreparedPictographData | null>(null);

  onMount(async () => {
    try {
      prepared = await pictographPreparer.prepareSingle(raw, {
        themeMode: "dark",
        bluePropType: PropType.DOUBLESTAR,
        redPropType: PropType.DOUBLESTAR,
      });
      preparedLight = await pictographPreparer.prepareSingle(raw, {
        themeMode: "light",
        bluePropType: PropType.DOUBLESTAR,
        redPropType: PropType.DOUBLESTAR,
      });
    } catch (e) {
      console.error("prepareSingle failed", e);
      prepared = raw as unknown as PreparedPictographData;
    }
  });

  const panels = [
    {
      cls: "baseline",
      title: "0 · Baseline (current)",
      note: "What ships today in dark mode. Blue arrow melts into blue prop.",
    },
    {
      cls: "halo-thin",
      title: "A · BG halo — thin",
      note: "drop-shadow ×2 in bg color (#0a0a0f). Always on. Invisible vs bg, gap only on prop. Recommended.",
    },
    {
      cls: "halo-med",
      title: "A · BG halo — medium",
      note: "Same idea, fatter gap (×3). Tune to taste.",
    },
    {
      cls: "outline-crisp",
      title: "B · Crisp dark outline",
      note: "4-way 0-blur bg-color stroke. Sharper edge than the soft halo.",
    },
    {
      cls: "outline-white",
      title: "B · Crisp light outline",
      note: "Contrasting (light) outline. Reads strongly but visible everywhere — why B wants overlap-gating.",
    },
    {
      cls: "twotone",
      title: "C · Two-tone shade",
      note: "Arrow darkened to a deeper shade of the same hue (no border). Depth via tone. Global recolor.",
    },
  ];
</script>

<div class="page">
  <header>
    <h1>Arrow / prop separation — Δ doublestar overlap (dark mode)</h1>
    <p>
      Same pictograph, six arrow treatments. Only the arrow is touched (CSS filter scoped to
      <code>.arrow-svg</code>); props are untouched. Look at the blue arrow vs the blue doublestar.
    </p>
  </header>

  {#if !prepared}
    <p class="loading">Preparing pictograph…</p>
  {:else}
    <div class="grid">
      {#each panels as p}
        <figure class="cell {p.cls}">
          <div class="frame">
            <PictographRenderer
              pictograph={prepared}
              darkMode={true}
              showGrid={true}
              showTKA={false}
              showReversals={false}
              gridModeOverride={GridMode.DIAMOND}
            />
          </div>
          <figcaption>
            <strong>{p.title}</strong>
            <span>{p.note}</span>
          </figcaption>
        </figure>
      {/each}
    </div>

    <h2>Light mode — production halo (white ×3 @2px), before / after</h2>
    <p class="sub">
      Renders with <code>darkMode=&#123;false&#125;</code> + light theme. No toggle needed.
    </p>
    {#if preparedLight}
      <div class="grid light-grid">
        <figure class="cell light-off">
          <div class="frame">
            <PictographRenderer
              pictograph={preparedLight}
              darkMode={false}
              showGrid={true}
              showTKA={false}
              showReversals={false}
              gridModeOverride={GridMode.DIAMOND}
            />
          </div>
          <figcaption>
            <strong>Light · before (halo off)</strong>
            <span>filter forced to none — the melt, in light theme.</span>
          </figcaption>
        </figure>
        <figure class="cell">
          <div class="frame">
            <PictographRenderer
              pictograph={preparedLight}
              darkMode={false}
              showGrid={true}
              showTKA={false}
              showReversals={false}
              gridModeOverride={GridMode.DIAMOND}
            />
          </div>
          <figcaption>
            <strong>Light · after (production)</strong>
            <span>The shipped white halo — light-friendly counterpart of dark.</span>
          </figcaption>
        </figure>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    background: #050507;
    color: #e6e6ea;
    padding: 24px;
    font-family: system-ui, sans-serif;
  }
  header h1 {
    font-size: 20px;
    margin: 0 0 6px;
  }
  header p {
    color: #9a9aa6;
    max-width: 70ch;
    margin: 0 0 20px;
  }
  code {
    background: #1a1a22;
    padding: 1px 5px;
    border-radius: 4px;
  }
  .loading {
    color: #9a9aa6;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }
  .cell {
    margin: 0;
    background: #0d0d12;
    border: 1px solid #1e1e28;
    border-radius: 12px;
    overflow: hidden;
  }
  .frame {
    aspect-ratio: 1 / 1;
    width: 100%;
  }
  figcaption {
    padding: 10px 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  figcaption strong {
    font-size: 14px;
  }
  figcaption span {
    font-size: 12px;
    color: #8f8f9b;
    line-height: 1.4;
  }

  /* ---- Treatments: scoped to the arrow group only ---- */
  /* :global needed because .arrow-svg lives inside the child component */

  /* A — background-matching soft halo (invisible vs bg, gap on prop) */
  .halo-thin :global(.arrow-svg) {
    filter: drop-shadow(0 0 1.5px #0a0a0f) drop-shadow(0 0 1.5px #0a0a0f);
  }
  .halo-med :global(.arrow-svg) {
    filter: drop-shadow(0 0 2px #0a0a0f) drop-shadow(0 0 2px #0a0a0f)
      drop-shadow(0 0 2px #0a0a0f);
  }

  /* B — crisp 4-way outline (0 blur) */
  .outline-crisp :global(.arrow-svg) {
    filter: drop-shadow(1.5px 0 0 #0a0a0f) drop-shadow(-1.5px 0 0 #0a0a0f)
      drop-shadow(0 1.5px 0 #0a0a0f) drop-shadow(0 -1.5px 0 #0a0a0f);
  }
  .outline-white :global(.arrow-svg) {
    filter: drop-shadow(1.2px 0 0 #c9c9d2) drop-shadow(-1.2px 0 0 #c9c9d2)
      drop-shadow(0 1.2px 0 #c9c9d2) drop-shadow(0 -1.2px 0 #c9c9d2);
  }

  /* C — two-tone: darken the arrow to a deeper shade of the same hue */
  .twotone :global(.arrow-svg) {
    filter: brightness(0.68) saturate(1.15);
  }

  h2 {
    font-size: 16px;
    margin: 32px 0 4px;
  }
  .sub {
    color: #8f8f9b;
    font-size: 12px;
    margin: 0 0 14px;
  }
  /* "before" panel: strip the production inline halo to show the melt.
     !important needed to beat the component's inline style filter. */
  .light-off :global(.arrow-svg) {
    filter: none !important;
  }
</style>

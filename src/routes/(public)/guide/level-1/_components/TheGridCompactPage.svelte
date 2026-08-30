<script lang="ts">
  /**
   * Compact web composition for viewports where the fixed 8.5x11 sheet would
   * have to shrink below readable type. It preserves the authored page's two
   * teaching relationships: the labelled point system and the visual equation
   * Diamond + Box = 8-point grid. The printable page remains TheGridPage.
   */
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { THE_GRID_ALPHA3 } from "../_data/the-grid-pictograph";

  type GridFigure = "diamond" | "box" | "merged";

  const gridLabel = (type: GridFigure) =>
    type === "diamond"
      ? "Diamond grid: four points at north, east, south, and west"
      : type === "box"
        ? "Box grid: four points on the diagonals"
        : "8-point grid: diamond and box combined";
</script>

{#snippet gridFigure(type: GridFigure)}
  <svg
    class="grid-figure"
    viewBox="0 0 950 950"
    role="img"
    aria-label={gridLabel(type)}
  >
    <desc>{gridLabel(type)}</desc>
    <rect width="950" height="950" fill="#ffffff" />
    {#if type === "merged"}
      <GridSvg gridMode={GridMode.DIAMOND} darkMode={false} />
      <GridSvg gridMode={GridMode.BOX} darkMode={false} />
    {:else}
      <GridSvg
        gridMode={type === "box" ? GridMode.BOX : GridMode.DIAMOND}
        darkMode={false}
      />
    {/if}
  </svg>
{/snippet}

<article class="compact-page">
  <header class="compact-intro">
    <div class="guide-title" aria-hidden="true">The Grid</div>
    <p class="lead">The Kinetic Alphabet is based on a 4-point grid.</p>
    <p>
      There are two 4-point grids: box mode and diamond mode.
      <strong
        >This guide is written in diamond, but everything translates to box.</strong
      >
    </p>
    <p>On this grid, there are three types of points:</p>
  </header>

  <section class="point-system" aria-labelledby="point-system-heading">
    <h2 id="point-system-heading" class="sr-only">
      The three types of grid points
    </h2>
    <div class="point-copy">
      <p>
        <strong>The center point</strong> is the hub that everything revolves around.
      </p>
      <p>
        <strong>The four hand points</strong> are halfway between the center point
        and the outer points.
      </p>
      <p>
        <strong>The outer points</strong> depict the outer edges of the grid.
      </p>
    </div>

    <figure class="annotated-figure">
      <div class="diagram-art">
        {#if THE_GRID_ALPHA3}
          <PictographContainer
            pictographData={THE_GRID_ALPHA3}
            gridMode={GridMode.DIAMOND}
            bluePropTypeOverride={PropType.HAND}
            redPropTypeOverride={PropType.HAND}
            showGrid={true}
            showTKA={false}
            showPositions={false}
            showReversals={false}
            showTnD={false}
            showElemental={false}
            showNonRadialPoints={false}
            showHandPoints={true}
            darkMode={false}
            printMode={true}
            disableTransitions={true}
          />
        {/if}
      </div>
      <svg class="callouts" viewBox="0 0 360 330" aria-hidden="true">
        <defs>
          <marker
            id="compact-arrowhead"
            markerWidth="7"
            markerHeight="7"
            refX="5.5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" />
          </marker>
        </defs>
        <g class="callout-lines">
          <path d="M292 44 L126 148" />
          <path d="M292 44 L234 148" />
          <path d="M69 294 L180 165" />
          <path d="M294 292 L280 148" />
          <path d="M294 292 L180 260" />
        </g>
        <g class="callout-labels">
          <text x="286" y="20" text-anchor="middle"
            ><tspan x="286">hand</tspan><tspan x="286" dy="15">points</tspan
            ></text
          >
          <text x="58" y="304" text-anchor="middle"
            ><tspan x="58">center</tspan><tspan x="58" dy="15">point</tspan
            ></text
          >
          <text x="302" y="304" text-anchor="middle"
            ><tspan x="302">outer</tspan><tspan x="302" dy="15">points</tspan
            ></text
          >
        </g>
      </svg>
      <figcaption class="sr-only">
        Two hands on the diamond grid, with labels pointing to hand points, the
        center point, and outer points.
      </figcaption>
    </figure>
  </section>

  <section class="grid-combination" aria-labelledby="grid-combination-heading">
    <h2 id="grid-combination-heading">
      Together, diamond and box form an 8-point grid:
    </h2>
    <div
      class="equation"
      role="group"
      aria-label="Diamond plus Box equals the 8-point grid"
    >
      <figure>
        <figcaption>Diamond</figcaption>
        {@render gridFigure("diamond")}
      </figure>
      <span class="operator" aria-hidden="true">+</span>
      <figure>
        <figcaption>Box</figcaption>
        {@render gridFigure("box")}
      </figure>
      <span class="operator" aria-hidden="true">=</span>
      <figure>
        <figcaption>8-point grid</figcaption>
        {@render gridFigure("merged")}
      </figure>
    </div>
  </section>

  <p class="closing">We’ll use diamond mode to learn each concept.</p>
</article>

<style>
  .compact-page {
    width: min(100% - 1rem, 60rem);
    margin: 0 auto;
    padding: 1.25rem 1rem 1.5rem;
    box-sizing: border-box;
    background: #fff;
    color: #141414;
    font-family: "Times New Roman", Times, Georgia, serif;
  }

  .compact-intro {
    text-align: center;
  }

  .compact-intro .guide-title {
    position: static;
    font-size: clamp(3.5rem, 18vw, 5rem);
    line-height: 0.9;
    white-space: normal;
  }

  p {
    margin: 0 auto 0.75rem;
    max-width: 43rem;
    color: #141414;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.45;
  }

  p :global(strong) {
    color: #141414;
    font-weight: 700;
  }

  .lead {
    margin-top: 0.8rem;
    font-style: italic;
  }

  .point-system {
    display: grid;
    gap: 0.75rem;
    align-items: center;
    margin-top: 0.5rem;
  }

  .point-copy {
    order: 2;
  }

  .point-copy p {
    text-align: left;
  }

  .annotated-figure {
    position: relative;
    width: min(100%, 24rem);
    aspect-ratio: 360 / 330;
    margin: 0 auto;
  }

  .diagram-art {
    position: absolute;
    left: 13.9%;
    top: 3%;
    width: 72.2%;
    aspect-ratio: 1;
    border: 1px solid #c4c4cc;
    overflow: hidden;
  }

  .callouts {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .callout-lines path {
    fill: none;
    stroke: #222;
    stroke-width: 1.15;
    marker-end: url(#compact-arrowhead);
  }

  .callout-lines :global(path),
  .callouts marker path {
    fill: #222;
  }

  .callout-labels {
    fill: #141414;
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 14px;
  }

  .grid-combination {
    margin-top: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid #d7d4cd;
  }

  .grid-combination h2 {
    margin: 0 0 0.75rem;
    color: #141414;
    font-family: "Times New Roman", Times, Georgia, serif;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.35;
    text-align: center;
  }

  .equation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(
        0,
        1fr
      );
    align-items: center;
    gap: clamp(0.2rem, 1.5vw, 0.6rem);
  }

  .equation figure {
    min-width: 0;
    margin: 0;
  }

  .equation figcaption {
    min-height: 2.1em;
    margin-bottom: 0.3rem;
    font-family: var(--guide-display, "Cormorant Garamond", Georgia, serif);
    font-size: max(14px, clamp(0.875rem, 3vw, 1rem));
    font-style: italic;
    font-weight: 600;
    line-height: 1.05;
    text-align: center;
  }

  .grid-figure {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border: 1px solid #c4c4cc;
  }

  .grid-figure :global(.grid-container) {
    opacity: 1;
  }

  .grid-figure :global(line) {
    display: none;
  }

  .operator {
    padding-top: 1.6rem;
    font-size: clamp(1.2rem, 5vw, 2rem);
    font-weight: 700;
  }

  .closing {
    margin: 1rem auto 0;
    padding-top: 0.85rem;
    border-top: 1px solid #d7d4cd;
    text-align: center;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @container (min-width: 48rem) {
    .compact-page {
      display: grid;
      grid-template-columns: minmax(17rem, 0.9fr) minmax(22rem, 1.1fr);
      column-gap: 1.5rem;
      align-items: center;
    }

    .compact-intro {
      align-self: start;
    }

    .point-system {
      margin: 0;
    }

    .point-copy {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .point-copy p {
      font-size: var(--font-size-min, 0.875rem);
    }

    .grid-combination,
    .closing {
      grid-column: 1 / -1;
    }

    .grid-combination {
      margin-top: 0;
    }
  }
</style>

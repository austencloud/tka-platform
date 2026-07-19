<script lang="ts">
  import { onMount } from "svelte";
  import Seo from "$lib/shared/components/Seo.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import ShapeMatrixGrid from "$lib/shared/shape-matrix/components/ShapeMatrixGrid.svelte";
  import ShapeMatrixDrill from "$lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte";
  import {
    loadShapeMatrix,
    type ShapeMatrixData,
  } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
  import { applyFilter } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
  import {
    matrixFiltersForSize,
    type MatrixSize,
  } from "$lib/shared/shape-matrix/domain/matrix-size-preset";
  import type { Flower } from "$lib/shared/shape-matrix/domain/flower-signature";
  import { BREAKPOINTS } from "$lib/shared/device/domain/constants/device-constants";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Interactive Shape Matrix | The Kinetic Alphabet";
  const DESCRIPTION =
    "Click any cell of the 144 shape matrix to open the six timing-and-direction realizations that draw that mandala, then watch the prop draw it live.";
  const URL = "https://tkaflowarts.com/notation/shape-matrix";

  // Cumulative ratio-band sizes: Small = 1:1 (16 tiles), Medium = 1:1 + 1:3
  // (64 tiles), Large = 1:1 + 1:3 + 1:5 (144 tiles). Matches the domain ratio
  // labels — never described as "half turns" / "quarter turns".
  const SIZE_OPTIONS: { value: MatrixSize; label: string }[] = [
    { value: "small", label: "Small · 16" },
    { value: "medium", label: "Medium · 64" },
    { value: "large", label: "Large · 144" },
  ];

  // Read once at init (client render, real `window`) so the mobile default
  // wins on first paint; an INITIAL value only, never fought after the visitor
  // picks a size themselves (spec: Phase 3 size-default requirement).
  const initialMobile =
    typeof window !== "undefined" && window.innerWidth < BREAKPOINTS.MOBILE;
  let size = $state<MatrixSize>(initialMobile ? "medium" : "large");
  let data = $state<ShapeMatrixData | null>(null);
  let err = $state("");

  // The realization panel is a permanent fixture of the instrument band
  // (bespoke two-pane layout, Austen's direction 2026-07-19): on wide screens
  // matrix and realizations sit side by side, top- and bottom-aligned; on
  // narrow screens the panel stacks below and scrolls into view on select.
  let selectedPair = $state<{ blue: Flower; red: Flower } | null>(null);
  let drillPane = $state<HTMLElement | null>(null);

  const rowAxis = $derived(
    data ? applyFilter(data.axis, matrixFiltersForSize(size).blue, false) : [],
  );
  const colAxis = $derived(
    data ? applyFilter(data.axis, matrixFiltersForSize(size).red, false) : [],
  );

  function selectPair(pair: { blue: Flower; red: Flower }) {
    selectedPair = pair;
    // Stacked layout (the panes wrap): bring the realizations on screen.
    if (drillPane && window.innerWidth < 1360) {
      drillPane.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  onMount(async () => {
    try {
      data = await loadShapeMatrix();
    } catch (e) {
      err = String(e);
    }
  });
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Interactive Shape Matrix",
    "url": "${URL}",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": { "@type": "Organization", "name": "The Kinetic Alphabet", "url": "https://tkaflowarts.com/" }
  }
  </script>`}
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" },
      { "@type": "ListItem", "position": 3, "name": "Shape Matrix", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Interactive Shape Matrix</h1>
    <p class="page-subtitle">Every cell is live. Click one to open its realizations.</p>
  </header>

  <section class="editorial-section shape-matrix-section" style="--accent: #f59e0b">
    <!-- Lineage band: the story and the original chart side by side, sharing
         the same rail as the instrument band below. -->
    <div class="lineage-band">
      <div class="lineage-copy">
        <span class="section-kicker">The lineage</span>
        <div class="prose lineage-prose">
          <p>
            Lorq Nichols charted the 144 Shape Matrix in 2012: twelve left-hand driving
            styles against twelve right-hand ones, the even-petaled prospin and antispin
            shapes across the 1:1, 1:3, and 1:5 ratios. It was a paper chart, doing what
            a simulator does today: lay the space out so you can find what you have not
            tried. This page draws the same table live from the alphabet, one shape per
            cell, and every cell is clickable.
          </p>
          <p>
            The rows are blue-hand flowers, the columns red-hand flowers. Matched styles
            on the diagonal are basic shapes; every other cell overlaps the two into a
            hybrid. Further reading: Ben Drexler's VTG glossary entry
            <a
              href="https://drexfactor.com/weirdscience/2015/11/25/vulcan_tech_gospel_vtg_explained"
              target="_blank"
              rel="noopener noreferrer">VTG:153</a
            >
            gives the timing-and-direction vocabulary each cell's six realizations draw from.
          </p>
        </div>
      </div>

      <figure class="matrix-figure">
        <img
          class="matrix-img"
          src="/notation/lorq-144-shape-matrix.webp"
          width="1400"
          height="1812"
          alt="Lorq Nichols' 144 Shape Matrix: a twelve by twelve grid of even-petaled flower shapes. Columns are twelve right-hand driving styles, rows are twelve left-hand styles, grouped by 1:1, 1:3, and 1:5 hand-to-prop ratios."
          loading="lazy"
        />
        <figcaption>
          The original: Lorq Nichols' 144 Shape Matrix, 2012. Diagram by
          <a href="https://sirlorq.com" target="_blank" rel="noopener noreferrer">Lorq Nichols</a>.
          The live table below is TKA's rendering of the same space.
        </figcaption>
      </figure>
    </div>

    <!-- The instrument: live matrix and the realization panel as one aligned
         two-pane band. Header row carries the kickers and the size control;
         the two panels share top and bottom edges and one surface treatment.
         Accent stays in the kicker text only, per the editorial system. -->
    <div class="instrument">
      <div class="pane-head matrix-head">
        <span class="section-kicker">The live table</span>
        <div class="size-control" role="group" aria-label="Matrix size">
          <SegmentedControl
            options={SIZE_OPTIONS}
            value={size}
            onchange={(v) => (size = v)}
            color="accent"
          />
        </div>
      </div>

      <div class="pane-head drill-head">
        <span class="section-kicker">Realizations</span>
        <span class="head-hint">six per cell</span>
      </div>

      <div class="matrix-stage">
        {#if err}
          <p class="matrix-status err">{err}</p>
        {:else if !data}
          <p class="matrix-status">Building flowers…</p>
        {:else}
          <ShapeMatrixGrid {data} {rowAxis} {colAxis} onselect={selectPair} />
        {/if}
      </div>

      <aside class="drill-pane" bind:this={drillPane} aria-label="Cell realizations">
        {#if data}
          <ShapeMatrixDrill pair={selectedPair} {data} />
        {:else}
          <div class="drill-loading">Building flowers…</div>
        {/if}
      </aside>

      <p class="stage-caption">
        Rows are <span class="cap-blue">blue-hand</span> flowers · columns are
        <span class="cap-red">red-hand</span> flowers
      </p>
    </div>
  </section>
</div>

<style>
  /* ── Shared rail ──
     Both bands compute the same width from the instrument's parts (stage +
     gap + panel), so their left and right edges align at every viewport. The
     100vw term is capped generously below the visible width so the breakout
     never spawns a horizontal scrollbar. */
  .shape-matrix-section {
    --stage-cap: min(78vh, 66rem);
    --drill-w: clamp(30rem, 30vw, 44rem);
    --pane-gap: 2rem;
    --band-width: min(
      calc(var(--stage-cap) + var(--pane-gap) + var(--drill-w)),
      calc(100vw - 5rem)
    );
  }

  .lineage-band,
  .instrument {
    width: var(--band-width);
    margin-inline: calc((100% - var(--band-width)) / 2);
  }

  /* ── Lineage band ── */
  .lineage-band {
    display: grid;
    gap: 2rem clamp(3rem, 6vw, 7rem);
    align-items: center;
    margin-block: 0.4rem 4.5rem;
  }
  @media (min-width: 1100px) {
    .lineage-band {
      grid-template-columns: minmax(0, 1fr) minmax(0, clamp(28rem, 26vw, 40rem));
    }
  }

  /* Larger reading type than the base 46rem-column prose: this text sits in a
     wide band and carries the whole story, so it earns the lede-adjacent size. */
  .lineage-prose p {
    max-width: 58ch;
    font-size: clamp(1.02rem, 0.96rem + 0.22vw, 1.24rem);
    line-height: 1.7;
  }

  .matrix-figure {
    margin: 0;
    justify-self: center;
    max-width: min(40rem, 100%);
  }
  .matrix-img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 14px;
    border: 1px solid oklch(1 0 0 / 0.08);
    box-shadow: 0 10px 34px oklch(0.05 0.02 270 / 0.4);
  }
  .matrix-figure figcaption {
    margin-top: 0.7rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: oklch(0.6 0.02 270);
    text-align: center;
  }
  .matrix-figure figcaption a {
    color: oklch(0.8 0.12 275);
    text-decoration: none;
    border-bottom: 1px solid oklch(0.8 0.12 275 / 0.4);
  }
  .matrix-figure figcaption a:hover {
    border-bottom-color: oklch(0.8 0.12 275 / 0.9);
  }

  /* ── The instrument ──
     2×2 grid: header row (kickers + size control), then the two panels
     sharing top and bottom edges. The stage caption hangs below the stage
     like a figure caption. */
  .instrument {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--drill-w);
    grid-template-areas:
      "mhead dhead"
      "stage drill"
      "mcap  .";
    column-gap: var(--pane-gap);
    align-items: stretch;
  }

  .pane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 44px;
    margin-bottom: 0.9rem;
  }
  .pane-head .section-kicker {
    margin: 0;
  }
  .matrix-head {
    grid-area: mhead;
    /* Kicker + size control read as one left-aligned cluster that clearly
       belongs to the table — not pushed against the realization panel. */
    justify-content: flex-start;
    gap: 2rem;
  }
  .drill-head {
    grid-area: dhead;
  }
  .head-hint {
    font-size: clamp(0.75rem, 0.7rem + 0.12vw, 0.85rem);
    color: oklch(0.58 0.015 270);
    letter-spacing: 0.03em;
  }

  .size-control {
    min-height: 44px;
    display: flex;
    align-items: center;
    /* Room for the three labels on one line each — the shared control wraps
       labels when squeezed, which reads broken here. */
    flex: 0 0 auto;
    min-width: min(23rem, 100%);
  }

  /* The grid is ~square (12 flowers + header per side), so the stage is a
     square. Reserved up front at its final size, so neither the size preset
     nor load state ever moves the panels (no-layout-shift.md). */
  .matrix-stage {
    grid-area: stage;
    width: min(var(--stage-cap), 100%);
    aspect-ratio: 1 / 1;
    justify-self: center;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    background: #0a0f14;
  }
  .matrix-status {
    display: grid;
    place-items: center;
    height: 100%;
    color: oklch(0.72 0.012 270);
    margin: 0;
  }
  .matrix-status.err {
    color: #fb8a8a;
  }

  .stage-caption {
    grid-area: mcap;
    justify-self: center;
    margin: 0.7rem 0 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: oklch(0.6 0.02 270);
    text-align: center;
  }
  .cap-blue {
    color: var(--prop-blue, oklch(0.68 0.14 255));
  }
  .cap-red {
    color: var(--prop-red, oklch(0.68 0.16 25));
  }

  /* ── Realization panel: same surface as the stage, a true sibling ── */
  .drill-pane {
    grid-area: drill;
    border-radius: 16px;
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    background: #0a0f14;
    padding: 1.1rem 1.2rem 1.2rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    scroll-margin-top: 90px;
  }

  /* Pre-data loading hint: the drill itself owns the "Pick a cell" empty
     state once the flower data lands (ShapeMatrixDrill takes pair = null). */
  .drill-loading {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    font-size: clamp(0.85rem, 0.8rem + 0.12vw, 0.95rem);
    color: oklch(0.68 0.02 270);
  }

  /* ── Stacked layout: the panel follows the stage, full width ── */
  @media (max-width: 1359.98px) {
    .instrument {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "mhead"
        "stage"
        "mcap"
        "dhead"
        "drill";
    }
    .drill-head {
      margin-top: 2.2rem;
    }
    .drill-pane {
      min-height: 34rem;
    }
  }
</style>

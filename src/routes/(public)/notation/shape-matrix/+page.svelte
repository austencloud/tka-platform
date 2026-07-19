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

  // The drill pane is a permanent fixture of the instrument band (bespoke
  // two-pane layout — replaced the Drawer host on Austen's direction,
  // 2026-07-19): on wide screens matrix and realizations sit side by side; on
  // narrow screens the pane stacks below and we scroll it into view on select.
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

  <section class="editorial-section" style="--accent: #f59e0b">
    <!-- Lineage band: the story and the original chart side by side on wide
         screens, stacked on narrow ones. -->
    <div class="lineage-band">
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

    <!-- The instrument: live matrix and the realization pane as one two-pane
         band, both always present. Bespoke to this page — no drawer, no
         overlay, no reflow when a cell is picked. -->
    <div class="instrument">
      <div class="matrix-pane">
        <div class="matrix-toolbar">
          <div class="size-control">
            <span id="matrix-size-label" class="size-control-label">Matrix size</span>
            <div class="size-control-body">
              <SegmentedControl
                options={SIZE_OPTIONS}
                value={size}
                onchange={(v) => (size = v)}
                color="accent"
              />
            </div>
          </div>
          <div class="matrix-axis-labels" aria-hidden="true">
            <span class="axis-label axis-label-blue">↓ Blue flower</span>
            <span class="axis-label axis-label-red">Red flower →</span>
          </div>
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
      </div>

      <aside class="drill-pane" bind:this={drillPane} aria-label="Cell realizations">
        {#if selectedPair && data}
          <ShapeMatrixDrill pair={selectedPair} {data} />
        {:else}
          <div class="drill-empty">
            <span class="drill-empty-mark" aria-hidden="true">✳</span>
            <p class="drill-empty-title">Pick a cell</p>
            <p class="drill-empty-sub">
              Its six timing-and-direction realizations open here, and each one plays
              the props drawing that shape.
            </p>
          </div>
        {/if}
      </aside>
    </div>
  </section>
</div>

<style>
  /* ── Lineage band: side-by-side story + original chart on wide screens ── */
  .lineage-band {
    --band-width: min(88rem, calc(100vw - 3rem));
    width: var(--band-width);
    margin-inline: calc((100% - var(--band-width)) / 2);
    display: grid;
    gap: 2rem 4rem;
    align-items: center;
    margin-block: 0.4rem 1.6rem;
  }
  @media (min-width: 1100px) {
    .lineage-band {
      grid-template-columns: minmax(0, 1fr) minmax(0, 30rem);
    }
  }

  /* ── The instrument: matrix + realization pane, one wide band ── */
  .instrument {
    --band-width: min(160rem, calc(100vw - 3rem));
    width: var(--band-width);
    margin-inline: calc((100% - var(--band-width)) / 2);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.4rem;
    margin-block: 1.2rem 0;
  }
  @media (min-width: 1360px) {
    .instrument {
      grid-template-columns: minmax(0, 1fr) minmax(30rem, 44rem);
      align-items: stretch;
    }
  }

  .matrix-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
    /* The grid is ~square (12 flowers + header per side), so size the stage as
       a centered square instead of letting it stretch into a wide rectangle
       with dead space beside the grid. */
    --stage-size: min(82vh, 66rem, 100%);
  }

  .matrix-toolbar {
    width: var(--stage-size);
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 0.8rem 1.6rem;
    margin-bottom: 0.8rem;
  }

  .size-control {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: min(24rem, 100%);
  }
  .size-control-label {
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.85rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: oklch(0.68 0.02 270);
    text-transform: uppercase;
  }
  .size-control-body {
    min-height: 44px;
  }

  .matrix-axis-labels {
    display: flex;
    gap: 1.6rem;
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.85rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: oklch(0.68 0.02 270);
    padding-bottom: 0.4rem;
  }
  .axis-label-blue {
    color: var(--prop-blue, oklch(0.68 0.14 255));
  }
  .axis-label-red {
    color: var(--prop-red, oklch(0.68 0.16 25));
  }

  /* Fixed-height stage so the matrix box never resizes as the size preset or
     load state changes — reserves the worst case (Large) up front
     (no-layout-shift.md). The drill pane stretches to the same height, so the
     two panes read as one instrument. */
  .matrix-stage {
    width: var(--stage-size);
    aspect-ratio: 1 / 1;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
  }
  .matrix-status {
    display: grid;
    place-items: center;
    height: 100%;
    color: oklch(0.72 0.012 270);
    background: #0a0f14;
    margin: 0;
  }
  .matrix-status.err {
    color: #fb8a8a;
  }

  /* ── Realization pane: bespoke sibling panel, always present ── */
  .drill-pane {
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--accent, #f59e0b) 24%, transparent);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--accent, #f59e0b) 5%, transparent), transparent 34%),
      #0a0f14;
    padding: 1.1rem 1.2rem 1.2rem;
    display: flex;
    flex-direction: column;
    min-height: 34rem;
  }
  @media (min-width: 1360px) {
    .drill-pane {
      /* Match the matrix stage's box (toolbar height accounted by stretch). */
      min-height: 0;
      height: auto;
    }
  }

  .drill-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.5rem;
    padding: 2rem 1.4rem;
  }
  .drill-empty-mark {
    font-size: 2.2rem;
    color: color-mix(in srgb, var(--accent, #f59e0b) 65%, white);
    opacity: 0.85;
    margin-bottom: 0.4rem;
  }
  .drill-empty-title {
    margin: 0;
    font-size: clamp(1.05rem, 1rem + 0.2vw, 1.3rem);
    font-weight: 700;
    color: oklch(0.92 0.02 270);
  }
  .drill-empty-sub {
    margin: 0;
    max-width: 26rem;
    font-size: clamp(0.85rem, 0.8rem + 0.12vw, 0.95rem);
    line-height: 1.55;
    color: oklch(0.68 0.02 270);
  }

  /* ── Lineage figure ── */
  .matrix-figure {
    margin: 0 auto;
    max-width: min(30rem, 92%);
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
</style>

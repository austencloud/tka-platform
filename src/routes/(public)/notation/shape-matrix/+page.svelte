<script lang="ts">
  import { onMount } from "svelte";
  import Seo from "$lib/shared/components/Seo.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
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
  // wins on first paint without an SSR/hydration mismatch; the resize effect
  // below only updates `isMobile` afterward, never re-touches `size` — the
  // Medium/Large default is an INITIAL value only, never fought once the
  // visitor picks a size themselves (spec: Phase 3 size-default requirement).
  let isMobile = $state(
    typeof window !== "undefined" && window.innerWidth < BREAKPOINTS.MOBILE,
  );
  let size = $state<MatrixSize>(isMobile ? "medium" : "large");
  let data = $state<ShapeMatrixData | null>(null);
  let err = $state("");

  // Phase 1 wired the tile-click (onselect → route state); Phase 2 renders
  // the payoff via ShapeMatrixDrill; Phase 3 hosts it in a Drawer (bottom
  // sheet on mobile, right panel on desktop) instead of rendering inline.
  let selectedPair = $state<{ blue: Flower; red: Flower } | null>(null);
  let drillOpen = $state(false);

  $effect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      isMobile = window.innerWidth < BREAKPOINTS.MOBILE;
    };
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  });

  const rowAxis = $derived(
    data ? applyFilter(data.axis, matrixFiltersForSize(size).blue, false) : [],
  );
  const colAxis = $derived(
    data ? applyFilter(data.axis, matrixFiltersForSize(size).red, false) : [],
  );

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
    <div class="prose">
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

    <div class="matrix-stage">
      {#if err}
        <p class="matrix-status err">{err}</p>
      {:else if !data}
        <p class="matrix-status">Building flowers…</p>
      {:else}
        <ShapeMatrixGrid
          {data}
          {rowAxis}
          {colAxis}
          onselect={(pair) => {
            selectedPair = pair;
            drillOpen = true;
          }}
        />
      {/if}
    </div>
  </section>
</div>

<div style:--drawer-width={isMobile ? "100vw" : "min(640px, 48vw)"}>
  <Drawer
    isOpen={drillOpen}
    placement={isMobile ? "bottom" : "right"}
    class="shape-matrix-drill-drawer"
    onOpenChange={(open) => {
      if (!open) drillOpen = false;
    }}
  >
    <DrawerHeader title="Shape matrix realizations" onClose={() => (drillOpen = false)} />
    <div class="drill-sheet-content">
      {#if selectedPair && data}
        <ShapeMatrixDrill pair={selectedPair} {data} />
      {/if}
    </div>
  </Drawer>
</div>

<style>
  /* Size control: fixed label + full-width segmented control. The label text
     never changes, so no ghost-sizer is needed here (no-layout-shift.md only
     applies to CONTENT that changes at runtime — this element's content is
     static; only `size` changes, and SegmentedControl's equal-width segments
     already keep the sliding indicator from shifting anything). */
  .size-control {
    margin: 1.6rem 0 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 26rem;
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
    justify-content: space-between;
    max-width: 60rem;
    margin: 0 auto 0.6rem;
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.85rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: oklch(0.68 0.02 270);
  }
  .axis-label-blue {
    color: var(--prop-blue, oklch(0.68 0.14 255));
  }
  .axis-label-red {
    color: var(--prop-red, oklch(0.68 0.16 25));
  }

  /* Fixed-height stage so the matrix box never resizes as the size preset or
     load state changes — reserves the worst case (Large, the tallest grid)
     up front (no-layout-shift.md). */
  .matrix-stage {
    height: min(78vh, 60rem);
    max-width: 100%;
    margin: 0 auto;
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
  }
  .matrix-status.err {
    color: #fb8a8a;
  }

  /* Drill sheet: fixed height (not max-height), same reasoning as
     GalleryFilterSheet.svelte — the drill's grid-of-six and hero-player
     screens differ in intrinsic height, and a content-sized sheet would
     resize on every crossfade. ShapeMatrixDrill fills this box. */
  .drill-sheet-content {
    background: var(--theme-panel-bg);
    overflow: hidden;
    height: calc(85dvh - 60px);
    padding: 0 1rem 1rem;
  }

  /* Right-placement drawer (desktop) is a full-height 100dvh panel — fill the
     space under the header instead of the bottom-sheet's 85dvh figure. */
  :global(.drawer-content[data-placement="right"]) .drill-sheet-content {
    height: auto;
    flex: 1;
    min-height: 0;
  }

  :global(.shape-matrix-drill-drawer.drawer-content) {
    --sheet-bg: var(--theme-panel-bg);
    --sheet-width: var(--drawer-width, min(640px, 48vw));
    --sheet-max-height: 85dvh;
    --sheet-border-radius-top-left: 16px;
    --sheet-border-radius-top-right: 16px;
  }
</style>

<script lang="ts">
  /**
   * One real Letter-sized page. The unit of the printable guide.
   *
   * On screen: a paper-like sheet (8.5×11in) with a drop shadow, so the print
   * route is a true WYSIWYG page-by-page preview. In print: the sheet stays
   * fixed 8.5×11 (the @page is margin:0 in guide-print.css), so what you see is
   * exactly what prints — including the page-number footer, which is absolutely
   * positioned and would otherwise drift if the sheet collapsed.
   *
   * Content is authored to FIT one page — this is the seam that replaced the old
   * continuous-scroll-sliced-by-@page chaos. Each page is rebuilt one at a time
   * (see docs/.../guide-rebuild-tracker.md).
   */
  import type { Snippet } from "svelte";
  import { pageNumberPrefs } from "../_data/page-number-prefs.svelte";

  let {
    children,
    fullBleed = false,
    label,
    pageNumber,
    title,
  }: {
    children: Snippet;
    /** Edge-to-edge content (cover art etc.) — drops the inner page margin. */
    fullBleed?: boolean;
    /** Dev-only page tag shown on screen (e.g. "p1 — Cover"); hidden in print. */
    label?: string;
    /** Body page number. Omitted for front matter (prints unnumbered). */
    pageNumber?: number;
    /** Page header title, rendered in the dedicated header region at the top. */
    title?: string;
  } = $props();

  // Recto/verso: page 1 = recto (right); odd → right, even → left outer corner.
  const recto = $derived(pageNumber !== undefined && pageNumber % 2 === 1);
  const showNumber = $derived(pageNumber !== undefined && pageNumberPrefs.show);
</script>

<section class="guide-page" class:full-bleed={fullBleed}>
  {#if label}<span class="page-tag" aria-hidden="true">{label}</span>{/if}
  <div class="page-body">
    {#if title}
      <header class="page-header">
        <h1 class="page-header-title">{title}</h1>
        <span class="page-header-flourish" aria-hidden="true"></span>
      </header>
    {/if}
    <div class="page-content">
      {@render children()}
    </div>
  </div>
  {#if showNumber}
    <span class="page-number" class:recto class:verso={!recto}>{pageNumber}</span>
  {/if}
</section>

<style>
  .guide-page {
    position: relative;
    width: 8.5in;
    min-height: 11in;
    margin: 0 auto;
    background: #fff;
    color: #1a1a1a;
    box-sizing: border-box;
    overflow: hidden;
  }
  .page-body {
    padding: 0.6in;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .full-bleed .page-body {
    padding: 0;
  }

  /* Dedicated header BAND pinned to the top of every page — large centred
     script title + gold flourish, consistent across the book (matches the
     original, where the page title sits high near the top edge). The band hugs
     the top of the page body (0.6in page margin), it does not float mid-page. */
  .page-header {
    flex: 0 0 auto;
    text-align: center;
    margin: 0 0 0.4in;
  }
  .page-header-title {
    /* --guide-header-font lets the whole book's page-header typeface be swapped
       in one place. Default = Cormorant Garamond italic (chosen for readability
       over a fancy script; the original's Monotype Corsiva isn't web-licensable
       and its closest free clone, TeX Gyre Chorus, read too ornate here). */
    font-family: var(--guide-header-font, "Cormorant Garamond", Georgia, serif);
    font-style: italic;
    font-weight: 600;
    font-size: 3.2rem;
    line-height: 1.0;
    color: #14142b;
    margin: 0;
  }
  .page-header-flourish {
    display: block;
    width: 2.1in;
    height: 9px;
    margin: 0.18in auto 0;
    background: linear-gradient(#c9a227, #c9a227) center / 100% 1px no-repeat;
    position: relative;
  }
  .page-header-flourish::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    transform: translate(-50%, -50%) rotate(45deg);
    background: #14142b;
  }
  /* Content fills the page below the header. */
  .page-content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .page-tag {
    position: absolute;
    top: 6px;
    right: 8px;
    z-index: 2;
    font: 600 10px/1 system-ui, sans-serif;
    letter-spacing: 0.04em;
    color: #b9b9c6;
    background: rgba(255, 255, 255, 0.85);
    padding: 2px 5px;
    border-radius: 4px;
    pointer-events: none;
  }

  /* Recto/verso page number at the bottom outer corner (within the page margin). */
  .page-number {
    position: absolute;
    bottom: 0.42in;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.05rem;
    color: #4a4658;
    font-variant-numeric: tabular-nums;
    z-index: 2;
    pointer-events: none;
  }
  .page-number.recto {
    right: 0.6in;
  }
  .page-number.verso {
    left: 0.6in;
  }

  @media screen {
    .guide-page {
      box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45);
      border-radius: 2px;
      margin-bottom: 28px;
    }
  }

  @media print {
    /* Keep the sheet a true 8.5×11 so the absolutely-positioned footer lands in
       the same spot on paper as on screen. @page margin:0 (guide-print.css)
       means the sheet's own 0.6in padding supplies the printed margin. */
    .guide-page {
      box-shadow: none;
      border-radius: 0;
      break-after: page;
    }
    .page-tag {
      display: none;
    }
  }
</style>

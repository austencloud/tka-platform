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
  // Body pages carry a page number; front matter (cover/toc/read-me) does not.
  // EVERY body page — built or placeholder — gets the calligraphic .guide-title;
  // only front matter keeps the serif header band + flourish.
  const isBody = $derived(pageNumber !== undefined);
</script>

<section class="guide-page" class:full-bleed={fullBleed}>
  {#if label && !fullBleed}<span class="page-tag" aria-hidden="true">{label}</span>{/if}
  <div class="page-body">
    {#if title && !isBody}
      <!-- Front matter (TOC, Read Me…): the SAME calligraphic title as body pages,
           rendered in flow so the page content sits below it. A <div> (not <h1>)
           on purpose — /print wraps the doc in .guide-content, whose `.guide-content
           h1` rule (Inter 750, for the scroll layout) would otherwise outweigh
           .guide-title and force the title to bold sans-serif. Body titles are
           already divs and render Tangerine correctly inside that same wrapper. -->
      <div class="guide-title flow">{title}</div>
    {/if}
    <div class="page-content">
      {@render children()}
    </div>
  </div>
  {#if title && isBody}
    <!-- Every body page (built or placeholder): the manifest title in the shared
         calligraphic .guide-title, positioned high on the sheet. Rendered HERE
         (from the manifest) so the heading and the TOC row can't drift. -->
    <div class="guide-title">{title}</div>
  {/if}
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
    /* Flex column so page-body fills the full 11in sheet even when content is
       short — a percentage height would collapse against min-height. This is
       what lets front-matter content centre in the true page, not float high. */
    display: flex;
    flex-direction: column;
  }
  .page-body {
    padding: 0.6in;
    flex: 1 1 auto;
    min-height: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
  }
  .full-bleed .page-body {
    padding: 0;
  }

  /* Page titles (body + front matter) are the shared .guide-title (guide.css);
     no per-page header band here anymore. */
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

  /* Recto/verso page number at the TOP outer corner, book-style: a page on the
     right of the open book (recto, odd) numbers top-right; a page on the left
     (verso, even) numbers top-left. Sized to read, spaced off both edges. */
  .page-number {
    position: absolute;
    top: 0.42in;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: #3a3648;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    z-index: 2;
    pointer-events: none;
  }
  .page-number.recto {
    right: 0.55in;
  }
  .page-number.verso {
    left: 0.55in;
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

<script lang="ts">
  /**
   * One real Letter-sized page. The unit of the printable guide.
   *
   * On screen: a paper-like sheet (8.5×11in) with a drop shadow, so the print
   * route is a true WYSIWYG page-by-page preview. In print: collapses to exactly
   * one physical page with a hard break after it (the @page margin in
   * guide-print.css supplies the printed margins, so the sheet's own padding is
   * dropped to avoid doubling).
   *
   * Content is authored to FIT one page — this is the seam that replaced the old
   * continuous-scroll-sliced-by-@page chaos. Each page is rebuilt one at a time
   * (see docs/.../guide-rebuild-tracker.md).
   */
  import type { Snippet } from "svelte";

  let {
    children,
    fullBleed = false,
    label,
  }: {
    children: Snippet;
    /** Edge-to-edge content (cover art etc.) — drops the inner page margin. */
    fullBleed?: boolean;
    /** Dev-only page tag shown on screen (e.g. "p1 — Cover"); hidden in print. */
    label?: string;
  } = $props();
</script>

<section class="guide-page" class:full-bleed={fullBleed}>
  {#if label}<span class="page-tag" aria-hidden="true">{label}</span>{/if}
  <div class="page-body">
    {@render children()}
  </div>
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

  @media screen {
    .guide-page {
      box-shadow: 0 6px 28px rgba(0, 0, 0, 0.45);
      border-radius: 2px;
      margin-bottom: 28px;
    }
  }

  @media print {
    .guide-page {
      width: auto;
      min-height: 0;
      margin: 0;
      box-shadow: none;
      border-radius: 0;
      break-after: page;
      overflow: visible;
    }
    /* @page in guide-print.css supplies the printed margin — drop the sheet's. */
    .page-body {
      padding: 0;
      height: auto;
    }
    .page-tag {
      display: none;
    }
  }
</style>

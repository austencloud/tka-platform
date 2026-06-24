<!--
  GuideComingSoon — the inline guide section revealed when the landing top-bar
  "Guide" link is clicked. It lives on the landing page (between the other
  sections and the footer) so the header + footer stay in place; the Guide nav
  item is an in-page anchor (/#guide) rather than a route to the separate
  /guide/level-1 pages, which are still being rebuilt.

  Structured so the real guide drops in later with one change: flip `guideReady`
  to true (or pass it in) and render the real content in the {:else} branch /
  the `content` snippet slot. Until then it shows a polished Coming Soon screen
  modeled on ShopComingSoon's pattern and the landing visual language.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  // When the real Level 1 guide is ready, set guideReady = true (or pass it in)
  // and provide the `content` snippet. The Coming Soon screen swaps out, nothing
  // else on the landing page changes.
  let {
    guideReady = false,
    content,
  }: {
    guideReady?: boolean;
    content?: Snippet;
  } = $props();
</script>

<section class="guide-section" id="guide" aria-label="Level 1 notation guide">
  {#if guideReady && content}
    {@render content()}
  {:else}
    <div class="inner">
      <span class="eyebrow">
        <i class="fas fa-book-open" aria-hidden="true"></i> Level 1 Guide
      </span>
      <h2>The Level 1 guide is in the works</h2>
      <p class="lede">
        A walkthrough of the notation from the ground up: the grid, all six
        letter types, and your first words. No turns yet, just the base motions.
        Grab a pair of staves and follow along.
      </p>

      <ul class="whats-coming" aria-label="What the guide covers">
        <li><i class="fas fa-table-cells" aria-hidden="true"></i> The grid</li>
        <li><i class="fas fa-shapes" aria-hidden="true"></i> All 6 letter types</li>
        <li><i class="fas fa-font" aria-hidden="true"></i> Reading and writing words</li>
      </ul>

      <p class="aside">
        The notation stays free to learn and print. This page will hold the full
        interactive guide once it lands.
      </p>
    </div>
  {/if}
</section>

<style>
  .guide-section {
    padding: 120px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Reserve a comfortable minimum so the reveal never collapses to a thin
       sliver and shoves the footer up. */
    min-height: 60vh;
    /* Offset for the fixed 64px header when the anchor is scrolled into view. */
    scroll-margin-top: 80px;
  }

  .inner {
    width: 100%;
    max-width: 560px;
    text-align: center;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #b8a6ff;
    margin-bottom: 18px;
  }

  h2 {
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: clamp(1.8rem, 5vw, 2.6rem);
    font-weight: 400;
    line-height: 1.2;
    margin: 0 0 16px;
  }

  .lede {
    font-size: var(--font-size-lg, 1.125rem);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    margin: 0 auto 28px;
  }

  .whats-coming {
    list-style: none;
    margin: 0 0 32px;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
  .whats-coming li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
  }
  .whats-coming i {
    color: #8b6cff;
  }

  .aside {
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.7;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    margin: 0 auto;
    max-width: 460px;
  }
</style>

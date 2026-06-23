<!--
  Printable Level 1 guide — the single hand-out document.

  Resets out of the level-1 sidebar layout (`@(public)`) and stacks the cover
  plus all three chapter pages (each manages its own setGuideData context). The
  `guide-print-mode` class forces motion demos to render as static pictographs
  (arrow = direction, hand = end position) instead of video, matching the
  original printed guide. guide-print.css re-themes everything to ink-on-white.

  Print / Save-as-PDF from the browser produces the hand-out. This route is also
  the source for the regenerated static/guides/level-1.pdf.
-->
<script lang="ts">
  import "../_styles/guide.css";
  import "../_styles/guide-print.css";
  import { setGuidePrintMode } from "../_data/guide-data-context";
  import { page } from "$app/state";
  import type { Component } from "svelte";
  import GuidePage from "../_components/GuidePage.svelte";
  import GuideCover from "../_components/GuideCover.svelte";
  import GuideTOC from "../_components/GuideTOC.svelte";
  import PagePlaceholder from "../_components/PagePlaceholder.svelte";
  import PageNumberToggle from "../_components/PageNumberToggle.svelte";
  import { GUIDE_BODY_PAGES } from "../_data/guide-manifest";

  setGuidePrintMode();

  // Built per-page components, keyed by manifest id. Empty until chapters are
  // converted page-by-page (p6+); any id not registered renders a numbered
  // placeholder. As each body page is rebuilt, add e.g. { "the-grid": TheGridPage }.
  const BUILT: Record<string, Component> = {};

  // ?theme=home → ink-cheap light cover for home printers; default = navy (foil).
  const coverTheme = $derived(page.url.searchParams.get("theme") === "home" ? "light" : "navy");

  // ONE QR → tkaflowarts.com/support (the donation landing page). Keeping the
  // payment methods on a page Austen owns means handles can change, or methods
  // be added, without ever reprinting the book.
  const SUPPORT_QR = "/guide/level-1/images/_shared/qr-support.png";
  const SUPPORT_URL = "tkaflowarts.com/support";
</script>

<svelte:head>
  <title>The Kinetic Alphabet — Level 1 (Printable)</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="guide-content guide-print-mode print-doc">
  <!-- ── Page 1: Cover (real full page) ──────────────────────────────────
       Cover art bakes in the title + ring; the bottom strip (old "v 0.5"
       byline) is cropped so the version reads v1.0 from the live caption.
       TODO(rebuild): rebake the ring fresh from the current renderer. -->
  <GuidePage fullBleed label="p1 — Cover">
    <div class="cover-fill"><GuideCover theme={coverTheme} /></div>
  </GuidePage>

  <!-- ── Page 2: "drink water" (minimalist front-matter beat, faithful) ──── -->
  <GuidePage label="p2 — drink water">
    <div class="frontmatter">
      <div class="ripple" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="drink">drink water</p>
    </div>
  </GuidePage>

  <!-- ── Page 3: Support (soft, low-sales per brand educational tone) ─────── -->
  <GuidePage label="p3 — Support" title="Support the work">
    <div class="frontmatter support">
      <p>
        <span class="ln">If this guide helps you, you can support its development.</span>
        <span class="ln">Any amount is genuinely appreciated.</span>
      </p>
      <figure class="donate">
        <img class="support-qr" src={SUPPORT_QR} alt="Scan to support — {SUPPORT_URL}" />
        <figcaption class="support-url">{SUPPORT_URL}</figcaption>
      </figure>
    </div>
  </GuidePage>

  <!-- ── Page 4: Read Me First (its own page, matching the original) ─────── -->
  <GuidePage label="p4 — Read Me First" title="Read Me First">
    <div class="read-me">
      <p class="rm-greeting">Greetings, flow arts aficionado!</p>
      <p class="rm-lead">
        You've come across The Kinetic Alphabet, a notation system designed to
        help you craft and communicate your own unique choreography. This
        grid-based language is designed for music, using pictographs and letters
        that combine like puzzle pieces for each beat. This system has propelled
        my sequence creation to new heights, and I hope it will do the same for
        you!
      </p>
      <p>
        The Kinetic Alphabet is a fusion of elements from VTG (Vulcan Tech
        Gospel), siteswap (Juggling Notation), and musical notation. Although it
        can be introduced to beginners, it's designed for intermediate learners,
        bridging the gap between improvisation and choreography. Originally built
        for double staves, it can be applied to any dual wielded static prop like
        clubs, fans, triads, buugeng, and more.
      </p>
      <p>
        Pictographs form the core of The Kinetic Alphabet. The letters are a
        useful tool to categorize and communicate the pictographs, but they are
        secondary to the pictographs themselves. It's not necessary to memorize
        the letters immediately to benefit from this system.
      </p>
      <p>
        This is a work-in-progress and is continually growing. Whether you fully
        embrace this system, draw inspiration from certain parts, or follow a
        different path altogether, I hope the ideas presented here contribute to
        your creative growth.
      </p>
      <p>
        I can't wait to see the unique choreography you'll create!
      </p>
      <p class="sign-off">With love,<br /><span class="rm-sig">Austen Cloud</span></p>
    </div>
  </GuidePage>

  <!-- ── Page 5: Table of Contents (generated from the manifest) ─────────── -->
  <GuidePage label="p5 — Table of Contents" title="Table of Contents">
    <GuideTOC />
  </GuidePage>

  <!-- ── Body pages: generated from the manifest. Each entry is one numbered
       page; built pages render their component, the rest a numbered placeholder.
       Printed page number = manifest index + 1 (first body page = 1). -->
  {#each GUIDE_BODY_PAGES as entry, i}
    {@const Built = BUILT[entry.id]}
    <GuidePage label={`body p${i + 1} — ${entry.title}`} pageNumber={i + 1} title={entry.title}>
      {#if Built}
        <Built />
      {:else}
        <PagePlaceholder />
      {/if}
    </GuidePage>
  {/each}
</div>

<PageNumberToggle />

<style>
  /* Page 1 cover — full-bleed GuideCover. aspect-ratio gives the box a concrete
     height (width × 11/8.5) so the cover's height:100% layout fills the page. */
  .cover-fill {
    width: 100%;
    aspect-ratio: 8.5 / 11;
  }

  /* Front-matter pages (white interior, ink-cheap) */
  /* Fill the page so content centers vertically (GuidePage uses min-height, so
     height:100% collapses — use an explicit min-height inside the 11in page). */
  .frontmatter {
    min-height: 9.4in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 2.2rem;
  }
  .drink {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 600, "WONK" 1;
    font-size: 2.8rem;
    color: #1a1a1a;
    margin: 0;
  }
  .ripple {
    position: relative;
    width: 120px;
    height: 120px;
  }
  .ripple span {
    position: absolute;
    inset: 0;
    margin: auto;
    border: 1px solid #b9b3cf;
    border-radius: 50%;
  }
  .ripple span:nth-child(1) { width: 40px; height: 40px; }
  .ripple span:nth-child(2) { width: 80px; height: 80px; opacity: 0.6; }
  .ripple span:nth-child(3) { width: 120px; height: 120px; opacity: 0.35; }

  .support p {
    max-width: 5.2in;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.3rem;
    line-height: 1.6;
    color: #2a2a2a;
    margin: 0;
  }
  /* One QR → the support page Austen owns. No box, no per-method clutter. */
  .donate {
    margin: 1.1rem 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.7rem;
  }
  .support-qr {
    width: 1.9in;
    height: 1.9in;
  }
  .support-url {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.3rem;
    letter-spacing: 0.01em;
    color: #2a2a2a;
  }
  /* ── Read Me First (authored letter, not a textbook block) ─────────── */
  .read-me {
    max-width: 5.9in;
    margin: 0 auto;
  }
  .read-me p {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.32rem;
    line-height: 1.72;
    color: #20202a;
    margin: 0 0 1.05rem;
    text-align: justify;
    hyphens: auto;
  }
  /* Support page: centred sentence-per-line (each sentence its own line). */
  .support .ln {
    display: block;
  }
  /* Read Me salutation line. */
  .rm-greeting {
    text-align: left !important;
    font-style: italic;
    margin-bottom: 0.9rem !important;
  }
  /* Fraunces drop cap on the opening paragraph. */
  .rm-lead::first-letter {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 620, "WONK" 1;
    font-size: 3.6em;
    line-height: 0.74;
    float: left;
    margin: 0.04em 0.1em 0 0;
    color: #2342c9;
  }
  .sign-off {
    text-align: right;
    margin-top: 0.45in !important;
    line-height: 1.4;
  }
  .rm-sig {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 580, "WONK" 1;
    font-size: 1.7rem;
    color: #14142b;
  }
</style>

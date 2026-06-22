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
  import GuidePage from "../_components/GuidePage.svelte";
  import GuideCover from "../_components/GuideCover.svelte";

  import PositionsMotions from "../positions-motions/+page.svelte";
  import Letters from "../letters/+page.svelte";
  import Words from "../words/+page.svelte";

  setGuidePrintMode();

  // ?theme=home → ink-cheap light cover for home printers; default = navy (foil).
  const coverTheme = $derived(page.url.searchParams.get("theme") === "home" ? "light" : "navy");
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
  <GuidePage label="p3 — Support">
    <div class="frontmatter support">
      <h2 class="fm-h">Support the work</h2>
      <p>
        If this guide helps you, you can support its development. The Kinetic
        Alphabet grows through the people who use it — a contribution of any size
        is genuinely appreciated, and never required to keep creating.
      </p>
    </div>
  </GuidePage>

  <!-- ── Page 4: Read Me First (its own page, matching the original) ─────── -->
  <GuidePage label="p4 — Read Me First">
    <div class="read-me">
      <h2>Read Me First</h2>
      <p>
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
        In a pictograph, the arrow shows the direction of a hand's motion and the
        hand marker shows where that hand ends. Read each grid as a single beat.
      </p>
      <p class="sign-off">With love,<br />Austen Cloud</p>
    </div>
  </GuidePage>

  <!-- ── Pages 3+: chapters (NOT yet converted to GuidePage units) ─────── -->
  <PositionsMotions />
  <Letters />
  <Words />
</div>

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

  .support .fm-h {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 600, "WONK" 1;
    font-size: 1.9rem;
    color: #161616;
    margin: 0;
  }
  .support p {
    max-width: 5.2in;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.3rem;
    line-height: 1.6;
    color: #2a2a2a;
    margin: 0;
  }

  .read-me {
    max-width: 6.2in;
    margin: 0 auto;
  }
</style>

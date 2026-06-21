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

  import PositionsMotions from "../positions-motions/+page.svelte";
  import Letters from "../letters/+page.svelte";
  import Words from "../words/+page.svelte";

  setGuidePrintMode();
</script>

<svelte:head>
  <title>The Kinetic Alphabet — Level 1 (Printable)</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="guide-content guide-print-mode print-doc">
  <header class="print-cover">
    <!-- Cover art bakes in the title + ring; the bottom strip (old "v 0.5"
         byline) is cropped off so the version reads v1.0 from the text below. -->
    <div class="cover-art-wrap">
      <img
        src="/guide/level-1/images/_shared/level-1-front-cover.png"
        alt="The Kinetic Alphabet Level 1 cover"
      />
    </div>
    <p class="cover-sub">Level 1 — Positions, Motions, Letters &amp; Words</p>
    <p class="cover-byline">Created by Austen Cloud · v1.0</p>

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
  </header>

  <PositionsMotions />
  <Letters />
  <Words />
</div>

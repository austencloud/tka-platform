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

  // ONE QR → tkaflowarts.com/support (the donation landing page). Keeping the
  // payment methods on a page Austen owns means handles can change, or methods
  // be added, without ever reprinting the book.
  const SUPPORT_QR = "/guide/level-1/images/_shared/qr-support.png";
  const SUPPORT_URL = "tkaflowarts.com/support";

  // Table of Contents — Level 1 scope only (1.0–1.2). Entries + sub-entries
  // transcribed from the original artboard; γ (not Γ) per the facelift
  // convention. Page numbers intentionally omitted (added programmatically
  // once pagination is final). 1.3 Single-Turns / 1.4 Double-Turns are
  // later-level content, not part of this guide.
  type TocSection = { n: string; title: string; items: { t: string; subs?: string[] }[] };
  const TOC: TocSection[] = [
    {
      n: "1.0",
      title: "Positions / Motions",
      items: [
        { t: "The Grid" },
        { t: "Hand Positions" },
        { t: "Hand Motions", subs: ["Type 1 Dual-Shifts - Alpha, Beta", "Gamma / Type 2 Shifts", "Type 3/4 Cross-Shifts and Dashes", "Type 5/6 Dual-Dashes and Statics"] },
        { t: "Staff Positions" },
        { t: "Staff Motions" },
        { t: "Negative Space / Body Turns" },
      ],
    },
    {
      n: "1.1",
      title: "Letters",
      items: [
        { t: "Base Letters", subs: ["Double Staff", "Clubs", "Buugeng", "Triads", "Fans", "Mini Hoops"] },
        { t: "Type 1 - Dual-Shifts", subs: ["ABC, GHI", "DJ, EK, FL", "MP, NQ, OR, STUV"] },
        { t: "Type 2 - Shifts", subs: ["WXYZ, ΣΔθΩ"] },
        { t: "Type 3 - Cross-Shifts", subs: ["W- X- Y- Z-, Σ- Δ- θ- Ω-"] },
        { t: "Type 4, 5, 6", subs: ["Φ, Ψ, Λ", "Φ-, Ψ-, Λ-", "α, β, γ"] },
      ],
    },
    {
      n: "1.2",
      title: "Words",
      items: [
        { t: "Words" },
        { t: "Permutations" },
        { t: "Reversals" },
        { t: "Examples with A, B, C" },
        { t: "Misc. Permutation Examples" },
      ],
    },
  ];
  // Layout: 1.0 + 1.2 on the left, the longer 1.1 alone on the right.
  const TOC_LEFT: TocSection[] = [TOC[0]!, TOC[2]!];
  const TOC_RIGHT: TocSection[] = [TOC[1]!];
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
        If this guide helps you, you can support its development. Any amount is
        genuinely appreciated, and never required.
      </p>
      <figure class="donate">
        <img class="support-qr" src={SUPPORT_QR} alt="Scan to support — {SUPPORT_URL}" />
        <figcaption class="support-url">{SUPPORT_URL}</figcaption>
      </figure>
      <p class="suggest">Suggested $20–30 · any amount helps</p>
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

  <!-- ── Page 5: Table of Contents (Level 1 scope, 1.0–1.2) ─────────────── -->
  {#snippet tocSection(sec: TocSection)}
    <section class="toc-sec">
      <h3 class="toc-sec-h"><span class="toc-num">{sec.n}</span>{sec.title}</h3>
      <ul class="toc-list">
        {#each sec.items as it}
          <li class="toc-item">{it.t}</li>
          {#if it.subs}
            {#each it.subs as s}
              <li class="toc-sub">{s}</li>
            {/each}
          {/if}
        {/each}
      </ul>
    </section>
  {/snippet}
  <GuidePage label="p5 — Table of Contents">
    <div class="toc">
      <h2 class="toc-title">Table of Contents</h2>
      <div class="toc-cols">
        <div class="toc-col">
          {#each TOC_LEFT as sec}{@render tocSection(sec)}{/each}
        </div>
        <div class="toc-col">
          {#each TOC_RIGHT as sec}{@render tocSection(sec)}{/each}
        </div>
      </div>
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
  .suggest {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.1rem;
    color: #6a6a6a;
    margin: 0.4rem 0 0;
  }

  .read-me {
    max-width: 6.2in;
    margin: 0 auto;
  }

  /* ── Table of Contents ─────────────────────────────────────────────── */
  .toc {
    min-height: 9.4in;
    display: flex;
    flex-direction: column;
    padding-top: 0.3in;
  }
  .toc-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 560, "WONK" 1;
    font-size: 2.7rem;
    color: #14142b;
    text-align: center;
    margin: 0 0 0.55in;
  }
  .toc-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.7in;
    max-width: 6.6in;
    margin: 0 auto;
    width: 100%;
  }
  .toc-col {
    display: flex;
    flex-direction: column;
    gap: 0.42in;
  }
  .toc-sec {
    break-inside: avoid;
  }
  .toc-sec-h {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 600, "WONK" 1;
    font-size: 1.45rem;
    color: #161616;
    margin: 0 0 0.16in;
    padding-bottom: 0.07in;
    border-bottom: 1px solid #d8d4e4;
    display: flex;
    align-items: baseline;
    gap: 0.5em;
  }
  .toc-num {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: normal;
    font-weight: 600;
    font-size: 1.15rem;
    color: #2342c9;
  }
  .toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .toc-item {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.28rem;
    color: #1f1f1f;
    line-height: 1.55;
  }
  .toc-sub {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.08rem;
    color: #6a6478;
    line-height: 1.45;
    padding-left: 1.1em;
  }
</style>

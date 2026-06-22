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
  <GuidePage label="p4 — Read Me First">
    <div class="read-me">
      <header class="rm-head">
        <h2 class="rm-title">Read Me First</h2>
        <span class="rm-flourish" aria-hidden="true"></span>
      </header>
      <p class="rm-lead">
        You've come across The Kinetic Alphabet, a notation system designed to
        help you craft and communicate your own unique choreography. This
        grid-based language is designed for music, using pictographs and letters
        that combine like puzzle pieces for each beat. This system has propelled
        my sequence creation to new heights, and I hope it will do the same for
        you.
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
      <p class="sign-off">With love,<br /><span class="rm-sig">Austen Cloud</span></p>
    </div>
  </GuidePage>

  <!-- ── Page 5: Table of Contents (Level 1 scope, 1.0–1.2) ─────────────── -->
  {#snippet tocSection(sec: TocSection)}
    <section class="toc-sec">
      <h3 class="toc-sec-h">
        <span class="toc-num">{sec.n}</span>
        <span class="toc-sec-title">{sec.title}</span>
      </h3>
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
      <header class="toc-head">
        <h2 class="toc-title">Table of Contents</h2>
        <span class="toc-flourish" aria-hidden="true"></span>
      </header>
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
  /* ── Read Me First (authored letter, not a textbook block) ─────────── */
  .read-me {
    max-width: 5.9in;
    margin: 0 auto;
    padding-top: 0.45in;
  }
  .rm-head {
    text-align: center;
    margin: 0 0 0.5in;
  }
  .rm-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 560, "WONK" 1;
    font-size: 2.5rem;
    color: #14142b;
    margin: 0;
  }
  .rm-flourish {
    display: block;
    width: 2in;
    height: 9px;
    margin: 0.16in auto 0;
    background: linear-gradient(#c9a227, #c9a227) center / 100% 1px no-repeat;
    position: relative;
  }
  .rm-flourish::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    transform: translate(-50%, -50%) rotate(45deg);
    background: #14142b;
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

  /* ── Table of Contents ─────────────────────────────────────────────── */
  .toc {
    min-height: 9.4in;
    display: flex;
    flex-direction: column;
    padding-top: 0.35in;
  }
  .toc-head {
    text-align: center;
    margin: 0 0 0.5in;
  }
  .toc-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 560, "WONK" 1;
    font-size: 2.8rem;
    color: #14142b;
    margin: 0;
  }
  /* Gold hairline flourish with a centred navy diamond — echoes the cover. */
  .toc-flourish {
    display: block;
    width: 2.4in;
    height: 9px;
    margin: 0.16in auto 0;
    background:
      linear-gradient(#c9a227, #c9a227) center / 100% 1px no-repeat;
    position: relative;
  }
  .toc-flourish::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    transform: translate(-50%, -50%) rotate(45deg);
    background: #14142b;
  }
  /* Two columns split by a hairline rule. */
  .toc-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    max-width: 6.7in;
    margin: 0 auto;
    width: 100%;
  }
  .toc-col {
    display: flex;
    flex-direction: column;
    gap: 0.4in;
    padding: 0 0.5in;
  }
  .toc-col:first-child {
    border-right: 1px solid #e2def0;
  }
  .toc-sec {
    break-inside: avoid;
  }
  /* Big editorial section numeral + title on a shared baseline, gold rule. */
  .toc-sec-h {
    margin: 0 0 0.18in;
    padding-bottom: 0.09in;
    border-bottom: 1.5px solid #c9a227;
    display: flex;
    align-items: baseline;
    gap: 0.34em;
  }
  .toc-num {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 620, "WONK" 1;
    font-size: 1.95rem;
    line-height: 1;
    color: #2342c9;
  }
  .toc-sec-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 580, "WONK" 1;
    font-size: 1.32rem;
    color: #14142b;
  }
  .toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .toc-item {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-weight: 600;
    font-size: 1.3rem;
    color: #18181f;
    line-height: 1.6;
  }
  .toc-sub {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.1rem;
    color: #4a4658;
    line-height: 1.5;
    padding-left: 1.1em;
  }
</style>

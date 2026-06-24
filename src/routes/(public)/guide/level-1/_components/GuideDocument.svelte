<script lang="ts">
  /**
   * The Level 1 guide as ONE ordered page sequence — the single source of truth
   * for what pages exist and in what order. Both the print route (stacked pages)
   * and the book route (StPageFlip scaled pages) render this, so the two can
   * never drift in contents or order.
   *
   * The caller supplies a `page` snippet that wraps each page's content however
   * it needs (a stacked GuidePage for print, a scaled flip page for the book).
   * GuideDocument owns the content + the front-matter styling; the wrapper owns
   * the page frame (header, number, sheet).
   */
  import type { Snippet, Component } from "svelte";
  import GuideCover from "./GuideCover.svelte";
  import GuideTOC from "./GuideTOC.svelte";
  import PagePlaceholder from "./PagePlaceholder.svelte";
  import { GUIDE_BODY_PAGES, type GuidePageMeta } from "../_data/guide-manifest";

  let {
    page,
    coverTheme = "navy",
    built = {},
  }: {
    page: Snippet<[GuidePageMeta]>;
    coverTheme?: "navy" | "light";
    /** Built per-page components keyed by manifest id; rest render a placeholder. */
    built?: Record<string, Component>;
  } = $props();

  // ONE QR → the support page Austen owns (handles/methods can change without a
  // reprint). Kept identical to the original print front matter.
  const SUPPORT_QR = "/guide/level-1/images/_shared/qr-support.png";
  const SUPPORT_URL = "tkaflowarts.com/support";
</script>

{#snippet coverContent()}
  <div class="cover-fill"><GuideCover theme={coverTheme} /></div>
{/snippet}

{#snippet drinkContent()}
  <div class="frontmatter">
    <div class="ripple" aria-hidden="true"><span></span><span></span><span></span></div>
    <p class="drink">drink water</p>
  </div>
{/snippet}

{#snippet supportContent()}
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
{/snippet}

{#snippet readmeContent()}
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
{/snippet}

{#snippet tocContent()}
  <GuideTOC />
{/snippet}

<!-- Front matter (unnumbered), then the numbered body pages. ORDER IS CANONICAL. -->
{@render page({ kind: "cover", fullBleed: true, label: "p1 — Cover", content: coverContent })}
{@render page({ kind: "drink", label: "p2 — drink water", content: drinkContent })}
{@render page({ kind: "support", title: "Support the work", label: "p3 — Support", content: supportContent })}
{@render page({ kind: "readme", title: "Read Me First", label: "p4 — Read Me First", content: readmeContent })}
{@render page({ kind: "toc", title: "Table of Contents", label: "p5 — Table of Contents", content: tocContent })}
{#each GUIDE_BODY_PAGES as entry, i}
  {#snippet bodyContent()}
    {@const Built = built[entry.id]}
    {#if Built}<Built />{:else}<PagePlaceholder />{/if}
  {/snippet}
  {@render page({
    kind: "body",
    title: entry.title,
    pageNumber: i + 1,
    label: `body p${i + 1} — ${entry.title}`,
    content: bodyContent,
  })}
{/each}

<style>
  /* Cover — full-bleed GuideCover. aspect-ratio gives the box a concrete height
     (width × 11/8.5) so the cover's height:100% layout fills the page. */
  .cover-fill {
    width: 100%;
    aspect-ratio: 8.5 / 11;
  }

  /* Front-matter pages (white interior, ink-cheap). flex:1 + min-height:0 makes
     it fill the page body BELOW the header (not a fixed 9.4in that overflows the
     header and shoves content low), so content centres in the true remaining
     space — header pinned top, QR/text dead-centre under it. */
  .frontmatter {
    flex: 1 1 auto;
    min-height: 0;
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
  /* Support page: centred sentence-per-line. */
  .support .ln {
    display: block;
  }

  /* ── Read Me First (authored letter, not a textbook block) ─────────────
     A framed column: margin:auto centres it in the page body so there's even
     breathing room top, bottom, and both sides — intentionally placed. */
  .read-me {
    max-width: 5.4in;
    margin: auto;
    padding: 0.2in 0.25in;
  }
  .read-me p {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.06rem;
    line-height: 1.56;
    color: #20202a;
    margin: 0 0 0.7rem;
    text-align: justify;
    hyphens: auto;
  }
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
    margin-top: 0.3in !important;
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

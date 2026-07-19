<!--
  HomeHero

  The homepage's above-the-fold hero: the H1 statement, the live per-visit
  sequence demo (promoted from the composer page so any host can use it),
  and a pointer link to the What is TKA first-read (/about) for strangers.

  The fixture (FALLBACK_DEMO, a real sequence) is the initial content and is
  present at SSR — the caption word renders before JS runs, unlike the
  composer host which starts null and generates on mount. No auto-reroll on
  mount here; a visitor sees a real notated sequence immediately, and can
  reroll into a fresh one with the dice button SequenceHeroDemo already owns.
-->
<script lang="ts">
  import SequenceHeroDemo from "./SequenceHeroDemo.svelte";
  import { FALLBACK_DEMO, generatePerVisitDemo } from "$lib/shared/landing/data/per-visit-demo";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  let demoSeq = $state<SequenceData>(FALLBACK_DEMO);
  let rerolling = $state(false);

  async function reroll() {
    if (rerolling) return;
    rerolling = true;
    try {
      demoSeq = await generatePerVisitDemo();
    } finally {
      rerolling = false;
    }
  }
</script>

<section class="home-hero">
  <!-- Display title + subline in ONE h1, so the heading's accessible/SEO text
       still carries both the brand and the "notation ... flow arts" phrase. -->
  <h1 class="home-hero-title">
    <span class="title-main">The Kinetic Alphabet</span>
    <span class="title-sub">Notation for flow arts</span>
  </h1>

  <SequenceHeroDemo
    sequence={demoSeq}
    note="played straight from its notation"
    onReroll={reroll}
    rerolling={rerolling}
  />

  <p class="hero-pointer">
    New here? Start with <a href="/about" class="pointer-link">What is TKA?</a>
  </p>
</section>

<style>
  .home-hero {
    display: flex;
    flex-direction: column;
    /* stretch, NOT center: centered flex items shrink to fit-content, and the
       demo stage's only in-flow content is its caption line, so centering
       collapsed the whole player to ~285px. Children center themselves
       (margin-inline auto + text-align). */
    align-items: stretch;
    justify-content: center;
    text-align: center;
    /* Aim at roughly one viewport minus the header + enough for the grid
       below to peek above the fold on desktop. The header is sticky and
       sits above this section already, so this box does not add its own
       header padding on top of that. */
    min-height: calc(100svh - clamp(220px, 26vh, 320px));
    /* Top padding clears the fixed MarketingChrome header (~64px) so the
       title never slides under it when the content centers. */
    padding: calc(64px + clamp(1.5rem, 3.5vh, 2.5rem)) 1.25rem clamp(1.5rem, 4vh, 2.5rem);
  }

  .home-hero-title {
    margin: 0;
  }
  .title-main {
    display: block;
    max-width: 14ch;
    margin-inline: auto;
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-weight: 500;
    /* Fluid to 4K/5K: ~2.4rem on phones, ~4.5rem at 1920, capped 6rem. */
    font-size: clamp(2.4rem, 3.4vw + 0.5rem, 6rem);
    line-height: 1.06;
    letter-spacing: -0.015em;
    color: oklch(0.94 0.02 270);
  }
  .title-sub {
    display: block;
    margin-top: 0.55em;
    font-size: clamp(1rem, 0.9vw + 0.3rem, 1.7rem);
    font-weight: 400;
    letter-spacing: 0.04em;
    color: oklch(0.72 0.02 270);
  }

  .hero-pointer {
    margin: 1.6rem 0 0;
    font-size: clamp(0.9rem, 0.86rem + 0.1vw, 1rem);
    color: oklch(0.66 0.02 270);
  }

  /* Standalone CTA (not inline prose): a visible pill, not a bare text link,
     per clickables-look-like-buttons. */
  .pointer-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.35em 0.9em;
    margin-left: 0.15em;
    border-radius: 10px;
    background: oklch(0.3 0.04 270 / 0.18);
    border: 1px solid oklch(0.5 0.06 270 / 0.3);
    color: oklch(0.9 0.015 270);
    font-weight: 600;
    text-decoration: none;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }
  .pointer-link:hover {
    transform: translateY(-2px);
    background: oklch(0.34 0.05 270 / 0.26);
    border-color: oklch(0.6 0.08 270 / 0.5);
  }

  @media (pointer: coarse) {
    .pointer-link {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pointer-link {
      transition: none;
    }
    .pointer-link:hover {
      transform: none;
    }
  }

  @media (max-width: 600px) {
    .home-hero {
      /* Mobile may be shorter than a viewport; never taller. */
      min-height: auto;
      padding: 2rem 1.25rem 1.75rem;
    }
  }

  /* Split tier: the page composes hero (left pane) + launchpad (right pane)
     into one viewport (see +page.svelte). The pane owns the height, so the
     stacked-mode viewport sizing comes off. */
  @media (min-width: 1680px) {
    .home-hero {
      min-height: 0;
      height: 100%;
      padding: 1.5rem 0;
    }
    /* One-viewport budget: title (~200px) + caption/dice/pointer (~290px)
       leave ~500px for the stage at 1080p. SequenceHeroDemo's own ultrawide
       60vh cap is tuned for stacked pages and overflows the split pane. */
    .home-hero :global(.hero-demo) {
      max-width: min(48vh, 34rem);
    }
  }

  /* 4K tier: the taller viewport affords a larger stage so the hero keeps
     its weight against the scaled-up grid. */
  @media (min-width: 2200px) {
    .home-hero :global(.hero-demo) {
      max-width: min(44vh, 46rem);
    }
  }
</style>

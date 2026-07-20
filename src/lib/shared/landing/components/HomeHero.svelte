<!--
  HomeHero

  The homepage's above-the-fold hero: the H1 statement, the live per-visit
  sequence demo (promoted from the composer page so any host can use it),
  and a pointer link to the What is TKA first-read (/about) for strangers.

  The fixed stage is present at SSR, but the player stays unmounted until the
  first per-visit sequence finishes generating after hydration. The hero
  attract act (hero-act.svelte.ts) then walks through a small cycle of props,
  one freshly generated LOOP at a time, handing off at each loop boundary.
  The baked fixture is visible only if the generator itself falls back to it.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import SequenceHeroDemo from "./SequenceHeroDemo.svelte";
  import { createHeroAct } from "$lib/shared/landing/data/hero-act.svelte";
  import {
    HERO_TRAIL_PRESET,
    HERO_TIP_EFFECT_MAP,
  } from "$lib/shared/landing/data/hero-trail-preset";

  const heroAct = createHeroAct();

  onMount(() => {
    heroAct.start();
  });

  // Pinned so a visitor's persisted Compose playback speed can't skew the
  // marketing surface — every visitor sees the act at the same tempo.
  const HERO_BPM = 60;
</script>

<section class="home-hero">
  <!-- Display title + subline in ONE h1, so the heading's accessible/SEO text
       still carries both the brand and the "notation ... flow arts" phrase. -->
  <h1 class="home-hero-title">
    <span class="title-main">The Kinetic Alphabet</span>
    <span class="title-sub">Notation for flow arts</span>
  </h1>

  <SequenceHeroDemo
    sequence={heroAct.sequence}
    note="played straight from its notation"
    onReroll={heroAct.advanceNow}
    rerolling={heroAct.rerolling}
    bluePropType={heroAct.propType}
    redPropType={heroAct.propType}
    onSequenceBoundary={heroAct.offerSequenceBoundary}
    trailSettingsOverride={HERO_TRAIL_PRESET}
    tipEffectMap={HERO_TIP_EFFECT_MAP}
    externalBpm={HERO_BPM}
    showNotationStrip={true}
    showWordHeader={true}
  />

  <p class="hero-pointer">
    New here? Start with <a href="/about" class="pointer-link">What is TKA?</a>
  </p>
</section>

<style>
  .home-hero {
    display: flex;
    flex-direction: column;
    container: home-hero / inline-size;
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
    padding: calc(64px + clamp(1.5rem, 3.5vh, 2.5rem)) 1.25rem
      clamp(1.5rem, 4vh, 2.5rem);
    /* The compact notation rail replaces the old visible caption. At stacked
       widths, a slightly tighter square keeps the combined media card at the
       same visual weight as the former stage + caption. */
    --hero-demo-max-width: min(24rem, 100%);
  }

  .home-hero-title {
    margin: 0;
  }
  .title-main {
    display: block;
    max-width: 14ch;
    margin-inline: auto;
    font-family: var(
      --landing-heading-font,
      "Playfair Display",
      Georgia,
      serif
    );
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

  /* Tablet composition: the page owns the two panes, so this side only has
     to balance its title, player, and two actions inside the available height. */
  @media (min-width: 760px) and (max-width: 1679px) and (min-height: 500px) {
    .home-hero {
      min-height: 0;
      height: 100%;
      padding: clamp(0.75rem, 2svh, 1.5rem) 0;
      --hero-demo-max-width: min(100%, clamp(15rem, 36svh, 24rem));
    }
    .home-hero :global(.hero-demo.with-notation-strip) {
      margin-top: clamp(1rem, 2.4svh, 1.8rem);
    }
    .title-main {
      font-size: clamp(2.5rem, 11cqi, 3.5rem);
    }
    .title-sub {
      font-size: clamp(0.9rem, 3.5cqi, 1.15rem);
    }
    .hero-pointer {
      margin-top: clamp(0.75rem, 2svh, 1.25rem);
      font-size: 0.9rem;
    }
  }

  @media (min-width: 760px) and (max-width: 1679px) and (min-height: 500px) and (max-height: 850px) {
    .home-hero {
      padding: 0.5rem 0;
      --hero-demo-max-width: min(100%, 30svh);
    }
    .home-hero :global(.hero-demo.with-notation-strip) {
      margin-top: 0.75rem;
    }
    .title-main {
      font-size: clamp(2.15rem, 10cqi, 2.75rem);
    }
    .title-sub {
      margin-top: 0.35em;
      font-size: 0.9rem;
    }
    .hero-pointer {
      margin-top: 0.5rem;
    }
  }

  /* A Fold in landscape has tablet width but substantially less height. The
     thumbnail rail disappears at this size, so the animation can spend that
     recovered height on a much wider square without pushing out either CTA. */
  @media (min-width: 760px) and (max-width: 1180px) and (min-height: 500px) and (max-height: 649px) {
    .home-hero {
      padding: 0.25rem 0;
      --hero-demo-max-width: min(100%, 40svh);
    }
    .home-hero :global(.hero-demo.with-notation-strip) {
      margin-top: 0.35rem;
    }
    .title-main {
      font-size: clamp(1.75rem, 9cqi, 2.1rem);
    }
    .title-sub {
      margin-top: 0.2em;
      font-size: 0.8rem;
    }
    .hero-pointer {
      margin-top: 0.25rem;
      font-size: 0.875rem;
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
      /* 48px comes back out of the square because the compact rail adds 79px
         where the visible caption previously occupied roughly 30px. */
      --hero-demo-wide-max-width: min(calc(48svh - 3rem), 31rem);
    }
    .title-main {
      font-size: clamp(3.8rem, 11.3cqi, 4.4rem);
    }
    .title-sub {
      font-size: 1.3rem;
    }
    .hero-pointer {
      font-size: 0.95rem;
    }
  }
</style>

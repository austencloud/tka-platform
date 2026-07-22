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
  import { runAfterNamedRouteMorphIdle } from "$lib/shared/transitions/named-route-morph-state.svelte";
  import {
    HERO_TRAIL_PRESET,
    HERO_TIP_EFFECT_MAP,
  } from "$lib/shared/landing/data/hero-trail-preset";
  import {
    trackCtaClick,
    trackDemoInteraction,
  } from "$lib/shared/analytics/landing-events";

  const heroAct = createHeroAct();

  onMount(() => {
    return runAfterNamedRouteMorphIdle(heroAct.start);
  });

  // Pinned so a visitor's persisted Compose playback speed can't skew the
  // marketing surface — every visitor sees the act at the same tempo.
  const HERO_BPM = 60;

  // Mirrors composer/+page.svelte's rerollHeroDemo: the dice button is the
  // only reroll on this page, so the tracking call and the actual advance
  // stay paired in one wrapper rather than threading a callback into
  // SequenceHeroDemo (shared by 16+ files, per landing-analytics-taxonomy §5).
  function handleReroll(): void {
    trackDemoInteraction("try_another");
    void heroAct.advanceNow();
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
    sequence={heroAct.sequence}
    element={heroAct.element}
    note="played straight from its notation"
    onReroll={handleReroll}
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
    New here? Start with
    <a
      href="/about"
      class="pointer-link"
      onclick={() =>
        trackCtaClick("hero", { cta_type: "what_is_tka", destination: "/about" })}
      >What is TKA?</a
    >
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

  /* The mobile fallback is intentionally scroll-safe. Compact one-viewport
     layouts override these values below; unusually short windows still keep
     the title clear of the fixed header and cap the player by block space. */
  @media (width < 42rem) {
    .home-hero {
      min-height: auto;
      padding: calc(64px + 1rem) 1.25rem 1.75rem;
      --hero-demo-max-width: min(
        100%,
        clamp(12rem, calc(100svh - 13rem), 24rem)
      );
    }
  }

  /* Tablet composition: the page owns the two panes, so this side only has
     to balance its title, player, and two actions inside the available height. */
  @media (width >= 42rem) and (width < 105rem) and (height >= 500px) {
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

  @media (width >= 42rem) and (width < 105rem) and (height >= 500px) and (max-height: 850px) {
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

  /* A short split pane cannot carry the title, horizontal thumbnail rail,
     player controls, and CTA without climbing behind the fixed header. The
     rail disappears here and the recovered height returns to the square. */
  @media (width >= 42rem) and (width < 105rem) and (height >= 500px) and (height < 44rem) {
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

  /* Sideways phones get a single-line title and a rail-free animation. The
     first-read link remains in the menu so the live example can stay legible. */
  @media (width >= 35rem) and (height < 500px),
    (width >= 105rem) and (height < 56.25rem) {
    .home-hero {
      min-height: 0;
      height: 100%;
      padding: 0;
      --hero-demo-max-width: min(100%, 36svh);
    }
    .home-hero :global(.hero-demo.with-notation-strip) {
      margin-top: 0.25rem;
    }
    .title-main {
      max-width: none;
      font-size: clamp(1.1rem, 7cqi, 1.4rem);
      white-space: nowrap;
    }
    .title-sub {
      margin-top: 0.1em;
      font-size: var(--font-size-compact, 0.75rem);
    }
    .hero-pointer {
      display: none;
    }
  }

  /* Narrow screens stay in the compact hierarchy at every height. Below
     500px the rail is removed by SequenceHeroDemo, so the same footprint gives
     the square back its usable width while the page remains scroll-safe. */
  @media (width < 35rem),
    (width < 42rem) and (height >= 500px) {
    .home-hero {
      min-height: 0;
      padding: 0;
      justify-content: flex-start;
      /* 40svh -> 32svh. The demo was taking ~34% of the phone viewport, which
         squeezed the launchpad below it into six equal 105px strips with no
         room to rank anything. The reclaimed height pays for the first-read
         link below and for Composer's full-width band in the bento. */
      --hero-demo-max-width: min(100%, clamp(12rem, 32svh, 17rem));
    }
    .home-hero :global(.hero-demo.with-notation-strip) {
      margin-top: 0.35rem;
    }
    .title-main {
      font-size: clamp(1.75rem, 9.5vw, 2.1rem);
    }
    .title-sub {
      margin-top: 0.2em;
      font-size: var(--font-size-min, 0.875rem);
    }
    /* Kept visible on phones. For a stranger this is the highest-value link on
       the page — hiding it here removed the one door that explains the rest,
       from exactly the audience most likely to need it. */
    .hero-pointer {
      margin-top: 0.5rem;
      font-size: var(--font-size-min, 0.875rem);
    }
    .pointer-link {
      min-height: var(--min-touch-target, 44px);
      font-size: var(--font-size-min, 0.875rem);
    }
  }

  /* Extra-tall phones have enough block space to give the live example its
     intended visual weight. The width remains capped by the component, while
     the height query prevents this larger stage from crowding shorter phones. */
  @media (width < 42rem) and (min-height: 56rem) and (orientation: portrait) {
    .home-hero {
      --hero-demo-max-width: min(100%, clamp(17rem, 34svh, 21rem));
    }
  }

  /* Split tier: the page composes hero (left pane) + launchpad (right pane)
     into one viewport (see +page.svelte). The pane owns the height, so the
     stacked-mode viewport sizing comes off. */
  @media (width >= 105rem) and (height >= 56.25rem) {
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

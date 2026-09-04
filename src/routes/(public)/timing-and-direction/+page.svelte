<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";
  import TimingDirectionBoard from "$lib/features/learn/components/interactive/motions/TimingDirectionBoard.svelte";
  import {
    TIMING_DIRECTION_MODES,
    type TimingDirectionMode,
  } from "$lib/features/learn/components/interactive/foundations/pictograph-foundation-content";
  import {
    getTimingDirectionArticleByPair,
    TIMING_DIRECTION_ARTICLES,
  } from "./_data/timing-direction-articles";

  const TITLE = "Timing and Direction in Flow Arts: All 6 Modes";
  const DESCRIPTION =
    "Together, split, and quarter timing crossed with same or opposite direction. See all six flow-arts modes with animations, definitions, history, and TKA examples.";
  const URL = "https://tkaflowarts.com/timing-and-direction";

  function articleHrefFor(mode: TimingDirectionMode): string {
    const article = getTimingDirectionArticleByPair(
      mode.timing,
      mode.direction
    );
    return `/timing-and-direction/${article.slug}`;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Timing and Direction in Flow Arts",
        headline: TITLE,
        description: DESCRIPTION,
        url: URL,
        inLanguage: "en-US",
        author: {
          "@type": "Person",
          name: "Austen Cloud",
          url: "https://tkaflowarts.com/about",
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: TIMING_DIRECTION_ARTICLES.length,
          itemListElement: TIMING_DIRECTION_ARTICLES.map((article, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: article.name,
            url: `${URL}/${article.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://tkaflowarts.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Timing and Direction",
            item: URL,
          },
        ],
      },
    ],
  };
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`}
</Seo>

<div class="editorial timing-page">
  <a class="back-link" href="/learn/concepts">← Interactive lessons</a>

  <header class="editorial-header center">
    <h1 class="page-title">Timing and Direction</h1>
    <p class="page-subtitle">Three timings × two directions = six modes</p>
  </header>

  <section class="mode-atlas" aria-label="All six timing and direction modes">
    <div class="board-frame">
      <TimingDirectionBoard
        modes={TIMING_DIRECTION_MODES}
        {articleHrefFor}
        showDirectionRowLabels
      />
    </div>
    <p class="board-note">Choose a mode to inspect it and open its article.</p>
  </section>

  <section class="history-link" aria-labelledby="history-title">
    <div>
      <p class="section-kicker">History</p>
      <h2 id="history-title">Where the vocabulary came from</h2>
    </div>
    <a href="/history#archive-record-vtg">
      <span>Open the VTG history record</span>
      <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
    </a>
  </section>
</div>

<style>
  .timing-page {
    padding-bottom: clamp(3rem, 6vw, 6rem);
  }

  .editorial-header {
    margin-bottom: clamp(1.5rem, 3vw, 2.75rem);
  }

  .mode-atlas {
    width: 100%;
    display: grid;
    gap: 0.75rem;
  }

  .board-frame {
    width: 100%;
    height: clamp(36rem, 64vh, 48rem);
    min-height: 0;
  }

  .board-note {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.45;
    text-align: center;
  }

  .history-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    margin-top: clamp(2.5rem, 5vw, 5rem);
    padding-top: clamp(1.5rem, 3vw, 2.5rem);
    border-top: 1px solid var(--theme-stroke);
  }

  .history-link > div {
    display: grid;
    gap: 0.35rem;
  }

  .history-link h2 {
    margin: 0;
    color: var(--theme-text);
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-size: clamp(1.45rem, 1.25rem + 0.6vw, 2rem);
    line-height: 1.15;
  }

  .history-link a {
    flex: 0 0 auto;
    min-height: var(--min-touch-target, 44px);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    padding: 0.65rem 1rem;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    text-decoration: none;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-card-bg);
    transition:
      background-color var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out);
  }

  .history-link a:hover {
    border-color: var(--theme-accent);
    background: var(--theme-card-bg-hover);
  }

  .history-link a:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 3px;
  }

  @media (max-width: 820px) {
    .board-frame {
      height: 48rem;
    }
  }

  @media (max-width: 580px) {
    .board-frame {
      height: 44rem;
    }

    .history-link {
      align-items: stretch;
      flex-direction: column;
    }

    .history-link a {
      width: 100%;
    }
  }

  @media (max-height: 540px) and (min-width: 701px) {
    .board-frame {
      height: 22rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .history-link a {
      transition: none;
    }
  }
</style>

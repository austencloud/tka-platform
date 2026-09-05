<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";
  import TimingDirectionAtlas from "./_components/TimingDirectionAtlas.svelte";
  import { TIMING_DIRECTION_ARTICLES } from "./_data/timing-direction-articles";

  const TITLE = "Timing and Direction in Flow Arts: All 6 Modes";
  const DESCRIPTION =
    "Together, split, and quarter timing crossed with same or opposite direction. See all six flow-arts modes with animations, definitions, history, and TKA examples.";
  const URL = "https://tkaflowarts.com/timing-and-direction";

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
  <header class="editorial-header">
    <h1 class="page-title">Timing and Direction</h1>
    <p class="page-subtitle">
      Compare the timing and direction of the blue and red hands.
    </p>
  </header>

  <TimingDirectionAtlas />

  <section class="history-sources" aria-labelledby="history-title">
    <h2 id="history-title">History & sources</h2>
    <p>
      These terms developed through community practice and teaching. Early poi
      discussions document the vocabulary before VTG organized it into a
      transition framework.
    </p>
    <ul>
      <li>
        <span>2002</span>
        <a
          href="https://www.homeofpoi.com/en/community/forums/topics/120838/How-do-you-define-a-weave"
        >
          Weave timing and direction discussions
        </a>
      </li>
      <li>
        <span>2002</span>
        <a
          href="https://www.homeofpoi.com/en/community/forums/topics/122222/Concept-moves-and-why-make-lists"
        >
          Jez describes quarter-time butterflies
        </a>
      </li>
      <li>
        <span>2009</span>
        <a
          href="https://www.homeofpoi.com/fr/community/forums/topics/887635/X-Post-Prop-Transitioning-Article"
        >
          Noel Yee’s prop-transition article
        </a>
      </li>
    </ul>
    <nav aria-label="More about timing and direction">
      <a href="/history">Explore the history</a>
      <a href="/history#archive-record-vtg">VTG history record</a>
      <a href="/learn/concepts">Interactive lessons</a>
    </nav>
  </section>
</div>

<style>
  .timing-page {
    max-width: min(var(--shell-w), 100rem);
    padding: 88px 1.5rem 3rem;
  }

  .editorial-header {
    margin: 0.5rem 0 1.5rem;
    text-align: left;
  }

  .page-title {
    font-size: clamp(2rem, 1.5rem + 2vw, 3.5rem);
  }

  .page-subtitle {
    max-width: 46rem;
    color: var(--theme-text-dim);
    font-size: 1rem;
    line-height: 1.5;
  }

  .history-sources {
    margin-top: 2.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--theme-stroke);
  }

  .history-sources h2 {
    margin: 0 0 0.5rem;
    color: var(--theme-text);
    font-size: 1.25rem;
  }

  .history-sources p {
    max-width: 48rem;
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 1rem;
    line-height: 1.5;
  }

  .history-sources ul {
    padding: 0;
    margin: 0.75rem 0;
    list-style: none;
  }

  .history-sources li {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    font-size: 0.875rem;
  }

  .history-sources li span {
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }

  .history-sources a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--theme-text);
    text-underline-offset: 0.2em;
    line-height: 1.4;
  }

  .history-sources a:hover {
    color: var(--theme-accent);
  }

  .history-sources a:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 3px;
  }

  .history-sources nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    font-size: 0.875rem;
  }

  @media (max-width: 600px) {
    .timing-page {
      max-width: 100%;
      padding: 76px 1rem 2rem;
    }

    .editorial-header {
      margin: 0 0 1rem;
    }

    .page-subtitle {
      font-size: 0.875rem;
    }
  }
</style>

<script lang="ts">
  import type { PageData } from "./$types";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
  import { TIMING_DIRECTION_MODES } from "$lib/features/learn/components/interactive/foundations/pictograph-foundation-content";
  import Seo from "$lib/shared/components/Seo.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";
  import TimingDirectionModeCard from "../_components/TimingDirectionModeCard.svelte";
  import {
    getTimingDirectionArticle,
    TIMING_DIRECTION_ARTICLES,
  } from "../_data/timing-direction-articles";

  let { data }: { data: PageData } = $props();

  const article = $derived(getTimingDirectionArticle(data.mode)!);
  const element = $derived(TND_BY_FAMILY[article.familyId] ?? null);
  const mode = $derived(
    TIMING_DIRECTION_MODES.find(
      (candidate) =>
        candidate.timing === article.timing &&
        candidate.direction === article.direction
    ) ?? TIMING_DIRECTION_MODES[0]!
  );
  const relatedArticles = $derived(
    TIMING_DIRECTION_ARTICLES.filter(
      (candidate) => candidate.code !== article.code
    )
  );
  const canonical = $derived(
    `https://tkaflowarts.com/timing-and-direction/${article.slug}`
  );
  const lessonHref = $derived(
    article.timing === "Quarter"
      ? "/learn/concepts/gamma-motion"
      : "/learn/concepts/dual-shifts-alpha-beta"
  );
  const jsonLd = $derived({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.name,
        name: article.name,
        description: article.metaDescription,
        url: canonical,
        inLanguage: "en-US",
        author: {
          "@type": "Person",
          name: "Austen Cloud",
          url: "https://tkaflowarts.com/about",
        },
        isPartOf: {
          "@type": "CollectionPage",
          name: "Timing and Direction in Flow Arts",
          url: "https://tkaflowarts.com/timing-and-direction",
        },
        about: {
          "@type": "DefinedTerm",
          name: article.name,
          alternateName: article.aliases,
          description: article.definition,
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
            item: "https://tkaflowarts.com/timing-and-direction",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.name,
            item: canonical,
          },
        ],
      },
    ],
  });
</script>

<Seo
  title={`${article.name}: Flow Arts Timing & Direction`}
  description={article.metaDescription}
  {canonical}
  ogType="article"
>
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`}
</Seo>

<div
  class="editorial mode-page"
  style:--mode-accent={element?.accentColor ?? "#8b6cff"}
>
  <a class="back-link" href="/timing-and-direction">← All six modes</a>

  <header class="mode-header">
    <div class="mode-heading">
      {#if element}
        <img src={element.iconPath} alt="" />
      {/if}
      <div>
        <p class="section-kicker">{article.code} · {element?.element}</p>
        <h1 class="page-title">{article.name}</h1>
        <p class="page-subtitle">
          {article.phase} phase · {article.direction.toLowerCase()} rotation
        </p>
      </div>
    </div>

    <dl class="mode-facts">
      <div>
        <dt>Timing</dt>
        <dd>{article.timing}</dd>
      </div>
      <div>
        <dt>Direction</dt>
        <dd>{article.direction}</dd>
      </div>
      <div>
        <dt>Phase</dt>
        <dd>{article.phase}</dd>
      </div>
      <div>
        <dt>TKA example</dt>
        <dd>Letter {article.representativeLetter}</dd>
      </div>
    </dl>
  </header>

  <section
    class="editorial-section has-duo"
    style="--accent: var(--mode-accent)"
  >
    <div class="section-duo demo-star">
      <div class="duo-demo">
        <SequenceHeroDemo
          sequence={mode.sequence}
          element={mode.element}
          note={`${article.compactName} · ${article.phase} phase`}
          externalBpm={60}
          cornerToggle
          loadPriority="immediate"
        />
      </div>
      <div class="duo-copy">
        <p class="section-kicker">Definition</p>
        <h2 class="section-title">What {article.compactName} means</h2>
        <div class="prose">
          <p class="definition">{article.definition}</p>
          <p>{article.watchFor}</p>
        </div>
      </div>
    </div>
  </section>

  <section
    class="explanation-grid editorial-section"
    style="--accent: var(--mode-accent)"
  >
    <article>
      <p class="section-kicker">In practice</p>
      <h2>Where you see it</h2>
      <p>{article.example}</p>
    </article>
    <article>
      <p class="section-kicker">Geometry</p>
      <h2>Why it holds together</h2>
      <p>{article.geometry}</p>
    </article>
    <article>
      <p class="section-kicker">Common mix-up</p>
      <h2>What the name does not mean</h2>
      <p>{article.commonMistake}</p>
    </article>
    <article>
      <p class="section-kicker">Inside TKA</p>
      <h2>How the alphabet records it</h2>
      <p>{article.tkaConnection}</p>
    </article>
  </section>

  <section
    class="editorial-section panel history-panel"
    style="--accent: var(--mode-accent)"
  >
    <p class="section-kicker">History and attribution</p>
    <h2 class="section-title">A documented thread, not an origin myth</h2>
    <div class="prose">
      <p>{article.history}</p>
      <p>
        These links establish public use and later synthesis. They do not prove
        that the earliest surviving post was the first time the relationship was
        practiced, taught, or named.
      </p>
    </div>
    <div class="source-list" aria-label="Sources for this article">
      {#each article.sources as source}
        <a href={source.url} rel="noreferrer">
          <span>{source.label}</span>
          <small>{source.detail}</small>
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"
          ></i>
        </a>
      {/each}
    </div>
  </section>

  <section class="editorial-section" style="--accent: var(--mode-accent)">
    <p class="section-kicker">Keep mapping</p>
    <h2 class="section-title">Compare the other five modes</h2>
    <div class="related-grid">
      {#each relatedArticles as related (related.code)}
        <TimingDirectionModeCard article={related} compact />
      {/each}
    </div>
  </section>

  <div class="cta-card">
    <h3>Practice {article.compactName} in motion</h3>
    <p>
      The interactive lesson connects this relationship to the TKA alphabet.
    </p>
    <a href={lessonHref} class="cta-button">
      <span>Open the matching lesson</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  .mode-header {
    display: grid;
    gap: 2rem;
    margin: 2.4rem 0 clamp(3.5rem, 5vw, 5.5rem);
  }

  .mode-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: clamp(1rem, 2vw, 1.75rem);
  }

  .mode-heading img {
    width: clamp(4.5rem, 7vw, 7rem);
    height: clamp(4.5rem, 7vw, 7rem);
    object-fit: contain;
  }

  .mode-heading .section-kicker {
    color: color-mix(in oklch, var(--mode-accent) 72%, white);
  }

  .mode-heading .page-title {
    margin-bottom: 0.55rem;
  }

  .mode-facts {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0;
    border: 1px solid
      color-mix(in oklch, var(--mode-accent) 25%, var(--theme-stroke));
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in oklch,
      var(--mode-accent) 6%,
      var(--theme-card-bg)
    );
    overflow: clip;
  }

  .mode-facts div {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
    padding: 1rem 1.2rem;
  }

  .mode-facts div + div {
    border-inline-start: 1px solid var(--theme-stroke);
  }

  .mode-facts dt {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .mode-facts dd {
    margin: 0;
    color: var(--theme-text);
    font-size: clamp(1rem, 0.92rem + 0.3vw, 1.25rem);
    font-weight: 680;
  }

  .definition {
    color: var(--theme-text);
    font-size: clamp(1.1rem, 1rem + 0.3vw, 1.35rem);
  }

  .explanation-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(1rem, 2vw, 1.5rem);
  }

  .explanation-grid article {
    padding: clamp(1.2rem, 2vw, 1.8rem);
    border: 1px solid
      color-mix(in oklch, var(--mode-accent) 20%, var(--theme-stroke));
    border-radius: var(--radius-lg, 0.75rem);
    background: color-mix(
      in oklch,
      var(--mode-accent) 5%,
      var(--theme-card-bg)
    );
  }

  .explanation-grid h2 {
    margin: 0 0 0.7rem;
    color: var(--theme-text);
    font-size: clamp(1.2rem, 1.05rem + 0.4vw, 1.55rem);
    line-height: 1.2;
  }

  .explanation-grid article > p:last-child {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: clamp(0.95rem, 0.92rem + 0.12vw, 1.08rem);
    line-height: 1.65;
  }

  .history-panel .prose {
    margin-bottom: 1.6rem;
  }

  .source-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .source-list a {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.3rem 0.8rem;
    min-height: 44px;
    padding: 0.9rem 1rem;
    color: var(--theme-text);
    text-decoration: none;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-md, 0.5rem);
    background: var(--theme-card-bg);
  }

  .source-list a:hover {
    border-color: color-mix(
      in oklch,
      var(--mode-accent) 55%,
      var(--theme-stroke-strong)
    );
    background: var(--theme-card-bg-hover);
  }

  .source-list a:focus-visible {
    outline: 2px solid var(--mode-accent);
    outline-offset: 3px;
  }

  .source-list span {
    font-weight: 680;
  }

  .source-list small {
    grid-column: 1 / -1;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.45;
  }

  .source-list i {
    color: var(--mode-accent);
    font-size: 0.78rem;
  }

  .related-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.9rem;
  }

  @media (max-width: 980px) {
    .related-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .mode-facts,
    .explanation-grid,
    .source-list {
      grid-template-columns: minmax(0, 1fr);
    }

    .mode-facts div + div {
      border-inline-start: 0;
      border-top: 1px solid var(--theme-stroke);
    }
  }

  @media (max-width: 580px) {
    .mode-heading {
      align-items: start;
    }

    .mode-heading img {
      width: 3.7rem;
      height: 3.7rem;
    }

    .related-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>

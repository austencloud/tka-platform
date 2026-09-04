<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";
  import TimingDirectionExplorer from "./_components/TimingDirectionExplorer.svelte";
  import TimingDirectionModeCard from "./_components/TimingDirectionModeCard.svelte";
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
  <a class="back-link" href="/learn/concepts">← Interactive lessons</a>

  <header class="editorial-header center">
    <p class="section-kicker">The complete relationship map</p>
    <h1 class="page-title">Timing and Direction</h1>
    <p class="page-subtitle">Three timings × two directions = six modes</p>
  </header>

  <section class="editorial-section explorer-section" style="--accent: #ffde17">
    <TimingDirectionExplorer />
  </section>

  <section class="editorial-section" style="--accent: #75a874">
    <p class="section-kicker">All six modes</p>
    <h2 class="section-title">A small system with no missing corners</h2>
    <div class="prose">
      <p>
        Timing asks where two moving props are in their cycles. Direction asks
        whether they rotate the same way or opposite ways. Keep those questions
        separate and every pairing has a name.
      </p>
      <p>
        Together means a zero-degree phase gap. Split means 180 degrees. Quarter
        means one prop leads the other by 90 degrees, with a second version at
        270 degrees when the leader changes. Cross those three timings with the
        two directions and the result is the six-mode map below.
      </p>
    </div>

    <div class="mode-grid" aria-label="Six timing and direction articles">
      {#each TIMING_DIRECTION_ARTICLES as article (article.code)}
        <TimingDirectionModeCard {article} />
      {/each}
    </div>
  </section>

  <section class="editorial-section panel" style="--accent: #6a4199">
    <p class="section-kicker">Timing is not placement</p>
    <h2 class="section-title">
      The same angle can answer a different question
    </h2>
    <div class="prose">
      <p>
        Quarter timing and gamma placement both involve 90 degrees, but they do
        not describe the same relationship. Quarter timing compares where the
        props are in their cycles. Gamma placement compares where the hands sit
        on the grid.
      </p>
      <p>
        TKA keeps those variables separate. Beta places both hands at the same
        point, gamma places them on adjacent points, and alpha places them on
        opposite points. Timing and direction can then describe how the hands or
        props move from there. The
        <a href="/guide/level-1/hand-positions">Hand Positions guide</a>
        covers the placement side.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f2673a">
    <p class="section-kicker">Public record</p>
    <h2 class="section-title">
      The vocabulary grew before any one system owned it
    </h2>
    <div class="prose">
      <p>
        Poi spinners were discussing the four together/split and same/opposite
        combinations by
        <a
          href="https://www.homeofpoi.com/en/community/forums/topics/120838/How-do-you-define-a-weave"
          rel="noreferrer">August 2002</a
        >. Quarter-time butterflies appear in another
        <a
          href="https://www.homeofpoi.com/en/community/forums/topics/122222/Concept-moves-and-why-make-lists"
          rel="noreferrer">public discussion from November 2002</a
        >.
      </p>
      <p>
        A
        <a
          href="https://www.homeofpoi.com/fr/community/forums/topics/611260/1/Re-Can-you-do-this-move"
          rel="noreferrer">2005 terminology thread</a
        >
        maps all four original combinations and argues for keeping timing and direction
        separate because quarter-time weaves and butterflies exceed the older labels.
        Noel Yee's
        <a
          href="https://www.homeofpoi.com/fr/community/forums/topics/887635/X-Post-Prop-Transitioning-Article"
          rel="noreferrer">2009 transition article</a
        >
        organizes the original four and describes itself as a synthesis from multiple
        sources. VTG became an important teaching and transition lineage for those
        modes.
      </p>
      <p>
        TKA's public repository encoded Quarter-Same and Quarter-Opposite, with
        placement, timing, and direction stored independently, by
        <a
          href="https://github.com/austencloud/tka-platform/commit/50bdc56725b54fbb363224b8f9f001228b988e02"
          rel="noreferrer">June 20, 2025</a
        >. These pages document that record without turning the earliest source
        found into an unsupported inventorship claim.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #bce4f7">
    <p class="section-kicker">Inside TKA</p>
    <h2 class="section-title">One map for hands and props</h2>
    <div class="prose">
      <p>
        TKA can apply the same six relationships at two levels. Hand timing and
        direction describe the paths the hands take around the grid. Prop timing
        and direction describe the rotating objects held by those hands. A
        pictograph records both so a shared hand path can support different prop
        behavior.
      </p>
      <p>
        The element names provide a compact second label: Water, Earth, and Sun
        for the same-direction modes; Fire, Air, and Moon for the opposite
        direction modes. Every article connects its mode to a representative TKA
        letter and the matching element.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Practice the relationships in motion</h3>
    <p>The Learn tab introduces the six modes before the letter lessons.</p>
    <a href="/learn/concepts" class="cta-button">
      <span>Open interactive lessons</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  .timing-page {
    --timing-grid-gap: clamp(0.75rem, 1.4vw, 1.35rem);
  }

  .explorer-section {
    width: 100%;
  }

  .mode-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--timing-grid-gap);
    margin-top: clamp(1.8rem, 3vw, 3rem);
  }

  @media (max-width: 980px) {
    .mode-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 580px) {
    .mode-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>

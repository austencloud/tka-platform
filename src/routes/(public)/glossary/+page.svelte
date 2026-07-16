<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";

  let { data } = $props();

  // Position-term slugs (from @tka/domain's GLOSSARY keys, see +page.server.ts)
  // that get a pictograph thumbnail beside their definition. Fixed-size PNGs,
  // present from first paint — no layout shift.
  const POSITION_THUMBS: Record<string, { src: string; alt: string }> = {
    alpha: { src: "/images/position_images/alpha.png", alt: "Alpha position pictograph" },
    beta: { src: "/images/position_images/beta.png", alt: "Beta position pictograph" },
    gamma: { src: "/images/position_images/gamma.png", alt: "Gamma position pictograph" },
  };

  const TITLE =
    "Flow Arts Glossary: The Kinetic Alphabet Lexicon | Every Term Defined";
  const DESCRIPTION =
    "Definitions for every term in The Kinetic Alphabet flow arts notation: positions (alpha, beta, gamma), letter types, motions, grid modes, and the notation vocabulary. The canonical lexicon.";
  const URL = "https://tkaflowarts.com/glossary";
  const LEXICON_ID = `${URL}#lexicon`;

  // schema.org graph: the page (CollectionPage) whose mainEntity is a
  // DefinedTermSet, one DefinedTerm per glossary entry (matches the visible
  // terms below), plus the breadcrumb trail. This is the entity/AEO payload —
  // it declares TKA the definitional source for its coined vocabulary.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": URL,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: "en-US",
        isPartOf: { "@type": "WebSite", url: "https://tkaflowarts.com/" },
        about: {
          "@type": "Thing",
          name: "The Kinetic Alphabet",
          alternateName: ["TKA", "Flow Arts Notation"],
        },
        mainEntity: { "@id": LEXICON_ID },
      },
      {
        "@type": "DefinedTermSet",
        "@id": LEXICON_ID,
        name: "The Kinetic Alphabet Lexicon",
        url: URL,
        description:
          "The controlled vocabulary of The Kinetic Alphabet, a notation system for flow arts choreography.",
        hasDefinedTerm: data.groups.flatMap((g) =>
          g.terms.map((t) => ({
            "@type": "DefinedTerm",
            "@id": `${URL}#${t.slug}`,
            name: t.term,
            description: t.definition,
            inDefinedTermSet: LEXICON_ID,
          }))
        ),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://tkaflowarts.com/" },
          { "@type": "ListItem", position: 2, name: "Glossary", item: URL },
        ],
      },
    ],
    // Escape "<" so a definition can't break out of the <script> element.
  }).replace(/</g, "\\u003c");
</script>

<svelte:head>
  <title>{TITLE}</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href={URL} />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content={URL} />
  <meta property="og:title" content={TITLE} />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tkaflowarts" />
  <meta name="twitter:title" content={TITLE} />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Flow Arts Glossary</h1>
    <p class="page-subtitle">The Kinetic Alphabet Lexicon</p>
  </header>

  <div class="lede">
    <p>
      Every term in The Kinetic Alphabet, defined: positions, letter types,
      motions, grid modes, and the notation vocabulary. The canonical reference
      for reading and writing flow arts choreography.
    </p>
    <p class="emphasis">{data.total} terms.</p>
  </div>

  <nav class="jump-nav" aria-label="Jump to category">
    {#each data.groups as g (g.key)}
      <a class="jump-chip" href={`#${g.sectionSlug}`}>{g.label}</a>
    {/each}
  </nav>

  {#each data.groups as g (g.key)}
    <section class="editorial-section" id={g.sectionSlug}>
      <span class="section-kicker">{g.label}</span>
      <dl class="term-list">
        {#each g.terms as t (t.slug)}
          {@const thumb = POSITION_THUMBS[t.slug]}
          <div class="term" class:has-thumb={thumb} id={t.slug}>
            <dt><dfn class="term-name">{t.term}</dfn></dt>
            <dd class="term-body">
              <p class="term-def">{t.definition}</p>
              {#if t.benefit}
                <p class="term-meta"><strong>Benefit:</strong> {t.benefit}</p>
              {/if}
              {#if t.importance}
                <p class="term-meta"><strong>Why it matters:</strong> {t.importance}</p>
              {/if}
              {#if t.examples.length}
                <ul class="term-examples">
                  {#each t.examples as ex (ex)}
                    <li>{ex}</li>
                  {/each}
                </ul>
              {/if}
              {#if t.related.length}
                <p class="term-related">
                  Related:
                  {#each t.related as r, i (r.slug)}<a href={`#${r.slug}`}>{r.term}</a>{#if i < t.related.length - 1}{", "}{/if}{/each}
                </p>
              {/if}
            </dd>
            {#if thumb}
              <div class="term-thumb">
                <img src={thumb.src} alt={thumb.alt} width="72" height="72" loading="lazy" />
              </div>
            {/if}
          </div>
        {/each}
      </dl>
    </section>
  {/each}

  <div class="cta-card">
    <h3>See the notation in motion</h3>
    <p>These terms come alive in the composer — build a sequence and watch it animate.</p>
    <a class="cta-button" href="/composer">Open the Composer <i class="fa-solid fa-arrow-right"></i></a>
  </div>

  <p class="creator-credit">
    A reference for <a href="/notation">Flow Arts Notation</a> ·
    <a href="/roots">Roots</a> · <a href="/guide">Guide</a>
  </p>
</div>

<style>
  /* ── category jump nav ── */
  .jump-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    justify-content: center;
    margin: 0 auto 3rem;
    max-width: 42rem;
  }
  .jump-chip {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
    font-weight: 550;
    color: oklch(0.9 0.015 270);
    text-decoration: none;
    background: oklch(0.2 0.02 270 / 0.4);
    border: 1px solid oklch(0.45 0.04 270 / 0.2);
    border-radius: 999px;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }
  .jump-chip:hover {
    transform: translateY(-1px);
    background: oklch(0.26 0.03 275 / 0.5);
    border-color: oklch(0.6 0.12 275 / 0.5);
  }

  /* ── term list ── */
  .term-list {
    margin: 0;
  }
  .term {
    padding: 1.25rem 0;
    border-top: 1px solid oklch(0.6 0.02 270 / 0.1);
    scroll-margin-top: 96px; /* clears the fixed SiteHeader on anchor jump */
  }
  .term:first-child {
    border-top: none;
  }

  /* Position terms (alpha/beta/gamma) get a fixed-size pictograph thumbnail
     to the right of the definition. Two-column grid, thumb spans both the
     dt and dd rows so it sits vertically centered against the term block. */
  .term.has-thumb {
    display: grid;
    grid-template-columns: 1fr 72px;
    column-gap: 1.25rem;
    align-items: start;
  }
  .term.has-thumb dt,
  .term.has-thumb dd {
    grid-column: 1;
  }
  .term-thumb {
    grid-column: 2;
    grid-row: 1 / span 2;
    width: 72px;
    height: 72px;
    flex-shrink: 0;
    background: #ffffff;
    border: 1px solid oklch(0.4 0.04 270 / 0.15);
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .term-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  dt {
    margin: 0 0 0.4rem;
  }
  .term-name {
    font-size: 1.2rem;
    font-weight: 680;
    font-style: normal; /* override <dfn> italics */
    letter-spacing: -0.01em;
    color: oklch(0.96 0.01 270);
  }
  dd {
    margin: 0;
  }
  .term-def {
    font-size: clamp(0.99rem, 0.95rem + 0.2vw, 1.1rem);
    line-height: 1.65;
    color: oklch(0.78 0.012 270);
    margin: 0 0 0.6rem;
  }
  .term-meta {
    font-size: 0.92rem;
    line-height: 1.55;
    color: oklch(0.72 0.012 270);
    margin: 0 0 0.5rem;
  }
  .term-meta strong {
    color: oklch(0.88 0.04 270);
    font-weight: 600;
  }
  .term-examples {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0.6rem;
  }
  .term-examples li {
    position: relative;
    padding-left: 1.2rem;
    margin-bottom: 0.3rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: oklch(0.68 0.015 270);
  }
  .term-examples li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.6em;
    width: 0.6rem;
    height: 2px;
    border-radius: 2px;
    background: oklch(0.6 0.13 275);
    opacity: 0.7;
  }
  .term-related {
    font-size: 0.85rem;
    color: oklch(0.62 0.02 270);
    margin: 0.5rem 0 0;
  }
  .term-related a {
    color: oklch(0.78 0.12 275);
    text-decoration: none;
    border-bottom: 1px solid oklch(0.78 0.12 275 / 0.3);
  }
  .term-related a:hover {
    color: oklch(0.9 0.06 275);
    border-bottom-color: oklch(0.78 0.12 275 / 0.8);
  }

  .creator-credit a {
    color: oklch(0.6 0.1 275);
    text-decoration: none;
  }
  .creator-credit a:hover {
    color: oklch(0.8 0.08 275);
  }
</style>

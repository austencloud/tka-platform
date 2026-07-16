<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";
  import GlossaryNav from "./_components/GlossaryNav.svelte";

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
  // Always built from the FULL data.groups, never the filtered view.
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

  // ── navigation state ──────────────────────────────────────────────────
  // The full lexicon prerenders into the HTML (query is "" at build), so the
  // filter and scroll-spy below are pure client-side enhancement — SEO sees
  // every term regardless.
  let query = $state("");
  let activeSlug = $state("");
  let drawerOpen = $state(false);
  let showBackTop = $state(false);
  let drawerCloseBtn: HTMLButtonElement | undefined = $state();

  type GlossaryTerm = (typeof data.groups)[number]["terms"][number];

  const normalizedQuery = $derived(query.trim().toLowerCase());
  const filtering = $derived(normalizedQuery.length > 0);

  function termMatches(t: GlossaryTerm, q: string): boolean {
    return (
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q) ||
      (t.benefit?.toLowerCase().includes(q) ?? false) ||
      (t.importance?.toLowerCase().includes(q) ?? false) ||
      t.examples.some((ex) => ex.toLowerCase().includes(q)) ||
      t.related.some((r) => r.term.toLowerCase().includes(q))
    );
  }

  const visibleGroups = $derived(
    !filtering
      ? data.groups
      : data.groups
          .map((g) => ({
            ...g,
            terms: g.terms.filter((t) => termMatches(t, normalizedQuery)),
          }))
          .filter((g) => g.terms.length > 0)
  );

  // ── scroll-spy ────────────────────────────────────────────────────────
  // Same mechanism as the guide's GuideSection: an IntersectionObserver band
  // near the top of the viewport marks the term being read. Rebuilt whenever
  // the filter changes the set of rendered terms.
  $effect(() => {
    void visibleGroups;
    const terms = Array.from(
      document.querySelectorAll<HTMLElement>(".term-list .term[id]")
    );
    if (!terms.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) activeSlug = entry.target.id;
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    terms.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });

  // Drawer: lock body scroll and move focus in while open.
  $effect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseBtn?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (drawerOpen) drawerOpen = false;
      return;
    }
    if (e.key !== "/") return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    // Focus whichever search box is rendered and visible at this breakpoint.
    const input = Array.from(
      document.querySelectorAll<HTMLInputElement>("input[data-glossary-search]")
    ).find((el) => el.offsetParent !== null);
    if (input) {
      e.preventDefault();
      input.focus();
    }
  }

  function backToTop() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  onscroll={() => (showBackTop = window.scrollY > 700)}
/>

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

<div class="glossary-shell">
  <!-- ── desktop sidebar: the whole lexicon, always in reach ── -->
  <aside class="glossary-sidebar" aria-label="Glossary navigation">
    <GlossaryNav
      groups={visibleGroups}
      total={data.total}
      bind:query
      {activeSlug}
    />
  </aside>

  <div class="editorial">
    <!-- ── mobile: sticky filter bar + Contents drawer trigger ── -->
    <div class="mobile-bar">
      <div class="mb-search">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input
          data-glossary-search
          type="search"
          placeholder="Filter terms"
          aria-label="Filter glossary terms"
          autocomplete="off"
          bind:value={query}
        />
        {#if filtering}
          <button
            type="button"
            class="mb-clear"
            aria-label="Clear filter"
            onclick={() => (query = "")}
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
      <button
        type="button"
        class="mb-contents"
        onclick={() => (drawerOpen = true)}
        aria-haspopup="dialog"
      >
        <i class="fa-solid fa-list" aria-hidden="true"></i>
        Contents
      </button>
    </div>

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

    {#if !filtering}
      <nav class="jump-nav" aria-label="Jump to category">
        {#each data.groups as g (g.key)}
          <a class="jump-chip" href={`#${g.sectionSlug}`}>{g.label}</a>
        {/each}
      </nav>
    {:else}
      <p class="filter-status" aria-live="polite">
        {visibleGroups.reduce((n, g) => n + g.terms.length, 0)} of {data.total}
        terms match "{query.trim()}".
      </p>
    {/if}

    {#each visibleGroups as g (g.key)}
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

    {#if filtering && visibleGroups.length === 0}
      <div class="no-results">
        <p>No terms match "{query.trim()}".</p>
        <button type="button" class="no-results-clear" onclick={() => (query = "")}>
          Clear filter
        </button>
      </div>
    {/if}

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
</div>

<!-- ── mobile Contents drawer ── -->
{#if drawerOpen}
  <div class="drawer" role="dialog" aria-modal="true" aria-label="Glossary contents">
    <div class="drawer-head">
      <span class="drawer-title">Contents</span>
      <button
        type="button"
        class="drawer-close"
        aria-label="Close contents"
        bind:this={drawerCloseBtn}
        onclick={() => (drawerOpen = false)}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
    <div class="drawer-body">
      <GlossaryNav
        groups={visibleGroups}
        total={data.total}
        bind:query
        {activeSlug}
        showSearch={false}
        onNavigate={() => (drawerOpen = false)}
      />
    </div>
  </div>
{/if}

{#if showBackTop && !drawerOpen}
  <button type="button" class="back-top" aria-label="Back to top" onclick={backToTop}>
    <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
  </button>
{/if}

<style>
  /* ── two-column shell: sidebar + editorial column on wide screens ── */
  .glossary-sidebar {
    display: none;
  }
  @media (min-width: 1024px) {
    .glossary-shell {
      display: grid;
      grid-template-columns: 17.5rem minmax(0, 1fr);
      column-gap: 1.5rem;
      max-width: 76rem;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    .glossary-sidebar {
      /* Sticky full-height rail. Its own 88px top padding clears the fixed
         SiteHeader, mirroring .editorial's top padding, so the nav and the
         article start at the same visual line. */
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 88px 0 1.25rem;
    }
    /* The sidebar owns navigation on desktop; the chip row is redundant. */
    .jump-nav {
      display: none;
    }
  }

  /* ── mobile sticky bar: filter + Contents ── */
  .mobile-bar {
    position: sticky;
    top: 56px; /* pins just under the condensed SiteHeader */
    z-index: 40;
    display: flex;
    gap: 0.6rem;
    margin: 0 -0.25rem 0.5rem;
    padding: 0.6rem 0.25rem;
    background: oklch(0.13 0.015 270 / 0.85);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid oklch(0.45 0.04 270 / 0.15);
  }
  @media (min-width: 1024px) {
    .mobile-bar {
      display: none;
    }
  }
  .mb-search {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }
  .mb-search > i {
    position: absolute;
    left: 0.85rem;
    font-size: 0.8rem;
    color: oklch(0.55 0.02 270);
    pointer-events: none;
  }
  .mb-search input {
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 2.6rem 0.5rem 2.35rem;
    font: inherit;
    font-size: 1rem; /* 16px floor keeps iOS from zooming the viewport */
    color: oklch(0.94 0.01 270);
    background: oklch(0.18 0.02 270 / 0.55);
    border: 1px solid oklch(0.45 0.04 270 / 0.25);
    border-radius: 12px;
    outline: none;
  }
  .mb-search input::placeholder {
    color: oklch(0.55 0.02 270);
  }
  .mb-search input:focus-visible {
    border-color: oklch(0.65 0.13 275 / 0.7);
  }
  .mb-search input::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }
  .mb-clear {
    all: unset;
    box-sizing: border-box;
    position: absolute;
    right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    color: oklch(0.65 0.02 270);
    cursor: pointer;
  }
  .mb-contents {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: oklch(0.9 0.015 270);
    background: oklch(0.24 0.03 272 / 0.5);
    border: 1px solid oklch(0.5 0.06 272 / 0.35);
    border-radius: 12px;
    cursor: pointer;
  }
  .mb-contents:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }

  .filter-status {
    margin: 0 auto 2.5rem;
    text-align: center;
    font-size: 0.95rem;
    color: oklch(0.72 0.015 270);
  }

  .no-results {
    text-align: center;
    padding: 2.5rem 0 1rem;
  }
  .no-results p {
    font-size: 1.05rem;
    color: oklch(0.72 0.015 270);
    margin: 0 0 1.2rem;
  }
  .no-results-clear {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 1.4rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: oklch(0.92 0.015 272);
    background: oklch(0.26 0.04 273 / 0.5);
    border: 1px solid oklch(0.55 0.09 273 / 0.4);
    border-radius: 999px;
    cursor: pointer;
  }
  .no-results-clear:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }

  /* ── mobile Contents drawer ── */
  .drawer {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    flex-direction: column;
    background: oklch(0.13 0.015 270 / 0.96);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    padding: 0.75rem 1.1rem calc(1rem + env(safe-area-inset-bottom));
  }
  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    margin-bottom: 0.5rem;
  }
  .drawer-title {
    font-size: 1.05rem;
    font-weight: 680;
    color: oklch(0.95 0.01 270);
  }
  .drawer-close {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    border-radius: 10px;
    font-size: 1.15rem;
    color: oklch(0.75 0.02 270);
    cursor: pointer;
  }
  .drawer-close:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: -2px;
  }
  .drawer-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* ── back to top ── */
  .back-top {
    all: unset;
    box-sizing: border-box;
    position: fixed;
    right: 1.25rem;
    bottom: calc(1.25rem + env(safe-area-inset-bottom));
    z-index: 60;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    color: oklch(0.9 0.015 270);
    background: oklch(0.22 0.03 272 / 0.75);
    border: 1px solid oklch(0.5 0.06 272 / 0.4);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    cursor: pointer;
    transition: background 160ms ease, transform 160ms ease;
  }
  .back-top:hover {
    background: oklch(0.28 0.05 273 / 0.85);
    transform: translateY(-2px);
  }
  .back-top:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }

  /* ── category jump nav (mobile / narrow only; sidebar owns it on desktop) ── */
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
  .editorial-section {
    scroll-margin-top: 120px; /* category anchors clear the header + mobile bar */
  }
  .term-list {
    margin: 0;
  }
  .term {
    padding: 1.25rem 0;
    border-top: 1px solid oklch(0.6 0.02 270 / 0.1);
    scroll-margin-top: 120px; /* clears the fixed SiteHeader + mobile bar on anchor jump */
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

  @media (prefers-reduced-motion: reduce) {
    .back-top,
    .jump-chip {
      transition: none;
    }
    .back-top:hover,
    .jump-chip:hover {
      transform: none;
    }
  }
</style>

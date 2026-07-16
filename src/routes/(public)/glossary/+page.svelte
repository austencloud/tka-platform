<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";
  import { onMount, tick } from "svelte";
  import GlossaryNav from "./_components/GlossaryNav.svelte";
  import GlossaryTermCard from "./_components/GlossaryTermCard.svelte";

  let { data } = $props();

  // Position-term slugs (from @tka/domain's GLOSSARY keys, see +page.server.ts)
  // that get a pictograph thumbnail in their card header. Fixed-size PNGs,
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
  // Drill-down views: "landing" (category cards) → one category → or "all"
  // (the full read-through document). EVERY term section stays in the DOM at
  // all times — views and search only toggle CSS visibility — so the
  // prerendered HTML (landing state) still carries all 110 definitions for
  // SEO, and the drill/filter/scroll-spy are pure client-side enhancement.
  let query = $state("");
  let view = $state("landing");
  let expanded = $state<Record<string, boolean>>({});
  let activeSlug = $state("");
  let drawerOpen = $state(false);
  let showBackTop = $state(false);
  let drawerCloseBtn: HTMLButtonElement | undefined = $state();

  type GlossaryTerm = (typeof data.groups)[number]["terms"][number];

  // Static lookups (the lexicon never changes at runtime).
  const slugToCat = new Map<string, string>(
    data.groups.flatMap((g) => g.terms.map((t) => [t.slug, g.key] as const))
  );
  const sectionSlugToKey = new Map<string, string>(
    data.groups.map((g) => [g.sectionSlug, g.key] as const)
  );

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

  // Search always looks everywhere, regardless of the current drill.
  const searchGroups = $derived(
    !filtering
      ? data.groups
      : data.groups
          .map((g) => ({
            ...g,
            terms: g.terms.filter((t) => termMatches(t, normalizedQuery)),
          }))
          .filter((g) => g.terms.length > 0)
  );
  const matchCount = $derived(
    filtering ? searchGroups.reduce((n, g) => n + g.terms.length, 0) : data.total
  );
  const matchSlugs = $derived(
    filtering
      ? new Set(searchGroups.flatMap((g) => g.terms.map((t) => t.slug)))
      : null
  );
  const matchedSections = $derived(
    filtering ? new Set<string>(searchGroups.map((g) => g.key)) : null
  );

  const landingShown = $derived(!filtering && view === "landing");

  function sectionShown(key: string): boolean {
    if (filtering) return matchedSections?.has(key) ?? false;
    return view === "all" || view === key;
  }

  // The sidebar always shows the FULL index (that's its job); it only narrows
  // under an active search.
  const sidebarGroups = $derived(filtering ? searchGroups : data.groups);

  // Expand-all operates on whatever the current view shows.
  const viewSlugs = $derived(
    view === "all"
      ? data.groups.flatMap((g) => g.terms.map((t) => t.slug))
      : (data.groups.find((g) => g.key === view)?.terms.map((t) => t.slug) ?? [])
  );
  const viewCount = $derived(viewSlugs.length);
  const anyOpen = $derived(viewSlugs.some((s) => Boolean(expanded[s])));

  function toggleTerm(slug: string) {
    expanded[slug] = !expanded[slug];
  }

  function toggleAll() {
    if (anyOpen) {
      expanded = {};
    } else {
      const next: Record<string, boolean> = { ...expanded };
      for (const s of viewSlugs) next[s] = true;
      expanded = next;
    }
  }

  /** Expand a term, make sure its category is on screen, and scroll to it.
   *  Used by sidebar term links, related-term links, and #hash deep links. */
  async function reveal(slug: string, e?: Event) {
    e?.preventDefault();
    if (!slugToCat.has(slug)) return;
    if (filtering) query = ""; // leave search mode; the target may not match it
    const cat = slugToCat.get(slug);
    if (cat && view !== "all" && view !== cat) view = cat;
    expanded[slug] = true;
    await tick();
    const el = document.getElementById(slug);
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${slug}`);
    activeSlug = slug;
  }

  /** Sidebar / drawer link handler: category headings drill, terms reveal. */
  async function handleNav(slug: string, e: MouseEvent) {
    drawerOpen = false;
    const catKey = sectionSlugToKey.get(slug);
    if (catKey) {
      e.preventDefault();
      if (filtering) query = "";
      view = catKey;
      await tick();
      document.getElementById(slug)?.scrollIntoView({ block: "start" });
      return;
    }
    await reveal(slug, e);
  }

  // #hash deep link on load (e.g. a related-term link shared externally):
  // expand the target card and scroll to it once hydrated. onMount, not
  // $effect - reveal() reads and writes reactive state, so an effect here
  // would re-fire on every search keystroke and yank the scroll position.
  onMount(() => {
    const slug = window.location.hash.slice(1);
    if (slug && slugToCat.has(slug)) void reveal(slug);
  });

  // ── scroll-spy ────────────────────────────────────────────────────────
  // Same mechanism as the guide's GuideSection: an IntersectionObserver band
  // near the top of the viewport marks the term being read. Rebuilt whenever
  // the drill or filter changes which cards are visible.
  $effect(() => {
    void view;
    void searchGroups;
    const terms = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".editorial-section:not(.sec-hidden) .card-slot:not(.hit-hidden) .term-card[id]"
      )
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
      groups={sidebarGroups}
      total={data.total}
      bind:query
      {activeSlug}
      onNavigate={handleNav}
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
      <p>Every term in The Kinetic Alphabet, defined. Pick a category or search.</p>
    </div>

    {#if filtering}
      <p class="filter-status" aria-live="polite">
        {matchCount} of {data.total} terms match "{query.trim()}".
      </p>
    {:else if view !== "landing"}
      <div class="view-head">
        <button type="button" class="back-btn" onclick={() => (view = "landing")}>
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          Categories
        </button>
        <span class="view-count">{viewCount} terms</span>
        <button type="button" class="expand-toggle" onclick={toggleAll}>
          {anyOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>
    {/if}

    {#if landingShown}
      <nav class="cat-cards" aria-label="Browse by category">
        {#each data.groups as g (g.key)}
          <button type="button" class="cat-card" onclick={() => (view = g.key)}>
            <span class="cc-top">
              <span class="cc-label">{g.label}</span>
              <span class="cc-count">{g.terms.length}</span>
            </span>
            <span class="cc-sample">
              {g.terms.slice(0, 3).map((t) => t.term).join(" · ")}
            </span>
            <i class="fa-solid fa-arrow-right cc-arrow" aria-hidden="true"></i>
          </button>
        {/each}
      </nav>
      <div class="landing-all">
        <button type="button" class="browse-all" onclick={() => (view = "all")}>
          Browse all {data.total} terms
        </button>
      </div>
    {/if}

    {#each data.groups as g (g.key)}
      <section
        class="editorial-section"
        class:sec-hidden={!sectionShown(g.key)}
        id={g.sectionSlug}
      >
        <span class="section-kicker">{g.label}</span>
        <div class="term-grid">
          {#each g.terms as t (t.slug)}
            {@const open = Boolean(expanded[t.slug]) || filtering}
            <div
              class="card-slot"
              class:hit-hidden={matchSlugs !== null && !matchSlugs.has(t.slug)}
              class:open-slot={open}
            >
              <GlossaryTermCard
                entry={t}
                {open}
                thumb={POSITION_THUMBS[t.slug] ?? null}
                ontoggle={() => toggleTerm(t.slug)}
                onrelated={(slug, e) => reveal(slug, e)}
              />
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if filtering && matchCount === 0}
      <div class="no-results">
        <p>No terms match "{query.trim()}".</p>
        <button type="button" class="no-results-clear" onclick={() => (query = "")}>
          Clear filter
        </button>
      </div>
    {/if}

    <div class="cta-card">
      <h3>See the notation in motion</h3>
      <p>These terms come alive in the composer. Build a sequence and watch it animate.</p>
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
        groups={sidebarGroups}
        total={data.total}
        bind:query
        {activeSlug}
        showSearch={false}
        onNavigate={handleNav}
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
  /* ── two-column shell: sidebar + full-width article on wide screens ──
     The editorial column drops its 46rem cap inside this shell: the term
     and category grids are responsive multi-column and are MEANT to use
     the full viewport (4K included). Prose measures are capped per-element
     (lede, expanded card text, CTA) instead of capping the whole column. */
  .glossary-sidebar {
    display: none;
  }
  @media (min-width: 1024px) {
    .glossary-shell {
      display: grid;
      grid-template-columns: 18rem minmax(0, 1fr);
      column-gap: 2rem;
      padding: 0 2rem;
    }
    .glossary-shell .editorial {
      max-width: none;
      width: 100%;
      padding-left: 0;
      padding-right: 0;
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
    .cta-card {
      max-width: 46rem;
      margin-left: auto;
      margin-right: auto;
    }
  }
  /* 4K / ultrawide: wider rail, larger type, same fluid grids. */
  @media (min-width: 2200px) {
    .glossary-shell {
      grid-template-columns: 24rem minmax(0, 1fr);
      column-gap: 3rem;
      padding: 0 3rem;
    }
    .cta-card {
      max-width: 60rem;
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

  /* ── landing: category cards ── */
  .cat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.9rem;
    margin: 0 0 1.5rem;
  }
  .cat-card {
    all: unset;
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-height: 44px;
    padding: 1.1rem 3rem 1.1rem 1.2rem;
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    border-radius: 16px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
  }
  .cat-card:hover {
    background: oklch(0.19 0.025 272 / 0.55);
    border-color: oklch(0.6 0.11 275 / 0.45);
    transform: translateY(-2px);
  }
  .cat-card:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }
  .cc-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.6rem;
  }
  .cc-label {
    font-size: 1.05rem;
    font-weight: 660;
    letter-spacing: -0.01em;
    color: oklch(0.96 0.01 270);
  }
  .cc-count {
    font-size: 0.78rem;
    font-weight: 550;
    font-variant-numeric: tabular-nums;
    color: oklch(0.72 0.08 274);
    background: oklch(0.3 0.06 274 / 0.35);
    border-radius: 999px;
    padding: 0.1rem 0.55rem;
  }
  .cc-sample {
    font-size: 0.85rem;
    line-height: 1.5;
    color: oklch(0.65 0.015 270);
  }
  .cc-arrow {
    position: absolute;
    right: 1.1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.85rem;
    color: oklch(0.55 0.06 274);
    transition: transform 160ms ease, color 160ms ease;
  }
  .cat-card:hover .cc-arrow {
    color: oklch(0.8 0.12 275);
    transform: translateY(-50%) translateX(3px);
  }
  .landing-all {
    text-align: center;
    margin: 0 0 3rem;
  }
  .browse-all {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 1.4rem;
    font-size: 0.92rem;
    font-weight: 550;
    color: oklch(0.78 0.05 273);
    border: 1px solid oklch(0.5 0.07 273 / 0.35);
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
  }
  .browse-all:hover {
    color: oklch(0.92 0.04 274);
    border-color: oklch(0.6 0.11 274 / 0.6);
  }
  .browse-all:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }

  /* ── drilled view header: back + count + expand toggle ── */
  .view-head {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    margin: 0 0 1.75rem;
  }
  .back-btn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0 1.1rem;
    font-size: 0.88rem;
    font-weight: 600;
    color: oklch(0.9 0.015 270);
    background: oklch(0.24 0.03 272 / 0.5);
    border: 1px solid oklch(0.5 0.06 272 / 0.35);
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .back-btn:hover {
    background: oklch(0.28 0.05 273 / 0.6);
    border-color: oklch(0.6 0.11 274 / 0.6);
  }
  .back-btn:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }
  .view-count {
    flex: 1;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: oklch(0.62 0.02 270);
  }
  .expand-toggle {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    min-width: 8.25rem; /* fits "Collapse all" so the label swap never shifts layout */
    padding: 0 1rem;
    font-size: 0.85rem;
    font-weight: 550;
    color: oklch(0.78 0.05 273);
    border: 1px solid oklch(0.5 0.07 273 / 0.35);
    border-radius: 999px;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease;
  }
  .expand-toggle:hover {
    color: oklch(0.92 0.04 274);
    border-color: oklch(0.6 0.11 274 / 0.6);
  }
  .expand-toggle:focus-visible {
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

  /* ── term sections ── */
  .editorial-section {
    scroll-margin-top: 120px; /* category anchors clear the header + mobile bar */
  }
  .sec-hidden {
    display: none;
  }
  .term-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    align-items: start;
  }
  .card-slot {
    min-width: 0;
  }
  .card-slot.open-slot {
    grid-column: 1 / -1;
  }
  .card-slot.hit-hidden {
    display: none;
  }

  .creator-credit a {
    color: oklch(0.6 0.1 275);
    text-decoration: none;
  }
  .creator-credit a:hover {
    color: oklch(0.8 0.08 275);
  }

  /* ── tiny screens (iPhone SE class, ≤400px) ── */
  @media (max-width: 400px) {
    .glossary-shell .editorial {
      padding-left: 0.85rem;
      padding-right: 0.85rem;
    }
    .mobile-bar {
      gap: 0.45rem;
    }
    .mb-contents {
      padding: 0 0.8rem;
    }
    .cat-card {
      padding: 0.95rem 2.6rem 0.95rem 1rem;
    }
    .view-head {
      flex-wrap: wrap;
      gap: 0.6rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .back-top,
    .cat-card,
    .cc-arrow,
    .back-btn,
    .browse-all,
    .expand-toggle {
      transition: none;
    }
    .back-top:hover,
    .cat-card:hover {
      transform: none;
    }
    .cat-card:hover .cc-arrow {
      transform: translateY(-50%);
    }
  }
</style>

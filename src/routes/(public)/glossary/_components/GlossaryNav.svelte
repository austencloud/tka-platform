<script lang="ts">
  /**
   * The glossary's contents panel - the same job GuideSidebar does for the
   * guide, adapted to a lexicon: an optional filter box, every term grouped
   * by category, and live highlighting of the term currently being read
   * (scroll-spy signal supplied by the page). Hosted twice by +page.svelte:
   * in the desktop sticky sidebar and inside the mobile Contents drawer
   * (drawer hides the search box because the sticky mobile bar already has
   * one bound to the same query).
   */
  type NavTerm = { term: string; slug: string };
  type NavGroup = {
    key: string;
    label: string;
    sectionSlug: string;
    terms: NavTerm[];
  };

  let {
    groups,
    total,
    query = $bindable(""),
    activeSlug = "",
    showSearch = true,
    onNavigate,
  }: {
    /** Already-filtered groups (the page owns the filtering). */
    groups: NavGroup[];
    /** Unfiltered term count, for the "N of M" line while filtering. */
    total: number;
    query?: string;
    activeSlug?: string;
    showSearch?: boolean;
    /** Fired when any link is activated (term slug or `cat-*` section slug).
     *  The host owns what happens: reveal the term / drill the category /
     *  close the drawer. It may preventDefault the anchor jump. */
    onNavigate?: (slug: string, e: MouseEvent) => void;
  } = $props();

  const shown = $derived(groups.reduce((n, g) => n + g.terms.length, 0));
  const filtering = $derived(query.trim().length > 0);

  let listEl: HTMLElement | undefined = $state();

  // Keep the active term's link in view as the reader scrolls the article.
  // 'nearest' means no movement at all while the link is already visible,
  // so this never fights a reader who is scrolling the nav itself.
  $effect(() => {
    if (!activeSlug || !listEl) return;
    listEl
      .querySelector(`a[data-slug="${CSS.escape(activeSlug)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
</script>

<div class="gnav">
  {#if showSearch}
    <div class="gnav-search">
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
          class="gnav-clear"
          aria-label="Clear filter"
          onclick={() => (query = "")}
        >
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      {/if}
    </div>
  {/if}

  <p class="gnav-count" aria-live="polite">
    {#if filtering}{shown} of {total} terms{:else}{total} terms{/if}
  </p>

  <nav class="gnav-list" aria-label="Glossary contents" bind:this={listEl}>
    {#each groups as g (g.key)}
      {@const groupActive = g.terms.some((t) => t.slug === activeSlug)}
      <div class="gnav-group">
        <a
          class="gnav-heading"
          class:active={groupActive}
          href={`#${g.sectionSlug}`}
          onclick={(e) => onNavigate?.(g.sectionSlug, e)}
        >
          <span>{g.label}</span>
          <span class="gnav-n">{g.terms.length}</span>
        </a>
        <ul>
          {#each g.terms as t (t.slug)}
            <li>
              <a
                data-slug={t.slug}
                class:active={t.slug === activeSlug}
                aria-current={t.slug === activeSlug ? "location" : undefined}
                href={`#${t.slug}`}
                onclick={(e) => onNavigate?.(t.slug, e)}
              >
                {t.term}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
    {#if !groups.length}
      <p class="gnav-empty">No terms match "{query.trim()}".</p>
    {/if}
  </nav>
</div>

<style>
  .gnav {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    font-family: "Inter", system-ui, sans-serif;
  }

  /* ── filter box ── */
  .gnav-search {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .gnav-search > i {
    position: absolute;
    left: 0.85rem;
    font-size: 0.8rem;
    color: oklch(0.55 0.02 270);
    pointer-events: none;
  }
  .gnav-search input {
    width: 100%;
    min-height: 44px;
    padding: 0.55rem 2.6rem 0.55rem 2.35rem;
    font: inherit;
    font-size: 0.95rem;
    color: oklch(0.94 0.01 270);
    background: oklch(0.18 0.02 270 / 0.55);
    border: 1px solid oklch(0.45 0.04 270 / 0.25);
    border-radius: 12px;
    outline: none;
    transition: border-color 160ms ease, background 160ms ease;
  }
  .gnav-search input::placeholder {
    color: oklch(0.55 0.02 270);
  }
  .gnav-search input:focus-visible {
    border-color: oklch(0.65 0.13 275 / 0.7);
    background: oklch(0.2 0.025 272 / 0.6);
  }
  /* Hide the native WebKit clear control; the button below replaces it. */
  .gnav-search input::-webkit-search-cancel-button {
    -webkit-appearance: none;
    appearance: none;
  }
  .gnav-clear {
    all: unset;
    box-sizing: border-box;
    position: absolute;
    right: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    border-radius: 10px;
    color: oklch(0.65 0.02 270);
    cursor: pointer;
  }
  .gnav-clear:hover {
    color: oklch(0.9 0.02 270);
  }
  .gnav-clear:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: -4px;
  }

  .gnav-count {
    flex-shrink: 0;
    margin: 0.6rem 0.15rem 0.5rem;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: oklch(0.55 0.02 270);
  }

  /* ── term list ── */
  .gnav-list {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 0.35rem;
    scrollbar-width: thin;
    scrollbar-color: oklch(0.4 0.03 270 / 0.5) transparent;
  }
  .gnav-list::-webkit-scrollbar {
    width: 6px;
  }
  .gnav-list::-webkit-scrollbar-thumb {
    background: oklch(0.4 0.03 270 / 0.5);
    border-radius: 3px;
  }

  .gnav-group {
    margin-bottom: 0.85rem;
  }
  .gnav-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 640;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: oklch(0.6 0.03 270);
    text-decoration: none;
    border-radius: 8px;
    transition: color 160ms ease;
  }
  .gnav-heading:hover {
    color: oklch(0.85 0.04 272);
  }
  .gnav-heading.active {
    color: oklch(0.8 0.12 275);
  }
  .gnav-n {
    font-weight: 500;
    letter-spacing: 0;
    color: oklch(0.5 0.02 270);
  }

  .gnav-group ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .gnav-group li a {
    position: relative;
    display: block;
    padding: 0.42rem 0.65rem 0.42rem 1rem;
    font-size: 0.875rem;
    line-height: 1.35;
    color: oklch(0.72 0.015 270);
    text-decoration: none;
    border-left: 2px solid oklch(0.45 0.04 270 / 0.18);
    border-radius: 0 8px 8px 0;
    transition: color 140ms ease, background 140ms ease, border-color 140ms ease;
  }
  .gnav-group li a:hover {
    color: oklch(0.94 0.01 270);
    background: oklch(0.24 0.03 272 / 0.35);
  }
  .gnav-group li a.active {
    color: oklch(0.95 0.03 275);
    background: oklch(0.28 0.05 275 / 0.35);
    border-left-color: oklch(0.7 0.14 275);
  }
  .gnav-group li a:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: -2px;
  }

  .gnav-empty {
    margin: 0.75rem 0.15rem;
    font-size: 0.9rem;
    color: oklch(0.62 0.02 270);
  }

  /* 4K / ultrawide: match public-editorial's 2200px type scale. */
  @media (min-width: 2200px) {
    .gnav-search input {
      font-size: 1.1rem;
    }
    .gnav-count {
      font-size: 0.9rem;
    }
    .gnav-heading {
      font-size: 0.9rem;
    }
    .gnav-group li a {
      font-size: 1.05rem;
    }
    .gnav-empty {
      font-size: 1.05rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gnav-search input,
    .gnav-heading,
    .gnav-group li a {
      transition: none;
    }
  }
</style>

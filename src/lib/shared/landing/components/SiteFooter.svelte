<script lang="ts">
  /**
   * SiteFooter — the public site's sitemap footer, rendered once by
   * MarketingChrome (persistent chrome, outside the route crossfade — same
   * treatment as SiteHeader) and by the guide subtree layouts. Replaces the
   * old LandingFooter, which each page had to remember to import; pages kept
   * shipping without it (composer, the whole /shop subtree). Every column
   * link is a page that previously had thin or no global-nav inbound links.
   *
   * Terms/Privacy keep LandingFooter's behavior: on narrow viewports they
   * open the in-place LegalSheet instead of navigating.
   */
  import LegalSheet from "$lib/shared/legal/components/LegalSheet.svelte";

  let sheetOpen = $state(false);
  let sheetType = $state<"terms" | "privacy">("terms");

  const MOBILE_BREAKPOINT = 768;

  function handleLegalClick(e: MouseEvent, type: "terms" | "privacy") {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      e.preventDefault();
      sheetType = type;
      sheetOpen = true;
    }
  }

  interface FooterColumn {
    title: string;
    links: { label: string; href: string }[];
  }

  const COLUMNS: FooterColumn[] = [
    {
      title: "Explore",
      links: [
        { label: "Notation", href: "/notation" },
        { label: "Composer", href: "/composer" },
        { label: "About", href: "/about" },
        { label: "Endless LOOPs", href: "/endless-spinner" },
      ],
    },
    {
      title: "Learn",
      links: [
        { label: "Guide", href: "/guide" },
        { label: "Glossary", href: "/glossary" },
        { label: "FAQ", href: "/faq" },
        {
          label: "Staff Choreography",
          href: "/learn/staff-spinning-choreography",
        },
        { label: "Double Staff Codex", href: "/guide/codex" },
      ],
    },
    {
      title: "Props",
      links: [
        { label: "Double Staves", href: "/notation/staves" },
        { label: "Clubs", href: "/notation/clubs" },
        { label: "Fans", href: "/notation/fans" },
        { label: "Buugeng", href: "/notation/buugeng" },
        { label: "Poi", href: "/notation/poi" },
      ],
    },
    {
      title: "Shop",
      links: [
        { label: "How Choreo Cards Work", href: "/shop/choreography-cards" },
        { label: "LOOP Deck", href: "/shop/loop-deck" },
        { label: "T&D Trilogy", href: "/shop/tnd-trilogy" },
        { label: "Starter Pack", href: "/shop/starter-pack" },
        { label: "Browse the Shop", href: "/shop" },
      ],
    },
  ];

  const year = new Date().getFullYear();
</script>

<footer class="site-footer">
  <div class="inner">
    <div class="cols">
      <div class="brand">
        <a href="/" class="wordmark" aria-label="The Kinetic Alphabet, Home"
          >TKA</a
        >
        <p class="tagline">Notation for flow arts.</p>
        <a class="composer-cta" href="/create" data-sveltekit-reload>
          <i class="fas fa-rocket" aria-hidden="true"></i>
          Open Flow Arts Composer
        </a>
      </div>

      {#each COLUMNS as col}
        <nav class="col" aria-label="{col.title} links">
          <h2 class="col-title">{col.title}</h2>
          <ul>
            {#each col.links as link}
              <li><a href={link.href}>{link.label}</a></li>
            {/each}
          </ul>
        </nav>
      {/each}
    </div>

    <div class="bottom">
      <p class="legal-line">
        © {year} The Kinetic Alphabet · Made by Austen Cloud
      </p>
      <nav class="bottom-links" aria-label="Support and legal links">
        <a href="/support"
          ><i class="fas fa-heart heart" aria-hidden="true"></i> Support</a
        >
        <a href="/create?sheet=auth" data-sveltekit-reload>Sign in</a>
        <a href="/terms" onclick={(e) => handleLegalClick(e, "terms")}>Terms</a>
        <a href="/privacy" onclick={(e) => handleLegalClick(e, "privacy")}
          >Privacy</a
        >
      </nav>
    </div>
  </div>
</footer>

<LegalSheet
  isOpen={sheetOpen}
  type={sheetType}
  onClose={() => (sheetOpen = false)}
/>

<style>
  .site-footer {
    position: relative;
    margin-top: 72px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    /* Quiet grounding gradient so the columns read over any cosmic-canvas
       brightness without a hard panel edge. */
    background: linear-gradient(
      180deg,
      rgba(8, 8, 20, 0.1),
      rgba(8, 8, 20, 0.55)
    );
  }

  .inner {
    /* Same band as SiteHeader's .inner so the chrome edges align. */
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
    padding: 48px 1.4rem 28px;
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr;
    gap: 40px;
  }

  .brand {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .wordmark {
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-size: 1.6rem;
    letter-spacing: 0.04em;
    text-decoration: none;
    background: linear-gradient(135deg, #6f8cff, #c0a3ff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .tagline {
    margin: 0;
    font-size: 0.92rem;
    color: #9b97bd;
  }
  .composer-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    padding: 10px 18px;
    border-radius: 999px;
    border: 1px solid rgba(176, 163, 255, 0.4);
    color: #d7d4ea;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      color 0.2s ease;
  }
  .composer-cta:hover,
  .composer-cta:focus-visible {
    border-color: rgba(176, 163, 255, 0.8);
    background: rgba(139, 108, 255, 0.14);
    color: #fff;
    outline: none;
  }
  .composer-cta i {
    color: #b8a6ff;
    font-size: 0.85rem;
  }

  .col-title {
    margin: 0 0 12px;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8f8bb0;
  }
  .col ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .col a {
    display: inline-block;
    padding: 7px 0;
    color: #b9b6cf;
    text-decoration: none;
    font-size: 0.92rem;
    transition: color 0.2s ease;
  }
  .col a:hover,
  .col a:focus-visible {
    color: #fff;
    outline: none;
  }

  .bottom {
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    gap: 16px;
    margin-top: 44px;
    padding-top: 22px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .legal-line {
    margin: 0;
    font-size: 0.875rem;
    color: #7d7999;
    text-align: center;
  }
  .bottom-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 26px;
  }
  .bottom-links a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    color: #9b97bd;
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.2s ease;
  }
  .bottom-links a:hover,
  .bottom-links a:focus-visible {
    color: #fff;
    outline: none;
  }
  .heart {
    font-size: 0.8rem;
    color: #ff8a9d;
  }

  /* ≥560px: the four link columns form a 2×2 grid under the brand block. */
  @media (min-width: 560px) {
    .cols {
      grid-template-columns: repeat(2, 1fr);
    }
    .brand {
      grid-column: 1 / -1;
    }
  }

  /* ≥820px: all four link columns in one row under the brand. */
  @media (min-width: 820px) {
    .cols {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* ≥1024px: brand joins the row; bottom bar splits left/right. */
  @media (min-width: 1024px) {
    .cols {
      grid-template-columns: 1.6fr repeat(4, 1fr);
      gap: clamp(32px, 3.5vw, 84px);
    }
    .brand {
      grid-column: auto;
    }
    .bottom {
      flex-direction: row;
      justify-content: space-between;
    }
    .legal-line {
      text-align: left;
    }
  }

  /* Big-screen tier: one type step up so the footer doesn't read miniature.
     1680, not 2200 — a 4K monitor at 200% OS scaling reports ~1920 CSS px, so
     the old 2200 query never fired on the primary target display. */
  @media (min-width: 1680px) {
    .col a,
    .tagline {
      font-size: 1.05rem;
    }
    .col-title {
      font-size: 0.9rem;
    }
    .legal-line,
    .bottom-links a {
      font-size: 1rem;
    }
    .composer-cta {
      font-size: 1rem;
      padding: 12px 22px;
    }
    .wordmark {
      font-size: 1.9rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .col a,
    .bottom-links a,
    .composer-cta {
      transition: none;
    }
  }
</style>

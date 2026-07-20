<script lang="ts">
  /**
   * The full entry for one glossary term - the "detail" half of the lexicon's
   * master-detail layout. Rendered twice by +page.svelte: in the desktop
   * sticky detail panel (for the selected term) and inside each mobile
   * accordion row body (always in the DOM, so the prerendered HTML keeps
   * every definition crawlable).
   */
  type RelatedRef = { term: string; slug: string };
  type TermEntry = {
    term: string;
    slug: string;
    definition: string;
    examples: string[];
    related: RelatedRef[];
    benefit: string | null;
    importance: string | null;
  };

  let {
    entry,
    thumb = null,
    showTitle = true,
    onrelated,
  }: {
    entry: TermEntry;
    thumb?: { src: string; alt: string } | null;
    /** The mobile accordion row already shows the name; the detail panel needs it. */
    showTitle?: boolean;
    /** Related-term chip click - the page reveals (selects + scrolls to) the target. */
    onrelated: (slug: string, e: MouseEvent) => void;
  } = $props();
</script>

<article class="term-detail">
  {#if showTitle}
    <header class="td-head">
      <h3 class="td-name">{entry.term}</h3>
      {#if thumb}
        <img
          class="td-thumb"
          src={thumb.src}
          alt={thumb.alt}
          width="64"
          height="64"
          loading="lazy"
        />
      {/if}
    </header>
  {/if}

  <p class="td-def">{entry.definition}</p>

  {#if entry.benefit}
    <p class="td-meta"><strong>Benefit:</strong> {entry.benefit}</p>
  {/if}
  {#if entry.importance}
    <p class="td-meta"><strong>Why it matters:</strong> {entry.importance}</p>
  {/if}

  {#if entry.examples.length}
    <ul class="td-examples">
      {#each entry.examples as ex (ex)}
        <li>{ex}</li>
      {/each}
    </ul>
  {/if}

  {#if entry.related.length}
    <div class="td-related">
      <span class="td-related-label">Related</span>
      <div class="td-chips">
        {#each entry.related as r (r.slug)}
          <a class="td-chip" href={`#${r.slug}`} onclick={(e) => onrelated(r.slug, e)}>
            {r.term}
          </a>
        {/each}
      </div>
    </div>
  {/if}
</article>

<style>
  .term-detail {
    min-width: 0;
  }

  .td-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin: 0 0 0.9rem;
  }
  .td-name {
    font-size: clamp(1.35rem, 1.2rem + 0.5vw, 1.7rem);
    font-weight: 680;
    letter-spacing: -0.015em;
    line-height: 1.15;
    text-wrap: balance;
    color: oklch(0.97 0.01 270);
    margin: 0;
  }
  .td-thumb {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    background: #ffffff;
    border: 1px solid oklch(0.4 0.04 270 / 0.15);
    border-radius: 10px;
    object-fit: contain;
  }

  .td-def {
    font-size: 1rem;
    line-height: 1.7;
    text-wrap: pretty;
    color: oklch(0.8 0.012 270);
    margin: 0 0 0.9rem;
  }

  .td-meta {
    font-size: 0.92rem;
    line-height: 1.6;
    text-wrap: pretty;
    color: oklch(0.73 0.012 270);
    margin: 0 0 0.6rem;
  }
  .td-meta strong {
    color: oklch(0.88 0.04 270);
    font-weight: 600;
  }

  .td-examples {
    list-style: none;
    padding: 0;
    margin: 0.9rem 0;
  }
  .td-examples li {
    position: relative;
    padding-left: 1.2rem;
    margin-bottom: 0.4rem;
    font-size: 0.9rem;
    line-height: 1.55;
    text-wrap: pretty;
    color: oklch(0.7 0.015 270);
  }
  .td-examples li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.62em;
    width: 0.6rem;
    height: 2px;
    border-radius: 2px;
    background: oklch(0.6 0.13 275);
    opacity: 0.7;
  }

  .td-related {
    margin-top: 1.1rem;
    padding-top: 0.9rem;
    border-top: 1px solid oklch(0.5 0.03 270 / 0.14);
  }
  .td-related-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 640;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: oklch(0.58 0.03 272);
    margin: 0 0 0.55rem;
  }
  .td-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .td-chip {
    display: inline-flex;
    align-items: center;
    min-height: 34px;
    padding: 0.25rem 0.8rem;
    font-size: 0.83rem;
    font-weight: 550;
    color: oklch(0.87 0.05 274);
    text-decoration: none;
    background: oklch(0.26 0.04 274 / 0.4);
    border: 1px solid oklch(0.55 0.08 274 / 0.35);
    border-radius: 999px;
    transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
  }
  .td-chip:hover {
    color: oklch(0.97 0.02 275);
    background: oklch(0.32 0.06 275 / 0.55);
    border-color: oklch(0.65 0.13 275 / 0.6);
  }
  .td-chip:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: 2px;
  }

  /* Big-screen tier: 1680, the site-wide seam (public-editorial.css). The old
     2200 query never fired on a 4K monitor at 200% scaling (~1920px CSS). */
  @media (min-width: 1680px) {
    .td-name {
      font-size: 2rem;
    }
    .td-def {
      font-size: 1.2rem;
    }
    .td-meta {
      font-size: 1.05rem;
    }
    .td-examples li {
      font-size: 1.05rem;
    }
    .td-chip {
      font-size: 0.95rem;
      min-height: 40px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .td-chip {
      transition: none;
    }
  }
</style>

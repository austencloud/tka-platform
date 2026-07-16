<script lang="ts">
  /**
   * One glossary entry as an expandable card - the drill-down unit of the
   * lexicon explorer. Collapsed: term name + two-line definition teaser.
   * Expanded: the full entry (definition, benefit, importance, examples,
   * related links). The full text is ALWAYS in the DOM (the collapse is a
   * 0fr grid row + a CSS line clamp), so the prerendered HTML keeps every
   * definition crawlable. ARIA accordion pattern: heading > button with
   * aria-expanded / aria-controls.
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
    open,
    thumb = null,
    ontoggle,
    onrelated,
  }: {
    entry: TermEntry;
    open: boolean;
    thumb?: { src: string; alt: string } | null;
    ontoggle: () => void;
    /** Related-term click - the page reveals (expands + scrolls to) the target. */
    onrelated: (slug: string, e: MouseEvent) => void;
  } = $props();

  const bodyId = $derived(`${entry.slug}-body`);
  const hasMore = $derived(
    Boolean(
      entry.benefit ||
        entry.importance ||
        entry.examples.length ||
        entry.related.length
    )
  );
</script>

<article class="term-card" class:open id={entry.slug}>
  <h3 class="card-heading">
    <button
      type="button"
      class="card-toggle"
      aria-expanded={open}
      aria-controls={bodyId}
      onclick={ontoggle}
    >
      {#if thumb}
        <img
          class="card-thumb"
          src={thumb.src}
          alt={thumb.alt}
          width="40"
          height="40"
          loading="lazy"
        />
      {/if}
      <dfn class="term-name">{entry.term}</dfn>
      <i class="fa-solid fa-chevron-down card-chevron" aria-hidden="true"></i>
    </button>
  </h3>

  <div class="card-body" id={bodyId}>
    <p class="card-def" class:clamped={!open}>{entry.definition}</p>

    {#if hasMore}
      <div class="card-more" class:open>
        <div class="card-more-inner">
          {#if entry.benefit}
            <p class="term-meta"><strong>Benefit:</strong> {entry.benefit}</p>
          {/if}
          {#if entry.importance}
            <p class="term-meta"><strong>Why it matters:</strong> {entry.importance}</p>
          {/if}
          {#if entry.examples.length}
            <ul class="term-examples">
              {#each entry.examples as ex (ex)}
                <li>{ex}</li>
              {/each}
            </ul>
          {/if}
          {#if entry.related.length}
            <p class="term-related">
              Related:
              {#each entry.related as r, i (r.slug)}<a
                  href={`#${r.slug}`}
                  onclick={(e) => onrelated(r.slug, e)}>{r.term}</a
                >{#if i < entry.related.length - 1}{", "}{/if}{/each}
            </p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</article>

<style>
  .term-card {
    background: oklch(0.16 0.018 270 / 0.45);
    border: 1px solid oklch(0.4 0.04 270 / 0.14);
    border-radius: 14px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    scroll-margin-top: 130px; /* deep links clear the header + mobile bar */
    transition: border-color 160ms ease, background 160ms ease;
  }
  .term-card:hover {
    border-color: oklch(0.55 0.08 273 / 0.4);
  }
  /* The host's .card-slot wrapper owns grid placement (full-row span when
     open); the card itself only changes its surface treatment. */
  .term-card.open {
    background: oklch(0.17 0.02 271 / 0.55);
    border-color: oklch(0.6 0.11 275 / 0.45);
  }

  .card-heading {
    margin: 0;
  }
  .card-toggle {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    min-height: 44px;
    padding: 0.8rem 1rem;
    cursor: pointer;
    border-radius: 14px;
  }
  .card-toggle:focus-visible {
    outline: 2px solid oklch(0.65 0.13 275);
    outline-offset: -2px;
  }

  .card-thumb {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    background: #ffffff;
    border: 1px solid oklch(0.4 0.04 270 / 0.15);
    border-radius: 8px;
    object-fit: contain;
  }

  .term-name {
    font-size: 1.05rem;
    font-weight: 660;
    font-style: normal; /* override <dfn> italics */
    letter-spacing: -0.01em;
    line-height: 1.3;
    color: oklch(0.96 0.01 270);
  }

  .card-chevron {
    margin-left: auto;
    flex-shrink: 0;
    font-size: 0.75rem;
    color: oklch(0.55 0.03 270);
    transition: transform 200ms ease, color 160ms ease;
  }
  .term-card.open .card-chevron {
    transform: rotate(180deg);
    color: oklch(0.75 0.1 275);
  }

  .card-body {
    padding: 0 1rem 0.9rem;
    /* Expanded cards span the full grid row; cap the measure so definitions
       stay readable on ultrawide screens instead of running 3000px lines. */
    max-width: 74ch;
  }
  .card-def {
    font-size: 0.96rem;
    line-height: 1.6;
    color: oklch(0.76 0.012 270);
    margin: 0;
  }
  .card-def.clamped {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Collapsible extras: the 0fr -> 1fr grid-row trick animates height while
     keeping the content in the DOM (crawlable) at all times. */
  .card-more {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 220ms ease;
  }
  .card-more.open {
    grid-template-rows: 1fr;
  }
  .card-more-inner {
    overflow: hidden;
    min-height: 0;
  }
  .card-more.open .card-more-inner {
    padding-top: 0.7rem;
  }

  .term-meta {
    font-size: 0.9rem;
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
    font-size: 0.88rem;
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
    margin: 0.4rem 0 0;
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

  /* 4K / ultrawide: step the card type up alongside public-editorial's
     2200px type scale so cards don't read miniature on a 3840px viewport. */
  @media (min-width: 2200px) {
    .term-name {
      font-size: 1.3rem;
    }
    .card-def {
      font-size: 1.15rem;
    }
    .term-meta,
    .term-examples li,
    .term-related {
      font-size: 1.05rem;
    }
    .card-body {
      max-width: 80ch;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .term-card,
    .card-chevron,
    .card-more {
      transition: none;
    }
  }
</style>

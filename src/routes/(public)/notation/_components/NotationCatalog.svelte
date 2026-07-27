<!--
  The /notation catalog — a chronological record of who wrote flow arts down.

  It explains nothing. Every row links out to its creator's own material, in the
  same shape, with no per-entry accent colors and no decorative images: a record
  where every entry looks the same is a record that is not arguing.
  Spec: docs/superpowers/specs/2026-07-26-notation-catalog-design.md

  Layout: the row is a three-column grid across the whole --shell-w band — year
  rail, what it is, where to read it — so a 4K viewport is filled rather than
  leaving the right half empty (.claude/rules/4k-native-layout.md). It collapses
  to a stacked list below 60rem. Sizes are rem so they ride the lockstep root
  ramp instead of freezing at 1080p proportions.
-->
<script lang="ts">
  import SourceVideoCard from "$lib/shared/components/SourceVideoCard.svelte";
  import { NOTATION_CATALOG } from "$lib/shared/notation/notation-catalog";

  const entries = [...NOTATION_CATALOG].sort((a, b) => a.sortYear - b.sortYear);
  const isInternal = (href: string) => href.startsWith("/");
</script>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">Writing flow arts down</h1>
    <p class="page-subtitle">
      People have been trying to notate this since 2009. Here is who, and where
      to read them.
    </p>
  </header>

  <p class="loans">
    Two ideas came in from outside. Cutting a continuous flow into beats and
    giving each one a symbol is
    <a
      href="https://jugglinglab.org/html/ssnotation.html"
      target="_blank"
      rel="noopener">siteswap</a
    >, from juggling. Writing a performance as a compact score at all is music
    notation. Neither was built for props, and neither is on this list. It
    starts where flow arts notation starts.
  </p>

  <ol class="spine">
    {#each entries as entry (entry.id)}
      <li class="row" class:has-videos={!!entry.videos?.length}>
        <div class="year" aria-hidden="true">{entry.year}</div>

        <div class="body">
          <div class="identity">
            <h2 class="system">
              <span class="year-inline">{entry.year}</span>
              {entry.system}
            </h2>
            <p class="people">{entry.people}</p>
          </div>

          <div class="record">
            <p class="records">{entry.records}</p>

            {#if entry.subWorks?.length}
              <ul class="subworks">
                {#each entry.subWorks as work (work.name)}
                  <li><strong>{work.name}</strong>: {work.note}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>

        <div class="sources">
          <h3 class="sources-label">Read it there</h3>
          <ul>
            {#each entry.sources as source (source.href)}
              <li>
                {#if isInternal(source.href)}
                  <a class="source-link" href={source.href}>{source.label}</a>
                {:else}
                  <a
                    class="source-link"
                    href={source.href}
                    target="_blank"
                    rel="noopener"
                  >
                    {source.label}
                    <i
                      class="fas fa-arrow-up-right-from-square"
                      aria-hidden="true"
                    ></i>
                  </a>
                {/if}
              </li>
            {/each}
          </ul>
        </div>

        {#if entry.videos?.length}
          <div class="videos">
            {#each entry.videos as video (video.id)}
              <SourceVideoCard
                id={video.id}
                title={video.title}
                creator={video.creator}
                year={video.year}
                note={video.note}
              />
            {/each}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<style>
  .loans {
    max-width: none;
    margin: 0 0 clamp(2.5rem, 1.5rem + 1.4vw, 4rem);
    font-size: clamp(1rem, 0.95rem + 0.2vw, 1.2rem);
    line-height: 1.65;
    color: oklch(0.7 0.01 270);
  }
  .loans a {
    color: oklch(0.74 0.13 275);
    text-decoration: none;
  }
  .loans a:hover {
    color: oklch(0.92 0.02 275);
  }

  .spine {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    display: grid;
    /* Year rail, what it is, where to read it — the third column is what keeps
       a 1720px+ band full instead of trailing off into dead rail. */
    /* The rail is sized to its widest label ("c. 2010") at the year font
       size, so every row starts its content at the same x. */
    grid-template-columns: minmax(10.5rem, 11ch) minmax(0, 1fr) minmax(0, 24rem);
    /* Only rows that actually carry a strip declare the videos track — an
       always-on track leaves a row-gap of dead space under every other row. */
    grid-template-areas: "year body sources";
    column-gap: clamp(1.5rem, 0.8rem + 1.6vw, 4rem);
    row-gap: 1.5rem;
    padding: clamp(2rem, 1.2rem + 1.4vw, 3.5rem) 0;
    border-top: 1px solid oklch(0.6 0.02 270 / 0.14);
  }
  .row.has-videos {
    grid-template-areas:
      "year body sources"
      "year videos videos";
  }
  .row:first-child {
    border-top: none;
    padding-top: 0;
  }

  .year {
    grid-area: year;
    /* tabular-nums so the rail never resizes between rows
       (.claude/rules/no-layout-shift.md) */
    font-variant-numeric: tabular-nums;
    /* "c. 2010" and "2012–" must sit on one line or the rail stops reading as
       a rail (.claude/rules/no-layout-shift.md) */
    white-space: nowrap;
    font-size: clamp(1.6rem, 1.1rem + 1.1vw, 2.6rem);
    font-weight: 300;
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: oklch(0.72 0.11 275);
  }

  .body {
    grid-area: body;
  }
  .system {
    margin: 0 0 0.5rem;
    font-size: clamp(1.35rem, 1.1rem + 0.7vw, 2rem);
    font-weight: 600;
    line-height: 1.2;
    color: oklch(0.96 0.01 270);
  }
  /* The rail carries the year on wide screens; the stacked layout puts it back
     inline so the heading still says when. */
  .year-inline {
    display: none;
    font-variant-numeric: tabular-nums;
    color: oklch(0.72 0.11 275);
  }
  .people {
    margin: 0 0 0.75rem;
    font-size: clamp(0.92rem, 0.88rem + 0.14vw, 1.05rem);
    line-height: 1.5;
    color: oklch(0.68 0.02 270);
  }
  .records {
    margin: 0;
    font-size: clamp(1rem, 0.95rem + 0.2vw, 1.2rem);
    line-height: 1.6;
    color: oklch(0.86 0.01 270);
  }

  .subworks {
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }
  .subworks li {
    font-size: clamp(0.92rem, 0.88rem + 0.14vw, 1.05rem);
    line-height: 1.5;
    color: oklch(0.72 0.01 270);
    padding-left: 1rem;
    border-left: 1px solid oklch(0.6 0.02 270 / 0.22);
  }
  .subworks strong {
    color: oklch(0.9 0.01 270);
    font-weight: 600;
  }

  .sources {
    grid-area: sources;
  }
  .sources-label {
    margin: 0 0 0.6rem;
    font-size: clamp(0.72rem, 0.68rem + 0.1vw, 0.82rem);
    font-weight: 640;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: oklch(0.58 0.02 270);
  }
  .sources ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }
  .source-link {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
    /* Reads as a control, not a bare inline link
       (.claude/rules/clickables-look-like-buttons.md) */
    padding: 0.55rem 0.9rem;
    min-height: 2.75rem;
    box-sizing: border-box;
    align-content: center;
    flex-wrap: wrap;
    border: 1px solid oklch(0.45 0.04 270 / 0.28);
    border-radius: 8px;
    background: oklch(0.3 0.04 270 / 0.12);
    font-size: clamp(0.88rem, 0.84rem + 0.12vw, 0.98rem);
    line-height: 1.4;
    color: oklch(0.86 0.02 275);
    text-decoration: none;
    transition:
      color 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }
  .source-link:hover,
  .source-link:focus-visible {
    color: oklch(0.97 0.01 275);
    border-color: oklch(0.6 0.1 275 / 0.5);
    background: oklch(0.36 0.06 275 / 0.2);
  }
  .source-link i {
    font-size: 0.75em;
    opacity: 0.7;
  }

  .videos {
    grid-area: videos;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: clamp(0.9rem, 0.6rem + 0.6vw, 1.6rem);
    color: oklch(0.78 0.01 270);
  }

  /* ── room-scale: turn the wide shell into a composed archival spread ── */
  @media (min-width: 105rem) {
    .row {
      min-height: 23rem;
      box-sizing: border-box;
      align-items: stretch;
    }
    .row:first-child {
      padding-top: clamp(2rem, 1.2rem + 1.4vw, 3.5rem);
    }
    .year {
      align-self: center;
      font-size: 3.1rem;
    }
    .body {
      display: grid;
      grid-template-columns: minmax(14rem, 0.9fr) minmax(20rem, 1.25fr);
      gap: clamp(2rem, 1.2rem + 1.2vw, 4rem);
      align-items: center;
    }
    .records {
      font-size: 1.35rem;
      line-height: 1.55;
    }
    .sources {
      display: flex;
      flex-direction: column;
      min-width: 0;
      padding-left: clamp(1.5rem, 0.8rem + 1vw, 2.75rem);
      border-left: 1px solid oklch(0.6 0.02 270 / 0.14);
    }
    .sources-label {
      margin-top: auto;
    }
    .sources ul {
      margin-bottom: auto;
    }
  }

  /* ── tablet: sources drop under the body, still beside the year rail ── */
  @media (max-width: 68rem) {
    .row {
      grid-template-columns: minmax(9rem, 10ch) minmax(0, 1fr);
      grid-template-areas:
        "year body"
        "year sources";
    }
    .row.has-videos {
      grid-template-areas:
        "year body"
        "year sources"
        "year videos";
    }
    .videos {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* ── phone: stack, year inline with the system name ── */
  @media (max-width: 46rem) {
    .row {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "body"
        "sources";
      row-gap: 1.25rem;
    }
    .row.has-videos {
      grid-template-areas:
        "body"
        "sources"
        "videos";
    }
    .year {
      display: none;
    }
    .year-inline {
      display: inline;
      margin-right: 0.4rem;
    }
    .source-link {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .source-link {
      transition: none;
    }
  }
</style>

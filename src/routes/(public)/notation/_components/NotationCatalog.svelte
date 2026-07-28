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

  let expandedEntryId = $state<string | null>(null);
  let activeEntryId = $state(entries[0]?.id ?? "");
  let spineElement: HTMLOListElement | undefined = $state();

  const activeEntryIndex = $derived(
    Math.max(
      0,
      entries.findIndex((entry) => entry.id === activeEntryId)
    )
  );
  const activeEntryYear = $derived(entries[activeEntryIndex]?.year ?? "");

  function toggleEntry(entryId: string) {
    expandedEntryId = expandedEntryId === entryId ? null : entryId;
    activeEntryId = entryId;
  }

  $effect(() => {
    if (!spineElement || typeof IntersectionObserver === "undefined") return;

    const rows = Array.from(
      spineElement.querySelectorAll<HTMLElement>("[data-entry-id]")
    );
    const visibleRows = new Set<HTMLElement>();

    const reportActiveEntry = () => {
      const nearest = [...visibleRows].sort(
        (a, b) =>
          Math.abs(a.getBoundingClientRect().top - 112) -
          Math.abs(b.getBoundingClientRect().top - 112)
      )[0];
      const entryId = nearest?.dataset.entryId;
      if (entryId) {
        activeEntryId = entryId;
        return;
      }

      const firstRow = rows[0];
      const lastRow = rows[rows.length - 1];
      if (firstRow && firstRow.getBoundingClientRect().top > 112) {
        activeEntryId = firstRow.dataset.entryId ?? activeEntryId;
      } else if (lastRow && lastRow.getBoundingClientRect().bottom < 112) {
        activeEntryId = lastRow.dataset.entryId ?? activeEntryId;
      }
    };

    const observer = new IntersectionObserver(
      (observations) => {
        for (const observation of observations) {
          const row = observation.target as HTMLElement;
          if (observation.isIntersecting) visibleRows.add(row);
          else visibleRows.delete(row);
        }
        reportActiveEntry();
      },
      { rootMargin: "-112px 0px -64% 0px", threshold: 0 }
    );

    for (const row of rows) observer.observe(row);

    let animationFrame = 0;
    const checkBoundary = () => {
      if (animationFrame || visibleRows.size > 0) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        reportActiveEntry();
      });
    };
    window.addEventListener("scroll", checkBoundary, { passive: true });
    window.addEventListener("resize", checkBoundary);
    checkBoundary();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", checkBoundary);
      window.removeEventListener("resize", checkBoundary);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  });
</script>

<div class="editorial">
  <!-- Receives the launchpad tile's morph, the same way every other front-door
       destination does. Dropping it silently downgrades the tile to a cut. -->
  <header class="editorial-header" style:view-transition-name="launchpad-notation">
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

  <div
    class="chronology"
    role="group"
    aria-label={`Catalog position: ${activeEntryYear}, ${activeEntryIndex + 1} of ${entries.length}`}
  >
    <span class="chronology-year">{activeEntryYear}</span>
    <span
      class="chronology-track"
      aria-hidden="true"
      style={`--entry-count: ${entries.length}`}
    >
      {#each entries as entry, index (entry.id)}
        <span
          class="chronology-segment"
          class:passed={index < activeEntryIndex}
          class:current={index === activeEntryIndex}
        ></span>
      {/each}
    </span>
    <span class="chronology-count"
      >{activeEntryIndex + 1} / {entries.length}</span
    >
  </div>

  <ol class="spine" bind:this={spineElement}>
    {#each entries as entry (entry.id)}
      <li
        class="row"
        class:has-videos={!!entry.videos?.length}
        data-entry-id={entry.id}
      >
        <div class="year" aria-hidden="true">{entry.year}</div>

        <h2 class="mobile-heading">
          <button
            type="button"
            class="entry-summary"
            aria-expanded={expandedEntryId === entry.id}
            aria-controls={`catalog-entry-${entry.id}`}
            onclick={() => toggleEntry(entry.id)}
          >
            <span class="summary-year">{entry.year}</span>
            <span class="summary-copy">
              <span class="summary-system">{entry.system}</span>
              <span class="summary-people">{entry.people}</span>
            </span>
            <i class="fas fa-chevron-down summary-chevron" aria-hidden="true"
            ></i>
          </button>
        </h2>

        <div
          class="entry-panel"
          class:open={expandedEntryId === entry.id}
          id={`catalog-entry-${entry.id}`}
        >
          <div class="entry-panel-inner">
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
              {#if entry.explore}
                <!--
                  A button, not a source link: this one is something you do, not
                  something you read (.claude/rules/clickables-look-like-buttons.md).
                  It leads the column because a system you can run on this site
                  beats a link off to a forum thread.
                -->
                <a class="explore-link" href={entry.explore.href}>
                  {entry.explore.label}
                  <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
              {/if}

              <h3 class="sources-label">Read it there</h3>
              <ul>
                {#each entry.sources as source (source.href)}
                  <li>
                    {#if isInternal(source.href)}
                      <a class="source-link" href={source.href}
                        >{source.label}</a
                      >
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
          </div>
        </div>
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

  .chronology,
  .mobile-heading {
    display: none;
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

  /* These wrappers become real layout boxes only for the phone disclosure.
     Keeping them as contents preserves the desktop and tablet row grids. */
  .entry-panel,
  .entry-panel-inner {
    display: contents;
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
  /*
   * The same control as a source link, filled rather than outlined — it is the
   * one thing in an entry that leads somewhere on this site, and it should not
   * read as one more link in a list of forum threads.
   */
  .explore-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    align-self: start;
    white-space: nowrap;
    margin-bottom: 1rem;
    padding: 0.6rem 1.1rem;
    min-height: 2.75rem;
    box-sizing: border-box;
    border-radius: 8px;
    border: 1px solid var(--theme-accent, oklch(0.68 0.17 295));
    background: color-mix(in srgb, var(--theme-accent, oklch(0.68 0.17 295)) 20%, transparent);
    color: var(--semantic-text-primary, #fff);
    font-size: clamp(0.88rem, 0.84rem + 0.12vw, 0.98rem);
    font-weight: 600;
    text-decoration: none;
    transition: background 140ms ease;
  }

  .explore-link:hover {
    background: color-mix(in srgb, var(--theme-accent, oklch(0.68 0.17 295)) 34%, transparent);
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

  /* ── wide ledger: use the width without turning every entry into a slide ── */
  @media (min-width: 105rem) {
    .editorial-header {
      margin-block: 1.4rem 1.6rem;
    }
    .loans {
      margin-bottom: 2rem;
    }
    .body {
      display: grid;
      grid-template-columns: minmax(14rem, 0.9fr) minmax(20rem, 1.25fr);
      gap: clamp(2rem, 1.2rem + 1.2vw, 4rem);
      align-items: start;
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
    .chronology {
      position: sticky;
      top: 3.5rem;
      z-index: 4;
      display: grid;
      grid-template-columns: 5.25rem minmax(0, 1fr) 3.25rem;
      align-items: center;
      gap: 0.75rem;
      min-height: 3rem;
      margin: 0 0 0.5rem;
      padding: 0.6rem 0.75rem;
      box-sizing: border-box;
      border: 1px solid oklch(0.45 0.04 270 / 0.24);
      border-radius: 10px;
      background: oklch(0.16 0.025 270 / 0.9);
      box-shadow: 0 8px 24px oklch(0.06 0.02 270 / 0.28);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }
    .chronology-year,
    .chronology-count {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .chronology-year {
      font-size: 0.84rem;
      font-weight: 650;
      letter-spacing: 0.04em;
      color: oklch(0.8 0.1 275);
    }
    .chronology-count {
      text-align: right;
      font-size: 0.72rem;
      color: oklch(0.62 0.02 270);
    }
    .chronology-track {
      display: grid;
      grid-template-columns: repeat(var(--entry-count), minmax(0, 1fr));
      gap: 0.18rem;
    }
    .chronology-segment {
      height: 0.2rem;
      border-radius: 999px;
      background: oklch(0.42 0.025 270 / 0.46);
      transition:
        background 180ms ease,
        scale 180ms ease;
    }
    .chronology-segment.passed {
      background: oklch(0.59 0.09 275 / 0.62);
    }
    .chronology-segment.current {
      background: oklch(0.76 0.14 275);
      scale: 1 1.8;
    }

    .row {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "summary"
        "details";
      row-gap: 0;
      padding: 0;
      scroll-margin-top: 7.25rem;
    }
    .row.has-videos {
      grid-template-areas:
        "summary"
        "details";
    }
    .row:first-child {
      padding-top: 0;
    }
    .year {
      display: none;
    }

    .mobile-heading {
      grid-area: summary;
      display: block;
      margin: 0;
    }
    .entry-summary {
      display: grid;
      grid-template-columns: 4.75rem minmax(0, 1fr) 1rem;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      min-height: 5.5rem;
      padding: 0.85rem 0.35rem;
      border: 1px solid transparent;
      border-radius: 9px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      touch-action: manipulation;
      transition:
        background 160ms ease,
        border-color 160ms ease;
    }
    .entry-summary:hover {
      border-color: oklch(0.45 0.04 270 / 0.18);
      background: oklch(0.34 0.035 270 / 0.1);
    }
    .entry-summary:focus-visible {
      outline: 2px solid oklch(0.72 0.13 275);
      outline-offset: -2px;
      background: oklch(0.34 0.035 270 / 0.14);
    }
    .summary-year {
      align-self: start;
      padding-top: 0.08rem;
      font-size: 0.84rem;
      font-weight: 650;
      line-height: 1.3;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: oklch(0.74 0.11 275);
    }
    .summary-copy {
      display: grid;
      min-width: 0;
      gap: 0.3rem;
    }
    .summary-system {
      font-size: 1.05rem;
      font-weight: 610;
      line-height: 1.25;
      color: oklch(0.95 0.01 270);
    }
    .summary-people {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.78rem;
      font-weight: 400;
      line-height: 1.35;
      color: oklch(0.62 0.02 270);
    }
    .summary-chevron {
      font-size: 0.68rem;
      color: oklch(0.56 0.05 275);
      transition:
        color 180ms ease,
        transform 220ms ease;
    }
    .entry-summary[aria-expanded="true"] .summary-chevron {
      color: oklch(0.78 0.12 275);
      transform: rotate(180deg);
    }

    .entry-panel {
      grid-area: details;
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 240ms ease;
    }
    .entry-panel.open {
      grid-template-rows: 1fr;
    }
    .entry-panel-inner {
      display: grid;
      gap: 1.15rem;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      visibility: hidden;
      padding: 0;
      transition:
        padding 240ms ease,
        visibility 0s linear 240ms;
    }
    .entry-panel.open .entry-panel-inner {
      visibility: visible;
      padding: 0.2rem 0 1.5rem;
      transition-delay: 0s, 0s;
    }
    .body,
    .record,
    .sources,
    .videos {
      min-width: 0;
    }
    .body {
      grid-area: auto;
    }
    .identity {
      display: none;
    }
    .year-inline {
      display: none;
    }
    .records {
      line-height: 1.55;
    }
    .sources {
      grid-area: auto;
    }
    .sources-label {
      display: none;
    }
    .source-link {
      width: 100%;
    }
    .videos {
      grid-area: auto;
      display: flex;
      gap: 0.85rem;
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scroll-padding-inline: 0.1rem;
      scroll-snap-type: x mandatory;
      padding: 0.15rem 0.1rem 0.75rem;
      scrollbar-width: thin;
      scrollbar-color: oklch(0.48 0.04 275 / 0.42) transparent;
    }
    .videos :global(.cap-media) {
      flex: 0 0 87%;
      min-width: 0;
      scroll-snap-align: start;
    }
    .videos :global(.cap-media:last-child) {
      scroll-snap-align: end;
    }
    .videos :global(.cap-media figcaption) {
      font-size: 0.9rem;
      line-height: 1.4;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .source-link,
    .chronology-segment,
    .entry-summary,
    .summary-chevron,
    .entry-panel,
    .entry-panel-inner {
      transition: none;
    }
  }
</style>

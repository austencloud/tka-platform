<script lang="ts">
  /**
   * Table of Contents, generated from the body-page manifest. Page numbers,
   * order, and sub-entry nesting all come from `guide-manifest.ts` — never
   * hand-numbered — so building or reordering a page updates the TOC for free.
   *
   * Layout: two columns that read in NATURAL order — fill the left column
   * top-to-bottom (1.0, then 1.1…), overflow into the right (…1.1, 1.2) via CSS
   * multi-column flow. The long 1.1 spans the column break instead of jumping
   * the eye left→right→left. Fraunces section heads with big navy numerals + a
   * gold rule, dot leaders to recto/verso page numbers.
   */
  import { bodyPagesByGroup, GROUP_TITLES, type GuideGroup } from "../_data/guide-manifest";

  type Group = { group: GuideGroup; entries: { entry: { title: string; level: 0 | 1 }; page: number }[] };
  const groups = bodyPagesByGroup() as Group[];
  const byId = (g: GuideGroup) => groups.find((x) => x.group === g);

  // Single source-ordered flow; CSS columns balance it + break it across two
  // columns while keeping reading order 1.0 → 1.1 → 1.2.
  const ordered = [byId("1.0"), byId("1.1"), byId("1.2")].filter(Boolean) as Group[];
</script>

{#snippet section(g: Group)}
  <section class="toc-sec">
    <h3 class="toc-sec-h">
      <span class="toc-num">{g.group}</span>
      <span class="toc-sec-title">{GROUP_TITLES[g.group]}</span>
    </h3>
    <ul class="toc-list">
      {#each g.entries as row}
        <li class="toc-row" class:sub={row.entry.level === 1}>
          <span class="toc-label">{row.entry.title}</span>
          <span class="toc-lead" aria-hidden="true"></span>
          <span class="toc-pg">{row.page}</span>
        </li>
      {/each}
    </ul>
  </section>
{/snippet}

<div class="toc">
  <div class="toc-flow">
    {#each ordered as g}{@render section(g)}{/each}
  </div>
</div>

<style>
  /* Header (title + flourish) now lives in GuidePage; the TOC just fills the
     page body below it. */
  .toc {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  /* Native multi-column flow: content reads down the left column then down the
     right (column-major), balanced automatically — no manual side assignment. */
  .toc-flow {
    width: 100%;
    padding: 0 0.55in;
    column-count: 2;
    column-gap: 1.1in;
    column-rule: 1px solid #e2def0;
    column-fill: balance;
  }
  /* Let the long section (1.1) span the column break so the eye keeps a straight
     top-to-bottom path; rows stay whole and headers keep their first rows. */
  .toc-sec {
    break-inside: auto;
    margin-bottom: 0.55in;
  }
  .toc-sec:last-child {
    margin-bottom: 0;
  }
  .toc-sec-h {
    margin: 0 0 0.18in;
    padding-bottom: 0.09in;
    border-bottom: 1.5px solid #c9a227;
    display: flex;
    align-items: baseline;
    gap: 0.34em;
    break-after: avoid; /* never orphan a section head at a column bottom */
  }
  .toc-num {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 620, "WONK" 1;
    font-size: 1.95rem;
    line-height: 1;
    color: #2342c9;
  }
  .toc-sec-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 580, "WONK" 1;
    font-size: 1.32rem;
    color: #14142b;
  }
  .toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    break-inside: auto; /* the list may continue in the next column */
  }
  /* Row: label · dotted leader · page number. */
  .toc-row {
    display: flex;
    align-items: baseline;
    gap: 0.4em;
    line-height: 1.95;
    break-inside: avoid; /* never split one entry across the column gap */
  }
  .toc-label {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-weight: 600;
    font-size: 1.32rem;
    color: #18181f;
    white-space: nowrap;
  }
  .toc-row.sub .toc-label {
    font-weight: 400;
    font-style: italic;
    font-size: 1.12rem;
    color: #4a4658;
    padding-left: 0.9em;
  }
  .toc-lead {
    flex: 1 1 auto;
    border-bottom: 1px dotted #c4bfd6;
    transform: translateY(-0.28em);
    min-width: 0.5em;
  }
  .toc-pg {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.25rem;
    color: #3a3550;
    font-variant-numeric: tabular-nums;
  }
  .toc-row.sub .toc-pg {
    font-size: 1.12rem;
    color: #6a647a;
  }
</style>

<script lang="ts">
  /**
   * Table of Contents, generated from the body-page manifest. Page numbers,
   * order, and sub-entry nesting all come from `guide-manifest.ts` — never
   * hand-numbered — so building or reordering a page updates the TOC for free.
   *
   * Layout mirrors the original: two columns (1.0 + 1.2 left, the longer 1.1
   * right), Fraunces section heads with big navy numerals + a gold rule, dot
   * leaders to recto/verso page numbers.
   */
  import { bodyPagesByGroup, GROUP_TITLES, type GuideGroup } from "../_data/guide-manifest";

  type Group = { group: GuideGroup; entries: { entry: { title: string; level: 0 | 1 }; page: number }[] };
  const groups = bodyPagesByGroup() as Group[];
  const byId = (g: GuideGroup) => groups.find((x) => x.group === g);

  // 1.0 + 1.2 on the left, the longer 1.1 alone on the right.
  const left = [byId("1.0"), byId("1.2")].filter(Boolean) as Group[];
  const right = [byId("1.1")].filter(Boolean) as Group[];
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
  <header class="toc-head">
    <h2 class="toc-title">Table of Contents</h2>
    <span class="toc-flourish" aria-hidden="true"></span>
  </header>
  <div class="toc-cols">
    <div class="toc-col">
      {#each left as g}{@render section(g)}{/each}
    </div>
    <div class="toc-col">
      {#each right as g}{@render section(g)}{/each}
    </div>
  </div>
</div>

<style>
  .toc {
    min-height: 9.4in;
    display: flex;
    flex-direction: column;
    padding-top: 0.35in;
  }
  .toc-head {
    text-align: center;
    margin: 0 0 0.5in;
  }
  .toc-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 560, "WONK" 1;
    font-size: 2.8rem;
    color: #14142b;
    margin: 0;
  }
  /* Gold hairline flourish with a centred navy diamond — echoes the cover. */
  .toc-flourish {
    display: block;
    width: 2.4in;
    height: 9px;
    margin: 0.16in auto 0;
    background: linear-gradient(#c9a227, #c9a227) center / 100% 1px no-repeat;
    position: relative;
  }
  .toc-flourish::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    transform: translate(-50%, -50%) rotate(45deg);
    background: #14142b;
  }
  .toc-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    max-width: 6.7in;
    margin: 0 auto;
    width: 100%;
  }
  .toc-col {
    display: flex;
    flex-direction: column;
    gap: 0.4in;
    padding: 0 0.5in;
  }
  .toc-col:first-child {
    border-right: 1px solid #e2def0;
  }
  .toc-sec {
    break-inside: avoid;
  }
  .toc-sec-h {
    margin: 0 0 0.18in;
    padding-bottom: 0.09in;
    border-bottom: 1.5px solid #c9a227;
    display: flex;
    align-items: baseline;
    gap: 0.34em;
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
  }
  /* Row: label · dotted leader · page number. */
  .toc-row {
    display: flex;
    align-items: baseline;
    gap: 0.4em;
    line-height: 1.6;
  }
  .toc-label {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-weight: 600;
    font-size: 1.3rem;
    color: #18181f;
  }
  .toc-row.sub .toc-label {
    font-weight: 400;
    font-style: italic;
    font-size: 1.1rem;
    color: #4a4658;
    padding-left: 1.1em;
  }
  .toc-lead {
    flex: 1 1 auto;
    border-bottom: 1px dotted #c4bfd6;
    transform: translateY(-0.28em);
    min-width: 1.5em;
  }
  .toc-pg {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.15rem;
    color: #3a3550;
    font-variant-numeric: tabular-nums;
  }
  .toc-row.sub .toc-pg {
    font-size: 1.05rem;
    color: #6a647a;
  }
</style>

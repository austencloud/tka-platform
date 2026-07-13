<script lang="ts">
  /**
   * The Level 2 guide as ONE ordered page sequence — the level-2 counterpart of
   * level-1's GuideDocument. Both the print route (stacked pages) and the
   * compare/book route render this, so the two can never drift.
   *
   * Front matter is just the cover (the original Level 2 has no drink-water /
   * support / read-me / TOC pages — it goes cover → divider → content). Body
   * pages come from LEVEL2_BODY_PAGES; unbuilt ids render the shared
   * placeholder. Back matter is parked per the rebuild tracker.
   */
  import type { Snippet, Component } from "svelte";
  import PagePlaceholder from "../../level-1/_components/PagePlaceholder.svelte";
  import type { GuidePageMeta } from "../../level-1/_data/guide-manifest";
  import { LEVEL2_BODY_PAGES } from "../_data/guide-manifest";

  let {
    page,
    built = {},
  }: {
    page: Snippet<[GuidePageMeta]>;
    /** Built per-page components keyed by manifest id; rest render a placeholder. */
    built?: Record<string, Component>;
  } = $props();
</script>

{#snippet coverContent()}
  {@const Cover = built["cover"]}
  {#if Cover}
    <div class="cover-fill"><Cover /></div>
  {:else}
    <div class="cover-fill cover-pending">
      <p class="cover-title">The<br />Kinetic<br />Alphabet</p>
      <p class="cover-num">2</p>
    </div>
  {/if}
{/snippet}

<!-- Front matter (unnumbered cover), then the numbered body pages. -->
{@render page({ kind: "cover", fullBleed: true, label: "p1: Cover", content: coverContent })}
{#each LEVEL2_BODY_PAGES as entry, i}
  {#snippet bodyContent()}
    {@const Built = built[entry.id]}
    {#if Built}<Built />{:else}<PagePlaceholder />{/if}
  {/snippet}
  {@render page({
    kind: "body",
    title: entry.selfTitled ? undefined : entry.title,
    fullBleed: !!built[entry.id],
    pageNumber: i + 1,
    label: `body p${i + 1}: ${entry.title}`,
    content: bodyContent,
  })}
{/each}

<style>
  .cover-fill {
    width: 100%;
    aspect-ratio: 8.5 / 11;
  }
  /* Interim cover until the pictograph-ring cover page is built (tracker p1). */
  .cover-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4in;
    background: #fff;
  }
  .cover-title {
    font-family: "Tangerine", cursive;
    font-weight: 700;
    font-size: 5.2rem;
    line-height: 0.9;
    text-align: center;
    color: #14142b;
    margin: 0;
  }
  .cover-num {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-weight: 700;
    font-size: 4rem;
    color: #14142b;
    margin: 0;
  }
</style>

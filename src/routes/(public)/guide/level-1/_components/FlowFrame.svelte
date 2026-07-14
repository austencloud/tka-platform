<script lang="ts">
  /**
   * The reflow frame: stacks GuideBlocks in reading order down a mobile-first,
   * theme-aware editorial column. Ignores the `sheet` pt hints. Rendered inside
   * the reader (flow toggle) AND on the prerendered /guide/level-1/<slug> route
   * (crawlable). Pictographs render eagerly via GuidePictograph, whose synchronous
   * describePictograph aria-label lands in SSR HTML. One source with SheetFrame.
   */
  import GuidePictograph from "./GuidePictograph.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { GuideBlock } from "../_data/guide-content-blocks";

  let { content }: { content: GuideBlock[] } = $props();
</script>

<div class="flow-frame">
  {#each content as block, i (i)}
    {#if block.kind === "heading"}
      {#if block.level === 1}
        <h2 class="flow-h2">{block.text}</h2>
      {:else}
        <h3 class="flow-h3">{block.text}</h3>
      {/if}
    {:else if block.kind === "prose"}
      <p class="flow-p">{@html block.html}</p>
    {:else if block.kind === "glyphImage"}
      <img class="flow-glyph" src={block.src} alt={block.alt} height={block.heightPt * 2} />
    {:else if block.kind === "pictograph"}
      <figure class="flow-figure">
        <GuidePictograph data={block.data} size="md" eager propType={PropType.HAND} />
        {#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
      </figure>
    {:else if block.kind === "pictographGroup"}
      <div class="flow-grid" style:--cols={block.flowCols ?? 4}>
        {#each block.items as pos, n (pos.id ?? n)}
          <GuidePictograph data={pos} size="sm" eager propType={PropType.HAND} />
        {/each}
      </div>
      {#if block.caption}<p class="flow-caption">{block.caption}</p>{/if}
    {:else if block.kind === "printOnly"}
      {#each block.flow as fb, m (m)}
        {#if fb.kind === "prose"}<p class="flow-p">{@html fb.html}</p>{/if}
        {#if fb.kind === "heading"}<h3 class="flow-h3">{fb.text}</h3>{/if}
      {/each}
    {/if}
    <!-- rule blocks are print-only chrome; the flow column uses spacing, not hairlines -->
  {/each}
</div>

<style>
  .flow-frame {
    max-width: 46rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 4rem;
    color: var(--theme-text, #1a1a1a);
    font-family: var(--font-body, system-ui, sans-serif);
    line-height: 1.6;
  }
  .flow-h2 {
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    margin: 2rem 0 0.75rem;
    font-weight: 700;
  }
  .flow-h3 {
    font-size: clamp(1.25rem, 3vw, 1.5rem);
    margin: 1.75rem 0 0.5rem;
    font-weight: 650;
  }
  .flow-p {
    margin: 0 0 1rem;
    font-size: 1.05rem;
  }
  .flow-p :global(.cR) {
    color: #cc2127;
    font-weight: 700;
  }
  .flow-p :global(.cB) {
    color: #2e3192;
    font-weight: 700;
  }
  .flow-glyph {
    display: block;
    margin: 1.5rem auto 0.25rem;
    height: auto;
    width: auto;
  }
  .flow-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 0.75rem;
    margin: 1rem 0;
  }
  @media (max-width: 520px) {
    .flow-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .flow-figure {
    margin: 1.25rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .flow-figure figcaption,
  .flow-caption {
    font-size: 0.9rem;
    color: var(--theme-text-dim, #555);
    text-align: center;
  }
</style>

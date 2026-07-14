<script lang="ts">
  /**
   * The reflow frame: stacks GuideBlocks in reading order down a mobile-first,
   * theme-aware editorial column. Ignores the `sheet` pt hints. Rendered inside
   * the reader (flow toggle) AND on the prerendered /guide/level-1/<slug> route
   * (crawlable). Pictographs render eagerly via GuidePictograph, whose synchronous
   * describePictograph aria-label lands in SSR HTML. One source with SheetFrame.
   *
   * Owns its OWN light/dark palette (prefers-color-scheme + [data-theme]) — it does
   * NOT inherit the app's --theme-* vars, which are set for the dark-cosmic canvas
   * and render faint ink on the white editorial column.
   */
  import GuidePictograph from "./GuidePictograph.svelte";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { GuideBlock, PictographRender } from "../_data/guide-content-blocks";

  let { content, darkMode = false }: { content: GuideBlock[]; darkMode?: boolean } = $props();

  // Theme handed to each pictograph: "dark" renders on the dark editorial theme
  // (dark fill + light grid/props); "light" keeps the print ink-on-white look.
  const picTheme = $derived(darkMode ? "dark" : "light");

  // Render hints → GuidePictograph props, defaulting to FlowFrame's prior hardcoded
  // behavior (HAND props, TKA glyph on, every other layer off).
  const r = (render?: PictographRender) => ({
    propType: render?.propType ?? PropType.HAND,
    showTKA: render?.showTKA ?? true,
    showPositions: render?.showPositions ?? false,
    showElemental: render?.showElemental ?? false,
    showReversals: render?.showReversals ?? false,
    showNonRadialPoints: render?.showNonRadialPoints ?? false,
  });

  const gridLabel = (mode: "diamond" | "box" | "merged") =>
    mode === "diamond"
      ? "Diamond grid — four points at north, east, south, and west"
      : mode === "box"
        ? "Box grid — four points on the diagonals"
        : "8-point grid — diamond and box combined";
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
      <img class="flow-glyph" src={block.src} alt={block.alt} />
    {:else if block.kind === "pictograph"}
      {@const rp = r(block.render)}
      <figure class="flow-figure">
        <GuidePictograph
          data={block.data}
          size="md"
          eager
          forceTheme={picTheme}
          propType={rp.propType}
          showTKA={rp.showTKA}
          showPositions={rp.showPositions}
          showElemental={rp.showElemental}
          showReversals={rp.showReversals}
          showNonRadialPoints={rp.showNonRadialPoints}
        />
        {#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
      </figure>
    {:else if block.kind === "pictographGroup"}
      {@const rp = r(block.render)}
      <div class="flow-grid" style:--cols={block.flowCols ?? 4}>
        {#each block.items as pos, n (pos.id ?? n)}
          <GuidePictograph
            data={pos}
            size="sm"
            eager
            forceTheme={picTheme}
            propType={rp.propType}
            showTKA={rp.showTKA}
            showPositions={rp.showPositions}
            showElemental={rp.showElemental}
            showReversals={rp.showReversals}
            showNonRadialPoints={rp.showNonRadialPoints}
          />
        {/each}
      </div>
      {#if block.caption}<p class="flow-caption">{block.caption}</p>{/if}
    {:else if block.kind === "gridFigure"}
      <figure class="flow-grid-figure">
        <svg
          class="grid-fig"
          viewBox="0 0 950 950"
          role="img"
          aria-label={block.caption ?? gridLabel(block.mode)}
          style:background={darkMode ? "#0a0a0f" : "#ffffff"}
        >
          <desc>{block.caption ?? gridLabel(block.mode)}</desc>
          <rect width="950" height="950" fill={darkMode ? "#0a0a0f" : "#ffffff"} />
          {#if block.mode === "merged"}
            <GridSvg gridMode={GridMode.DIAMOND} {darkMode} />
            <GridSvg gridMode={GridMode.BOX} {darkMode} />
          {:else}
            <GridSvg gridMode={block.mode === "box" ? GridMode.BOX : GridMode.DIAMOND} {darkMode} />
          {/if}
        </svg>
        {#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
      </figure>
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
  /* Palette comes from the host via --ink/--ink-dim/--glyph-invert (with dark-ink
     fallbacks for a white host). FlowFrame must NOT declare --ink on .flow-frame —
     a local declaration would shadow the host's value and break the dark theme. */
  .flow-frame {
    max-width: 44rem;
    margin: 0 auto;
    padding: 0.5rem 1.5rem 4rem;
    color: var(--ink, #1a1a1a);
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.15rem;
    line-height: 1.65;
  }
  .flow-h2 {
    font-size: clamp(1.7rem, 4vw, 2.3rem);
    margin: 1.5rem 0 0.75rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .flow-h3 {
    font-size: clamp(1.3rem, 3vw, 1.6rem);
    margin: 0.25rem 0 0.4rem;
    font-weight: 650;
    text-align: center;
  }
  .flow-p {
    margin: 0 0 1.1rem;
    text-align: center;
    max-width: 34rem;
    margin-inline: auto;
  }
  .flow-p :global(.cR) {
    color: #cc2127;
    font-weight: 700;
  }
  .flow-p :global(.cB) {
    color: #2e3192;
    font-weight: 700;
  }
  .flow-p :global(.lg) {
    display: inline-block;
    width: 0.8em;
  }
  /* Section glyph: a modest opener, centered above the section name. */
  .flow-glyph {
    display: block;
    height: 3rem;
    width: auto;
    margin: 2.25rem auto 0.35rem;
    filter: invert(var(--glyph-invert, 0));
  }
  /* First section glyph shouldn't push a big gap under the intro. */
  .flow-glyph:first-of-type,
  .flow-p + .flow-glyph {
    margin-top: 1.5rem;
  }
  .flow-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 0.6rem;
    max-width: 30rem;
    margin: 0.75rem auto 1rem;
  }
  @media (max-width: 520px) {
    .flow-grid {
      grid-template-columns: repeat(2, 1fr);
      max-width: 20rem;
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
  .flow-caption,
  .flow-grid-figure figcaption {
    font-size: 0.95rem;
    color: var(--ink-dim, #555);
    text-align: center;
  }

  /* Grid diagram (The Grid page): the canonical GridSvg on a white square,
     points only — matching the printed proof's diamond/box/8-point figures. */
  .flow-grid-figure {
    margin: 1.5rem auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    max-width: 18rem;
  }
  .grid-fig {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border: 1px solid color-mix(in oklab, var(--ink, #1a1a1a) 18%, transparent);
    border-radius: 8px;
    /* background is set inline (theme-aware): white in light, near-black in dark */
  }
  /* The proof shows points only — drop GridSvg's connecting lines. */
  .grid-fig :global(line) {
    display: none;
  }
  .grid-fig :global(.grid-container) {
    opacity: 1;
  }

  /* Palette is HOST-owned: the reader's flow page is always a white sheet (keep
     the dark-ink default), the crawl route sets --ink/--glyph-invert per
     light/dark. FlowFrame never assumes its own background, so it can't flip ink
     to light on a white host. */
</style>

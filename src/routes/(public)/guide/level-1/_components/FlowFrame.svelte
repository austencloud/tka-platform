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

  let {
    content,
    darkMode = false,
    tagline = "",
  }: { content: GuideBlock[]; darkMode?: boolean; tagline?: string } = $props();

  // Theme handed to each pictograph: "dark" renders on the dark editorial theme
  // (dark fill + light grid/props); "light" keeps the print ink-on-white look.
  const picTheme = $derived(darkMode ? "dark" : "light");

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  // The prose carries hard <br> line-wraps authored for the fixed-width print
  // sheet; in the reflow column they force awkward mid-phrase breaks. Drop them so
  // the text wraps to the column naturally (a flow-only transform — the sheet keeps
  // its <br>s). Keep every other tag (the red/blue spans, <strong>, <em>).
  const flowProse = (html: string) => html.replace(/<br\s*\/?>/gi, " ").replace(/\s{2,}/g, " ");

  // The page title (level-1 heading) and the intro line are already shown by the
  // host hero (calligraphic title + tagline deck). Drop them here so the flow
  // column doesn't repeat the title as a section head or the tagline as its first
  // paragraph. Only the FIRST prose is checked, and only removed on an exact match
  // — unique intros stay verbatim.
  const rendered = $derived.by(() => {
    const tag = stripHtml(tagline);
    const out: GuideBlock[] = [];
    let firstProseSeen = false;
    for (const b of content) {
      if (b.kind === "heading" && b.level === 1) continue;
      if (!firstProseSeen && b.kind === "prose") {
        firstProseSeen = true;
        if (tag && stripHtml(b.html) === tag) continue;
      }
      out.push(b);
    }
    return out;
  });

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
  {#each rendered as block, i (i)}
    {#if block.kind === "heading"}
      {#if block.level === 2}
        <h2 class="flow-h2">{block.text}</h2>
      {:else}
        <h3 class="flow-h3">{block.text}</h3>
      {/if}
    {:else if block.kind === "prose"}
      <p class="flow-p">{@html flowProse(block.html)}</p>
    {:else if block.kind === "glyphImage"}
      <img class="flow-glyph" src={block.src} alt={block.alt} />
    {:else if block.kind === "pictograph"}
      {@const rp = r(block.render)}
      <figure class="flow-figure">
        <div class="pic-card">
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
        </div>
        {#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
      </figure>
    {:else if block.kind === "pictographGroup"}
      {@const rp = r(block.render)}
      {#if block.layout === "strip"}
        <!-- A sequence: one left-to-right strip (scrolls on narrow screens),
             the mobile-faithful form of the sheet's step rows. -->
        <figure class="flow-strip-figure">
          <div class="flow-strip" role="group" aria-label={block.caption ?? "Sequence"}>
            {#each block.items as pos, n (pos.id ?? n)}
              <div class="strip-cell">
                {#if block.stepLabels?.[n]}
                  <span class="strip-step">{block.stepLabels[n]}</span>
                {/if}
                <div class="pic-card">
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
                </div>
              </div>
            {/each}
          </div>
          {#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
        </figure>
      {:else}
        <div class="flow-grid" style:--cols={block.flowCols ?? 4}>
          {#each block.items as pos, n (pos.id ?? n)}
            <div class="pic-card">
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
            </div>
          {/each}
        </div>
        {#if block.caption}<p class="flow-caption">{block.caption}</p>{/if}
      {/if}
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
        {#if fb.kind === "prose"}<p class="flow-p">{@html flowProse(fb.html)}</p>{/if}
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
  /* This column renders INSIDE the guide SPA shell (.guide-content), whose
     dark-scroll typography (Inter, lavender oklch, weight 370, smaller sizes) is
     set with (0,1,1) rules that beat inheritance. Every text element below
     therefore states its OWN color / font-family / size / weight explicitly — the
     scoped .flow-* selectors out-specify .guide-content h2/h3/p, but only for the
     properties they actually set. Leave one unset and the dark-SPA value shows
     through. */
  .flow-frame {
    max-width: 44rem;
    margin: 0 auto;
    padding: 0.5rem 1.5rem 4rem;
    color: var(--ink, #1a1a1a);
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.2rem;
    line-height: 1.7;
  }
  .flow-h2 {
    font-family: "Cormorant Garamond", Georgia, serif;
    color: var(--ink, #1a1a1a);
    font-size: clamp(1.6rem, 4vw, 2.1rem);
    margin: 2.25rem 0 0.6rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: center;
  }
  .flow-h3 {
    font-family: "Cormorant Garamond", Georgia, serif;
    color: var(--ink, #1a1a1a);
    font-size: clamp(1.25rem, 3vw, 1.55rem);
    margin: 1.75rem 0 0.35rem;
    font-weight: 650;
    text-align: center;
  }
  .flow-p {
    font-family: "Cormorant Garamond", Georgia, serif;
    color: var(--ink, #1a1a1a);
    font-size: 1.2rem;
    font-weight: 500;
    line-height: 1.7;
    margin: 0 0 1.1rem;
    text-align: center;
    max-width: 34rem;
    margin-inline: auto;
  }
  /* Plain <strong> emphasis stays ink + bold (guide-content colours it lavender);
     the red/blue letter spans below still win their own colour. */
  .flow-p :global(strong) {
    color: var(--ink, #1a1a1a);
    font-weight: 700;
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

  /* ── Pictograph card: a framed cell so every pictograph reads as a discrete
     figure (the sheet minis' hairline border), theme-aware in one rule — a faint
     border + matching fill derived from --ink, so it works on both the warm-white
     and dark editorial columns. Rounds + clips the pictograph's square corners. */
  .pic-card {
    position: relative;
    width: 100%;
    border: 1px solid color-mix(in oklab, var(--ink, #1a1a1a) 16%, transparent);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 4px color-mix(in oklab, var(--ink, #1a1a1a) 7%, transparent);
  }
  .pic-card :global(.guide-pictograph) {
    width: 100%;
  }
  .pic-card :global(.pictograph-wrapper) {
    max-width: none !important;
  }

  .flow-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 0.75rem;
    max-width: 30rem;
    margin: 1rem auto 1.25rem;
  }
  @media (max-width: 520px) {
    .flow-grid {
      grid-template-columns: repeat(2, 1fr);
      max-width: 22rem;
    }
  }
  .flow-figure {
    margin: 1.5rem auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.55rem;
    max-width: 15rem;
  }
  .flow-figure figcaption,
  .flow-caption,
  .flow-strip-figure figcaption,
  .flow-grid-figure figcaption {
    font-size: 1rem;
    font-style: italic;
    color: var(--ink-dim, #555);
    text-align: center;
    line-height: 1.4;
  }
  .flow-caption {
    margin: 0.15rem auto 0.25rem;
    max-width: 30rem;
  }

  /* ── Sequence strip: a horizontal, left-to-right row that scrolls on narrow
     screens — the mobile form of the printed step strip. Cells stay legible
     (~118px) rather than shrinking to fit, so a long sequence scrolls instead of
     becoming unreadable. Snap points make the scroll feel intentional. */
  .flow-strip-figure {
    margin: 1.5rem auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    max-width: 100%;
  }
  .flow-strip {
    display: flex;
    gap: 0.7rem;
    overflow-x: auto;
    max-width: 100%;
    padding: 0.25rem 0.25rem 0.6rem;
    scroll-snap-type: x proximity;
    /* Centre when the row is narrower than the column; left-align + scroll when wider. */
    justify-content: safe center;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }
  .strip-cell {
    flex: 0 0 auto;
    width: clamp(104px, 30vw, 132px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    scroll-snap-align: center;
  }
  .strip-step {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim, #555);
    font-variant-numeric: tabular-nums;
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
    border: 1px solid color-mix(in oklab, var(--ink, #1a1a1a) 16%, transparent);
    border-radius: 12px;
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

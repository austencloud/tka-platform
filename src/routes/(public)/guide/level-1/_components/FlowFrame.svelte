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
  import { browser } from "$app/environment";
  import GuidePictograph from "./GuidePictograph.svelte";
  import GuideCardStage from "./GuideCardStage.svelte";
  import GridSvg from "$lib/shared/pictograph/grid/components/GridSvg.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { stripToSequence } from "../_data/guide-sequence-adapter";
  import { deriveWord } from "$lib/shared/foundation/services/word-deriver";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { describePictograph } from "$lib/shared/pictograph/shared/domain/utils/pictograph-description";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
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

  // Lay out a page's card set by run length:
  //  • 2+ consecutive cards → ONE responsive row that breaks out to the wide
  //    route width (3-up+ on desktop, live canvas above each card).
  //  • a LONE card → an ASIDE figure: the card sits to one side and the section's
  //    text (its heading + the prose before it, plus any prose right after it)
  //    flows beside it, so a single card USES the width instead of floating in a
  //    void. A lone card with no nearby prose falls back to a centred single.
  // Non-card blocks pass through in reading order.
  type CardBlock = Extract<GuideBlock, { kind: "pictographGroup" }>;
  type RenderItem =
    | { type: "block"; block: GuideBlock }
    | { type: "cardRow"; cards: CardBlock[] }
    | { type: "cardAside"; card: CardBlock; prose: GuideBlock[] };
  const isCard = (b: GuideBlock): b is CardBlock =>
    b.kind === "pictographGroup" && !!b.card;
  const isFlowText = (b: GuideBlock) => b.kind === "prose" || b.kind === "glyphImage";
  const renderItems = $derived.by(() => {
    const items: RenderItem[] = [];
    const blocks = rendered;
    // Heading + prose accumulated in the CURRENT section, not yet committed — a
    // lone card pulls these to sit beside it; otherwise they flush out normally.
    let pending: GuideBlock[] = [];
    const flushPending = () => {
      for (const pb of pending) items.push({ type: "block", block: pb });
      pending = [];
    };
    let i = 0;
    while (i < blocks.length) {
      const b = blocks[i]!;
      if (b.kind === "heading") {
        flushPending(); // previous section's leftover text renders above
        pending.push(b); // start the new section with its heading
        i++;
        continue;
      }
      if (isFlowText(b)) {
        pending.push(b);
        i++;
        continue;
      }
      if (isCard(b)) {
        // Consume the run of consecutive cards.
        const run: CardBlock[] = [];
        let j = i;
        while (j < blocks.length) {
          const nb = blocks[j]!;
          if (!isCard(nb)) break; // narrows nb → CardBlock for the push below
          run.push(nb);
          j++;
        }
        if (run.length >= 2) {
          flushPending(); // section text sits above a multi-card row
          items.push({ type: "cardRow", cards: run });
          i = j;
          continue;
        }
        // Lone card → aside. Prose = this section's accumulated text (heading +
        // preceding prose) plus any prose that immediately follows the card.
        const following: GuideBlock[] = [];
        let k = j;
        while (k < blocks.length && isFlowText(blocks[k]!)) following.push(blocks[k++]!);
        const prose = [...pending, ...following];
        pending = [];
        if (prose.length === 0) items.push({ type: "cardRow", cards: run });
        else items.push({ type: "cardAside", card: run[0]!, prose });
        i = k;
        continue;
      }
      // Any other block (pictograph, grid, strip, printOnly) — commit section
      // text first, then the block, in reading order.
      flushPending();
      items.push({ type: "block", block: b });
      i++;
    }
    flushPending();
    return items;
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

  // A sequence group → a playable SequenceData for the ChoreoCard. The word is
  // derived from the steps' own letters (unique per sequence, so cards don't
  // collide on the thumbnail cache key) rather than parsed from the caption.
  const groupSequence = (items: readonly unknown[]): SequenceData => {
    const strip = items as unknown as StepData[];
    // Derive the word from the strip's OWN step letters (skipping the start box) —
    // robust even when stripToSequence doesn't surface letters on `.steps` (some
    // sources, e.g. the reversal demos, otherwise fall back to a generic name).
    const fromLetters = strip
      .filter((s) => (s.stepNumber ?? 0) > 0)
      .map((s) => (s.letter as unknown as string) ?? "")
      .filter(Boolean)
      .join("");
    const full = fromLetters || deriveWord(stripToSequence(strip, {})) || "sequence";
    // A LOOP repeats its word by construction — show the smallest form (AABB, not
    // AABBAABB), per the simplified-word-display rule.
    const w = simplifyRepeatedWord(full) || full;
    return stripToSequence(strip, { word: w, name: w });
  };

  const gridLabel = (mode: "diamond" | "box" | "merged") =>
    mode === "diamond"
      ? "Diamond grid — four points at north, east, south, and west"
      : mode === "box"
        ? "Box grid — four points on the diagonals"
        : "8-point grid — diamond and box combined";
</script>

<div class="flow-frame">
  {#each renderItems as item, i (i)}
    {#if item.type === "cardRow"}
      <!-- A responsive row of hybrid card stages: each hold-in-hand ChoreoCard
           paired with a live 2D animation canvas of the same sequence, ringed in
           the viewer's gold playback glow while it's in view (GuideCardStage).
           3-up on desktop, wrapping to 2/1-up as the column narrows. The card +
           canvas are client-rendered (browser-gated); the caption and the
           per-pictograph notation (sr-only) are always prerendered so the
           sequence stays crawlable and available to assistive tech. -->
      <div class="flow-card-row" class:solo={item.cards.length === 1}>
        {#each item.cards as card, c (c)}
          {@const crp = r(card.render)}
          <div class="card-stage-slot">
            {#if browser}
              <GuideCardStage sequence={groupSequence(card.items)} propType={crp.propType} />
            {/if}
            {#if card.caption}<p class="card-caption">{card.caption}</p>{/if}
            <div class="sr-only">
              {#each card.items as pos, n (pos.id ?? n)}
                <span>{describePictograph(pos)}</span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else if item.type === "cardAside"}
      <!-- A single card stage set to one side, with the prose that references it
           flowing beside it (a figure + its explanation). Stacks on phones. -->
      {@const acard = item.card}
      {@const arp = r(acard.render)}
      <div class="flow-aside-group">
        <figure class="card-stage-aside">
          {#if browser}
            <GuideCardStage sequence={groupSequence(acard.items)} propType={arp.propType} />
          {/if}
          {#if acard.caption}<p class="card-caption">{acard.caption}</p>{/if}
          <div class="sr-only">
            {#each acard.items as pos, n (pos.id ?? n)}
              <span>{describePictograph(pos)}</span>
            {/each}
          </div>
        </figure>
        <div class="aside-prose">
          {#each item.prose as pb, m (m)}
            {#if pb.kind === "heading"}
              {#if pb.level === 2}
                <h2 class="flow-h2 aside-h">{pb.text}</h2>
              {:else}
                <h3 class="flow-h3 aside-h">{pb.text}</h3>
              {/if}
            {:else if pb.kind === "prose"}
              <p class="flow-p aside-p">{@html flowProse(pb.html)}</p>
            {:else if pb.kind === "glyphImage"}
              <img class="flow-glyph aside-glyph" src={pb.src} alt={pb.alt} />
            {/if}
          {/each}
        </div>
      </div>
    {:else}
      {@const block = item.block}
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
    {/if}
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
  /* The frame is a WIDE container; the reading measure is enforced per-element
     (.flow-p caps at 34rem, headings are short centred text), so prose pages look
     unchanged — their content still sits centred at its own width. The extra
     frame width only exists so card rows can break past the reading measure and
     show 3 legible cards across. */
  .flow-frame {
    max-width: 62rem;
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
    text-wrap: balance;
  }
  .flow-h3 {
    font-family: "Cormorant Garamond", Georgia, serif;
    color: var(--ink, #1a1a1a);
    font-size: clamp(1.25rem, 3vw, 1.55rem);
    margin: 1.75rem 0 0.35rem;
    font-weight: 650;
    text-align: center;
    text-wrap: balance;
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
    /* Even the line lengths on these short centred blocks so breaks land on
       phrase boundaries instead of stranding "the / shoulder" (2026 native). */
    text-wrap: balance;
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

  /* A row of hybrid card stages (each ChoreoCard + its live animation canvas).
     auto-fit means the row is 3-up on a wide column and reflows to 2-up / 1-up
     as it narrows — the "multiple pages, still flowable" requirement. A lone
     card (a run of one) sits centred at a single stage's width. */
  .flow-card-row {
    display: grid;
    /* Cards are CAPPED at ~300px, so one card (or a few) never balloons to fill
       the whole column (a lone card at 1fr became a ~660px monster you had to
       scroll past). auto-fit then packs as many capped cards across as the width
       allows — more cards per row on wide screens, never bigger cards. min(240px,
       100%) lets a lone card shrink below 240 on very narrow screens. */
    grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 300px));
    gap: 1.1rem;
    align-items: start;
    justify-content: center;
    /* Break OUT of the narrow reading measure to use the full content width on
       large screens. 94cqw = 94% of the guide route's own width (a container set
       in GuidePageHost), so this uses the 4K width without colliding with the
       sidebar. Prose stays narrow; only card rows widen. Centred on the frame,
       which is itself centred in the route. */
    width: min(90rem, 94cqw);
    margin-inline: calc((100% - min(90rem, 94cqw)) / 2);
    margin-block: 1.75rem;
  }
  /* A run of exactly ONE card is NOT a row to break out — a lone card in the wide
     band floats in a void. It sits at its own width, centred in the reading
     measure (a lone card with nearby prose becomes an aside instead; this is the
     no-prose fallback). */
  .flow-card-row.solo {
    width: auto;
    max-width: 300px;
    margin-inline: auto;
  }
  /* Phones: stack to one stage per row — these are detailed full cards, so 2-up
     at ~190px reads too small. One column keeps each card legible while the page
     stays a single flowing scroll. */
  @media (max-width: 560px) {
    .flow-card-row {
      grid-template-columns: 1fr;
      width: auto;
      max-width: 20rem;
      margin-inline: auto;
    }
  }
  .card-stage-slot {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.45rem;
    min-width: 0;
  }
  .card-caption {
    font-size: 1rem;
    font-style: italic;
    color: var(--ink-dim, #555);
    text-align: center;
    line-height: 1.4;
    margin: 0;
    text-wrap: balance;
  }

  /* Aside placement: the card to one side, the section's heading + prose beside
     it (a figure + its explanation). Uses the wide screen — the card+text block
     is ~60rem centred, so a single card no longer floats in a void — while the
     text column stays a readable measure. Stacks to one column on phones. */
  .flow-aside-group {
    display: flex;
    gap: 2rem;
    align-items: center;
    width: min(60rem, 92cqw);
    margin: 2rem auto;
  }
  .card-stage-aside {
    flex: 0 0 clamp(220px, 30%, 300px);
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-width: 0;
  }
  .aside-prose {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  /* The section heading, when it sits beside the card, reads as a left-aligned
     figure title — not the big centred page-section head. */
  .aside-prose .aside-h {
    text-align: left;
    margin-top: 0;
    margin-bottom: 0.2rem;
  }
  /* Prose beside a float reads left-aligned and full-width in its column, not the
     centred narrow measure the standalone flow prose uses. */
  .aside-prose .aside-p {
    text-align: left;
    max-width: none;
    margin-inline: 0;
  }
  .aside-prose .aside-glyph {
    margin-inline: 0;
  }
  @media (max-width: 560px) {
    .flow-aside-group {
      flex-direction: column;
      align-items: stretch;
      max-width: 22rem;
    }
    .card-stage-aside {
      flex: none;
    }
    .aside-prose .aside-p {
      text-align: center;
    }
  }
  /* Prerendered, invisible, but read by crawlers + assistive tech. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
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

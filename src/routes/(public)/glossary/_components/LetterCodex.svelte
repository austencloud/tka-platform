<!--
  LetterCodex — the glossary's visual letter reference.

  The guide keeps two frames for the same content: SheetFrame, the fixed
  816x1056 print artboard, and FlowFrame, "the reflow frame ... mobile-first,
  theme-aware editorial column". The printed codex sheet is the first. This is
  the codex's second: the same content and vocabulary — six letter types, the
  transition-captioned clusters, OPEN/CLOSE tags, the canonical pictographs —
  laid out as native sections that reflow instead of an artboard that can only
  be scaled. A scaled artboard is why the sheet fought both ends: cut off and
  flanked by dead space at 4K, and 30px pictographs on a phone.

  Structure follows the glossary's own master-detail: a board of letters, and a
  detail panel for the selected one. Below the two-column seam the detail
  becomes a focused view with a way back, which is the only thing that works on
  a small phone.

  Composition only. codex-groups owns the sheet structure and the derived
  transition captions, GuidePictograph owns rendering, SequenceSelection +
  selection.css own the hover/selected ring, and letterQueryHandler owns the
  variations query. Nothing here re-implements them.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    SHEET1,
    SHEET2,
    codexData,
    transitionFor,
    type CodexBoxDef,
    type CodexTypeDef,
  } from "../../guide/codex/_data/codex-groups";
  import GuidePictograph from "../../guide/level-1/_components/GuidePictograph.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import {
    SequenceSelection,
    setSequenceSelection,
  } from "$lib/shared/selection/sequence-selection.svelte";
  import "$lib/shared/selection/selection.css";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let { initialLetter = "A" }: { initialLetter?: string } = $props();

  // Both printed sheets, read as one continuous reference. `full` and the
  // sheet's divider rules are print-layout hints and are ignored here, the way
  // FlowFrame ignores the sheet's pt hints.
  const TYPES: CodexTypeDef[] = [...SHEET1.types, ...SHEET2.types];

  interface LetterInfo {
    id: string;
    label: string;
    name?: string;
    typeName: string;
    transition: string;
  }

  function typeName(type: CodexTypeDef): string {
    return `${type.word}${type.segs.map((s) => s.t).join("")}`;
  }

  const LETTERS = new Map<string, LetterInfo>();
  for (const type of TYPES) {
    for (const box of type.boxes) {
      for (const cell of box.cells) {
        if (LETTERS.has(cell.label)) continue;
        LETTERS.set(cell.label, {
          id: cell.id,
          label: cell.label,
          name: cell.name,
          typeName: typeName(type),
          transition: transitionFor(cell.id),
        });
      }
    }
  }
  const BY_ID = new Map([...LETTERS.values()].map((info) => [info.id, info]));

  /** How many clusters have to tile into rows. A `full` box spans the row, so
   *  it never participates in the column count. Type 1 has 6, Types 2 and 3
   *  have 4, and Types 4-6 are a single full-width row — different counts, so
   *  one shared column count could not divide all of them evenly. The layout
   *  picks per type instead. */
  function gridClusterCount(type: CodexTypeDef): number {
    return type.boxes.filter((box) => !box.full).length;
  }

  /** Types 4, 5 and 6 hold three pictographs each — a single short row apiece.
   *  Stacked, they leave three-quarters of a wide board empty. Consecutive
   *  single-box types therefore share one band and sit side by side, which fills
   *  the row with exactly the tile count Type 1 already solves for. */
  const BANDS: { key: string; cols: number; types: CodexTypeDef[] }[] = [];
  for (const type of TYPES) {
    const compact = type.boxes.length === 1;
    const open = BANDS.at(-1);
    if (compact && open && open.types.every((t) => t.boxes.length === 1)) {
      open.types.push(type);
      open.cols = Math.min(open.types.length, 3);
    } else {
      BANDS.push({ key: `band-${type.n}`, cols: 1, types: [type] });
    }
  }

  /** A cluster caption labels the whole box. Types 4-6 caption each cell
   *  individually (`cell.top`), so those boxes get no box-level caption. The
   *  printed sheet also drops a caption that merely repeats the row above it;
   *  in a reflowing column that row is no longer above, so it is derived back. */
  function clusterCaption(box: CodexBoxDef): string {
    if (box.cells.some((cell) => cell.top)) return "";
    return box.header ?? transitionFor(box.cells[0]!.id);
  }

  // Hover/selected ring — the shared primitive the guide's codex cells use, so
  // the two surfaces highlight identically. It colours from --theme-accent, so
  // here it picks up the glossary's accent instead of the guide's.
  const selection = new SequenceSelection();
  setSequenceSelection(selection);

  const initial = LETTERS.get(initialLetter) ?? LETTERS.get("A")!;
  let selectedId = $state(initial.id);
  selection.select(initial.id);

  const selectedInfo = $derived(BY_ID.get(selectedId) ?? initial);
  const selectedData = $derived(codexData(selectedId));

  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let loadError = $state(false);

  const variations = $derived(
    allPictographs.filter((p) => p.letter === selectedInfo.label)
  );

  async function load(): Promise<void> {
    isLoading = true;
    loadError = false;
    try {
      allPictographs = await letterQueryHandler.getAllPictographVariations(GridMode.DIAMOND);
    } catch (e) {
      console.error("LetterCodex: variations failed to load", e);
      loadError = true;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void load();
  });

  // Below the two-column seam the board and the detail are separate views: on a
  // small phone a detail panel appended under a 47-tile board is unreachable.
  const TWO_COLUMN_AT = 880;
  let rootEl = $state<HTMLDivElement>();
  let narrow = $state(false);
  let narrowView = $state<"board" | "detail">("board");

  $effect(() => {
    const el = rootEl;
    if (!el) return;
    const measure = () => (narrow = el.clientWidth < TWO_COLUMN_AT);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  });

  function selectLetter(id: string): void {
    if (!BY_ID.has(id)) return;
    selectedId = id;
    selection.select(id);
    if (!narrow) return;
    // The detail replaces the board in place, so without this the reader keeps
    // the board's scroll offset and lands mid-panel, below both the letter's
    // own heading and the way back.
    narrowView = "detail";
    tick().then(() => rootEl?.scrollIntoView({ block: "start" }));
  }

  function showBoard(): void {
    narrowView = "board";
    tick().then(() => rootEl?.scrollIntoView({ block: "start" }));
  }
</script>

<div class="codex" bind:this={rootEl} class:narrow>
  {#if !narrow || narrowView === "board"}
    <div class="board">
      {#if narrow}
        <!-- With the detail panel folded away there is no standing hint that a
             cell leads anywhere, and touch has no hover state to reveal one. -->
        <p class="board-hint">Tap a letter to see its variations.</p>
      {/if}
      {#each BANDS as band (band.key)}
      <div class="band cols-{band.cols}">
      {#each band.types as type (type.n)}
        <section
          class="type-block c{gridClusterCount(type)}"
          aria-labelledby="codex-type-{type.n}"
        >
          <h3 class="type-head" id="codex-type-{type.n}">
            <span class="type-word">{type.word}</span>{#each type.segs as seg}<span
                class="type-seg"
                style="color: {seg.c}">{seg.t}</span
              >{/each}
          </h3>

          <div class="clusters">
            {#each type.boxes as box, boxIndex (boxIndex)}
              {@const caption = clusterCaption(box)}
              <div class="cluster" class:full={box.full}>
                <div class="cluster-head">
                  <span class="cluster-cap">{caption}</span>
                  {#if box.mode}<span class="cluster-mode">{box.mode}</span>{/if}
                </div>
                <div
                  class="letters"
                  style="grid-template-columns: repeat({box.cells.length}, var(--tile))"
                >
                  {#each box.cells as cell (cell.id)}
                    <div
                      class="tile tka-seq-cell"
                      class:is-hovered={selection.isHovered(cell.id)}
                      class:is-selected={selection.isSelected(cell.id)}
                    >
                      <GuidePictograph
                        data={codexData(cell.id)}
                        size="sm"
                        showGrid={true}
                        showArrows={true}
                        showTKA={false}
                        showNonRadialPoints={false}
                        forceTheme="dark"
                        eager={true}
                      />
                      <span class="tile-label tka-font">{cell.label}</span>
                      {#if cell.top}<span class="tile-top">{cell.top}</span>{/if}
                      <SelectionHit
                        groupId={cell.id}
                        isGroupStart={true}
                        label="{cell.label}{cell.name ? ` (${cell.name})` : ''} — {type.word}{type.segs
                          .map((s) => s.t)
                          .join('')}"
                        onselect={selectLetter}
                      />
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/each}
      </div>
      {/each}
    </div>
  {/if}

  {#if !narrow || narrowView === "detail"}
    <aside class="detail" aria-busy={isLoading} aria-live="polite">
      <div class="detail-inner">
        <header class="detail-head">
          {#if narrow}
            <button type="button" class="back" onclick={showBoard}>
              <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
              All letters
            </button>
          {/if}
          <div class="detail-id">
            <span class="detail-letter tka-font">{selectedInfo.label}</span>
            <div class="detail-meta">
              {#if selectedInfo.name}<span class="detail-name">{selectedInfo.name}</span>{/if}
              <span class="detail-type">{selectedInfo.typeName}</span>
              <span class="detail-transition">{selectedInfo.transition}</span>
            </div>
          </div>
        </header>

        <div class="hero">
          <GuidePictograph
            data={selectedData}
            size="lg"
            showGrid={true}
            showArrows={true}
            showTKA={false}
            showNonRadialPoints={false}
            forceTheme="dark"
            eager={true}
          />
        </div>

        <h4 class="var-head">
          {#if !isLoading && !loadError}
            {variations.length} variation{variations.length === 1 ? "" : "s"}
          {:else}
            Variations
          {/if}
        </h4>

        {#if isLoading}
          <p class="state">
            <i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i>
            Loading variations…
          </p>
        {:else if loadError}
          <p class="state">
            <span>The variations did not load.</span>
            <button type="button" class="retry" onclick={load}>Try again</button>
          </p>
        {:else if variations.length === 0}
          <p class="state">No variations recorded for {selectedInfo.label}.</p>
        {:else}
          <div class="var-grid">
            {#each variations as pictograph, index (pictograph.id ?? index)}
              <figure class="var-cell">
                <GuidePictograph
                  data={pictograph}
                  size="sm"
                  showGrid={true}
                  showArrows={true}
                  showTKA={false}
                  showNonRadialPoints={false}
                  forceTheme="dark"
                  eager={true}
                />
                <figcaption class="sr-only">
                  {selectedInfo.label} variation {index + 1}
                </figcaption>
              </figure>
            {/each}
          </div>
        {/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  /* Sizes in rem so the whole board grows with the 4K root ramp instead of
     freezing at 1080p proportions. --tile is the one knob the layout turns. */
  .codex {
    /* Clears the page's fixed site header plus the sticky filter bar beneath
       it, so swapping between board and detail does not park the letter's
       heading and its way back underneath that chrome. */
    scroll-margin-top: var(--codex-scroll-offset, 8.5rem);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 26rem);
    gap: 2rem;
    align-items: start;
    padding: 1.5rem 0 0;
  }
  .codex.narrow {
    grid-template-columns: minmax(0, 1fr);
  }

  /* ── board ── */
  /* The board is the query container, so `100cqi` below is the board's own
     width — not the codex's. That is what lets the tile size be solved from the
     space the letters actually get, with or without the detail panel beside it. */
  .board {
    container-type: inline-size;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .board-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
  }

  .type-head {
    margin: 0 0 1rem;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1.2;
  }
  @container (min-width: 50rem) {
    .type-head {
      font-size: 1.35rem;
    }
  }
  .type-word {
    color: var(--theme-text, oklch(0.96 0.01 270));
  }
  /* The type-name accents are the printed sheet's own palette, carried over so
     the two surfaces name the types in the same colours. */
  .type-seg {
    font-weight: 700;
  }

  /* Clusters keep the sheet's grouping: each box is one row of letters under
     its transition caption. Column counts are pinned per tier rather than
     auto-filled, and the sheet's own `full` boxes span the row — which is what
     keeps every type off a row holding a single cluster. Type 1 reads as 6 + a
     full-width S-V, Types 2 and 3 as 4, Types 4-6 as one full-width row.
     max-content columns size to the widest cluster, so a 2-letter box is not
     padded out to the width of a 4-letter one. */
  /* Tile size is solved, not guessed: the widest row of a tier is N tiles plus
     G gaps, so a tile is (board - G gaps) / N. That is what makes the letters
     grow into a 4K board instead of leaving a field of dead rail, and shrink to
     a phone without a media query per device. The band owns the tokens because
     it also has to space its own columns by the same gap for the sum to land. */
  .band {
    --gx: 1rem;
    --tile: clamp(3.4rem, (100cqi - var(--gx)) / 4, 12rem);
    display: grid;
    justify-content: start;
    gap: 2.5rem var(--gx);
  }
  .clusters {
    display: grid;
    justify-content: start;
    gap: 1.4rem var(--gx);
    grid-template-columns: max-content;
  }
  /* Column counts divide each type's cluster count exactly — 6 goes 2 then 3,
     4 goes 2 then 4 — so no type ever ends on a row holding one cluster. The
     sheet's own `full` boxes (S-V, and all of Types 4-6) span the row. */
  .c4 .clusters {
    grid-template-columns: repeat(2, max-content);
  }
  @container (min-width: 26rem) {
    .band {
      --gx: 1.5rem;
      --tile: clamp(3.4rem, (100cqi - var(--gx)) / 6, 12rem);
    }
    .c6 .clusters {
      grid-template-columns: repeat(2, max-content);
    }
  }
  @container (min-width: 46rem) {
    .band {
      --gx: 1.75rem;
      --tile: clamp(3.4rem, (100cqi - 2 * var(--gx)) / 9, 12rem);
    }
    .band.cols-2 {
      grid-template-columns: repeat(2, max-content);
    }
    .band.cols-3 {
      grid-template-columns: repeat(3, max-content);
    }
    .c6 .clusters {
      grid-template-columns: repeat(3, max-content);
    }
    .c4 .clusters {
      grid-template-columns: repeat(4, max-content);
    }
  }
  .cluster {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .cluster.full {
    grid-column: 1 / -1;
  }
  .cluster-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    min-height: 1.1rem;
    font-size: 0.8rem;
  }
  .cluster-cap {
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
    letter-spacing: 0.04em;
  }
  .cluster-mode {
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.1rem 0.4rem;
    border-radius: 999px;
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.3));
  }

  /* Flush shared walls, the way the printed sheet tables its cells. */
  .letters {
    display: grid;
    gap: 0;
  }

  .tile {
    position: relative;
    width: var(--tile);
    height: var(--tile);
    box-sizing: border-box;
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.3));
    margin-inline-end: -1px;
    background: var(--theme-panel-bg, oklch(0.16 0.02 270));
    border-radius: 2px;
    --pictograph-border: none;
  }
  .tile :global(.guide-pictograph),
  .tile :global(.pictograph-wrapper) {
    width: 100%;
    height: 100%;
    max-width: none;
    gap: 0;
  }
  /* The letter rides in the corner of its cell, as on the sheet. It sits over
     live arrow ink, so it carries its own scrim rather than relying on whatever
     happens to be behind it, and it scales with the tile so a 4K board does not
     leave the glyphs reading as punctuation. */
  .tile-label {
    position: absolute;
    left: 0.15rem;
    bottom: 0.15rem;
    z-index: 3;
    padding: 0.05rem 0.28rem;
    border-radius: 0.3rem;
    font-size: clamp(0.8rem, calc(var(--tile) * 0.135), 1.15rem);
    line-height: 1.15;
    color: var(--theme-text, oklch(0.96 0.01 270));
    background: oklch(0.12 0.02 270 / 0.82);
    pointer-events: none;
  }
  .tile-top {
    position: absolute;
    right: 0.15rem;
    top: 0.15rem;
    z-index: 3;
    padding: 0.05rem 0.28rem;
    border-radius: 0.3rem;
    font-size: clamp(0.62rem, calc(var(--tile) * 0.105), 0.9rem);
    line-height: 1.2;
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
    background: oklch(0.12 0.02 270 / 0.82);
    pointer-events: none;
  }

  /* ── detail ── */
  /* Its own container, so the variations grid counts columns against the panel
     it lives in rather than against the whole codex. */
  .detail {
    min-width: 0;
    container-type: inline-size;
  }
  .codex:not(.narrow) .detail-inner {
    position: sticky;
    top: 1.5rem;
  }
  .detail-inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.22));
    border-radius: 1rem;
    background: var(--theme-panel-bg, oklch(0.16 0.02 270));
  }

  .detail-head {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.4rem 1rem;
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.3));
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text, oklch(0.96 0.01 270));
    font: 600 0.85rem/1 inherit;
    cursor: pointer;
  }
  .back:hover {
    border-color: var(--theme-accent, #6366f1);
  }

  .detail-id {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }
  /* Reserved slot: "A" and "Σ-" differ in width, and the meta beside it must
     not shift as the selection changes. */
  .detail-letter {
    flex: 0 0 auto;
    min-width: 2.2em;
    font-size: 2.4rem;
    line-height: 1;
    color: var(--theme-text, oklch(0.96 0.01 270));
  }
  .detail-meta {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    font-size: 0.85rem;
  }
  .detail-name {
    color: var(--theme-text, oklch(0.96 0.01 270));
    font-weight: 600;
  }
  .detail-type,
  .detail-transition {
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
  }

  .hero {
    display: flex;
    justify-content: center;
    padding: 0.5rem 0;
    --pictograph-border: none;
  }
  .hero :global(.pictograph-wrapper) {
    width: min(100%, 20rem);
    max-width: none;
  }

  .var-head {
    margin: 0;
    padding-top: 0.75rem;
    border-top: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.22));
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--theme-text, oklch(0.96 0.01 270));
    font-variant-numeric: tabular-nums;
  }

  /* 2 or 4 columns only: letters carry 8 or 16 variations, so both divide
     evenly and no row is ever left holding one. */
  .var-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }
  @container (min-width: 25rem) {
    .var-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .var-cell {
    margin: 0;
    aspect-ratio: 1;
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.3));
    border-radius: 4px;
    overflow: hidden;
    --pictograph-border: none;
  }
  .var-cell :global(.guide-pictograph),
  .var-cell :global(.pictograph-wrapper) {
    width: 100%;
    height: 100%;
    max-width: none;
    gap: 0;
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    padding: 1.5rem 1rem;
    color: var(--theme-text-muted, oklch(0.72 0.015 270));
    text-align: center;
  }
  .retry {
    min-height: 44px;
    padding: 0.5rem 1.1rem;
    border: 1px solid var(--theme-stroke, oklch(0.42 0.04 270 / 0.3));
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text, oklch(0.96 0.01 270));
    font: 600 0.85rem/1 inherit;
    cursor: pointer;
  }
  .retry:hover {
    border-color: var(--theme-accent, #6366f1);
  }

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
</style>

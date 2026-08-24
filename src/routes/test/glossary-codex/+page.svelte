<!--
  /test/glossary-codex — direction-A harness for the glossary Letter Codex.

  Approved direction (2026-08-23): one canonical Guide sheet page at a time on
  the left, rendered by the PROVEN owners (CodexSheet + codex-groups), with a
  compact, four-column-capped variations rail on the right. Narrow screens get
  a dedicated variation view instead of two crammed panes.

  This page creates nothing new in the domain: the sheet is the same component
  the /guide/codex print route and the Level 1 reader render, and variations
  come from the same letterQueryHandler dataframe the app uses everywhere.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import CodexSheet from "../../(public)/guide/codex/_components/CodexSheet.svelte";
  import {
    SHEET1,
    SHEET2,
    type CodexSheetDef,
  } from "../../(public)/guide/codex/_data/codex-groups";
  import {
    SequenceSelection,
    setSequenceSelection,
  } from "$lib/shared/selection/sequence-selection.svelte";
  import { letterQueryHandler } from "$lib/shared/pictograph/tka-glyph/services/letter-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  const SHEETS: { def: CodexSheetDef; label: string }[] = [
    { def: SHEET1, label: "Types 1–2" },
    { def: SHEET2, label: "Types 3–6" },
  ];

  // cell id ("Σ--0") ↔ letter ("Σ-"), across both sheets.
  const LETTER_BY_CELL = new Map<string, string>(
    SHEETS.flatMap(({ def }) =>
      def.types.flatMap((t) => t.boxes.flatMap((b) => b.cells.map((c) => [c.id, c.label] as const)))
    )
  );
  const CELL_BY_LETTER = new Map<string, string>(
    [...LETTER_BY_CELL].map(([id, letter]) => [letter, id])
  );

  // Selection ring on sheet cells — the shared primitive CodexCell already
  // consumes; providing the context is all it takes.
  const selection = new SequenceSelection();
  setSequenceSelection(selection);

  let sheetIndex = $state(0);
  let selectedLetter = $state("A");
  selection.select("A-0");

  const EXTENSION_LETTER = "τ-";
  const extensionSelected = $derived(selectedLetter === EXTENSION_LETTER);

  let allPictographs = $state<PictographData[]>([]);
  let isLoading = $state(true);
  let loadError = $state(false);

  const variations = $derived(allPictographs.filter((p) => p.letter === selectedLetter));

  async function load(): Promise<void> {
    isLoading = true;
    loadError = false;
    try {
      allPictographs = await letterQueryHandler.getAllPictographVariations(GridMode.DIAMOND);
    } catch (e) {
      console.error("glossary-codex harness: variations failed to load", e);
      loadError = true;
    } finally {
      isLoading = false;
    }
  }

  // Layout: side-by-side above the seam, dedicated views below it.
  let rootEl = $state<HTMLDivElement>();
  let stacked = $state(false);
  let mobileView = $state<"sheet" | "variations">("sheet");

  // Scale-to-fit for the 816px-native sheet artboard (same treatment as the
  // /guide/codex route): shrink below 816px available, upscale to 1.9x above.
  let sheetPaneEl = $state<HTMLDivElement>();
  let scale = $state(1);
  const shiftPx = $derived(-408 * Math.max(0, scale - 1));

  function selectCell(id: string): void {
    const letter = LETTER_BY_CELL.get(id);
    if (!letter) return;
    selectedLetter = letter;
    selection.select(id);
    if (stacked) mobileView = "variations";
  }

  function selectExtension(): void {
    selectedLetter = EXTENSION_LETTER;
    selection.clear();
    if (stacked) mobileView = "variations";
  }

  function backToSheet(): void {
    mobileView = "sheet";
  }

  onMount(() => {
    void load();

    const fit = () => {
      if (rootEl) stacked = rootEl.clientWidth < 980;
      if (sheetPaneEl) {
        // 32px of pane padding stays out of the artboard budget.
        scale = Math.min(Math.max(sheetPaneEl.clientWidth - 32, 240) / 816, 1.9);
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (rootEl) ro.observe(rootEl);
    if (sheetPaneEl) ro.observe(sheetPaneEl);
    return () => ro.disconnect();
  });
</script>

<svelte:head>
  <title>Glossary Letter Codex — harness</title>
</svelte:head>

<div class="harness" bind:this={rootEl}>
  <header class="bar">
    <div class="bar-lead">
      <h1>Letter Codex</h1>
      <span class="bar-note">direction-A harness · canonical sheet + variations</span>
    </div>
    <div class="bar-controls">
      <SegmentedControl
        options={SHEETS.map((s, i) => ({ value: i, label: s.label }))}
        value={sheetIndex}
        onchange={(v) => (sheetIndex = v as number)}
        color="accent"
        size="sm"
      />
      <button
        type="button"
        class="extension-chip"
        class:active={extensionSelected}
        aria-pressed={extensionSelected}
        onclick={selectExtension}
      >
        <span class="tka-font ext-glyph">τ-</span>
        <span>extension</span>
      </button>
    </div>
  </header>

  <div class="panes" class:stacked>
    {#if !stacked || mobileView === "sheet"}
      <div class="sheet-pane" bind:this={sheetPaneEl}>
        <div class="sheet-wrap" style="height: {1056 * scale}px">
          <div class="sheet-scale" style="transform: translateX({shiftPx}px) scale({scale})">
            <div class="sheet-paper">
              <CodexSheet sheet={SHEETS[sheetIndex]!.def} embed onCellSelect={selectCell} />
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if !stacked || mobileView === "variations"}
      <div class="var-pane" aria-busy={isLoading}>
        <div class="var-head">
          {#if stacked}
            <button type="button" class="back-btn" onclick={backToSheet}>
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
              Codex
            </button>
          {/if}
          <span class="var-letter tka-font">{selectedLetter}</span>
          <span class="var-count">
            {#if extensionSelected}
              Registered Type 4 extension
            {:else if !isLoading && !loadError}
              {variations.length} variation{variations.length === 1 ? "" : "s"}
            {/if}
          </span>
        </div>

        {#if extensionSelected}
          <div class="state-message">
            <p>
              <span class="tka-font ext-glyph">τ-</span> is a registered Level 4 extension of Type 4.
              It has no dataframe variations yet.
            </p>
          </div>
        {:else if isLoading}
          <div class="state-message">
            <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
            Loading variations…
          </div>
        {:else if loadError}
          <div class="state-message">
            <span>The variations did not load.</span>
            <button type="button" class="retry-btn" onclick={load}>Try again</button>
          </div>
        {:else if variations.length === 0}
          <div class="state-message">No variations for “{selectedLetter}”.</div>
        {:else}
          <div class="var-grid">
            {#each variations as pictograph, index (pictograph.id ?? index)}
              <figure class="var-card">
                <div class="var-picto">
                  <PictographContainer
                    pictographData={pictograph}
                    darkMode={false}
                    showGrid={true}
                    showHandPoints={true}
                    showTKA={true}
                    showTnD={false}
                    showElemental={false}
                    showPositions={false}
                    showReversals={false}
                    showNonRadialPoints={false}
                  />
                </div>
                <figcaption class="visually-hidden">
                  {selectedLetter} variation {index + 1}
                </figcaption>
              </figure>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .harness {
    min-height: 100vh;
    background: var(--theme-panel-bg, oklch(0.15 0.02 270));
    color: var(--theme-text, #f0f0f5);
    display: flex;
    flex-direction: column;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }
  .bar-lead {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
  }
  .bar-lead h1 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
  }
  .bar-note {
    font-size: var(--font-size-compact, 0.8rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }
  .bar-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  /* Deliberately quieter than the sheet switcher: τ- is subordinate to the 47
     base letters, never a seventh group. */
  .extension-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 0.8rem);
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background 150ms ease;
  }
  .extension-chip:hover {
    border-color: var(--theme-accent, #7d75ff);
  }
  .extension-chip.active {
    border-color: var(--theme-accent, #7d75ff);
    background: color-mix(in oklab, var(--theme-accent, #7d75ff) 16%, transparent);
    color: var(--theme-text, #f0f0f5);
  }
  .ext-glyph {
    font-size: 1.05rem;
  }

  .panes {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    min-height: 0;
  }
  .panes.stacked {
    grid-template-columns: minmax(0, 1fr);
  }

  .sheet-pane {
    padding: 1rem;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    overflow-y: auto;
  }
  .sheet-wrap {
    width: 816px;
    max-width: 100%;
  }
  .sheet-scale {
    width: 816px;
    transform-origin: top left;
  }
  /* The embedded sheet has no chrome of its own; this frame restores the
     white-paper artboard the print route paints. */
  .sheet-paper {
    background: #fff;
    color: #111;
    padding: 0.4in 0.5in;
    box-sizing: border-box;
    width: 816px;
    min-height: 1056px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  }

  .var-pane {
    padding: 1rem 1.25rem 2rem;
    overflow-y: auto;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    container-type: inline-size;
  }
  .panes.stacked .var-pane {
    border-left: none;
  }

  .var-head {
    display: flex;
    align-items: baseline;
    gap: 0.65rem;
    margin-bottom: 0.9rem;
  }
  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    padding: 0.35rem 0.9rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #f0f0f5);
    font-size: var(--font-size-compact, 0.8rem);
    cursor: pointer;
    align-self: center;
  }
  .var-letter {
    font-size: 1.9rem;
    line-height: 1;
  }
  .var-count {
    font-size: var(--font-size-min, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-variant-numeric: tabular-nums;
  }

  /* 2 or 4 columns only: every dataframe letter has 8 or 16 variations, so
     both counts divide evenly — no orphan rows at any width (3 would orphan). */
  .var-grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(2, minmax(0, 15rem));
    justify-content: center;
  }
  @container (min-width: 46rem) {
    .var-grid {
      grid-template-columns: repeat(4, minmax(0, 15rem));
    }
  }

  .var-card {
    margin: 0;
    padding: 0.4rem;
    border-radius: 0.7rem;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.25);
  }
  .var-picto {
    aspect-ratio: 1;
    width: 100%;
  }

  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 16rem;
    padding: 2rem 1rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    text-align: center;
  }
  .state-message p {
    margin: 0;
    max-width: 34rem;
  }
  .retry-btn {
    min-height: 44px;
    padding: 0.6rem 1.1rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.22));
    border-radius: 999px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    color: var(--theme-text, #f0f0f5);
    cursor: pointer;
  }

  .visually-hidden {
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

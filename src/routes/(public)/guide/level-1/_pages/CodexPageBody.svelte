<script lang="ts">
  /**
   * CodexPageBody — one Codex sheet as one printable guide page.
   *
   * The Codex spans TWO letter-sized pages (Types 1-2 on sheet 1, Types 3-6 on
   * sheet 2), exactly like the original printed guide. Each sheet is authored to
   * fill one page, so each renders as its own manifest page (`codex`, `codex-2`)
   * — no nested scrollbar cramming both sheets into a single frame. This is the
   * component both codex pages delegate to; GuideCodexPage / GuideCodexPage2 are
   * thin wrappers that pass SHEET1 / SHEET2.
   *
   * The page IS the printable codex — visually identical to the static
   * /guide/codex sheets (white paper, CodexSheet/CodexBox/CodexCell, no gray
   * backgrounds, no on-page controls). It serves print AND the interactive
   * reader with the exact same layout.
   *
   * Every control (prop family, layer visibility, rotate/mirror/color-swap)
   * lives in the companion panel (GuideCodexControls.svelte) — never on the
   * page. Both codex pages and the controls read/write one shared singleton,
   * guide-codex-state.svelte.ts, so a control change re-renders the sheets live.
   *
   * PRINT/BOOK SEAM: /print and /book share this manifest + BUILT registry with
   * the reader; this component discriminates via the sequence-click context
   * (only the reader provides it — getGuidePrintMode() && emitSequence === null
   * means print/book, which render the plain static sheet, no live state, no
   * clickable cells).
   */
  import { onMount } from "svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { createMotionData, type MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { getGuideSequenceClick, getGuidePrintMode } from "../_data/guide-data-context";
  import { bakeReversals } from "../_data/guide-sequence-adapter";
  import { getGuideCodexState } from "../_data/guide-codex-state.svelte";
  import { registerCodexCellTrigger } from "../_data/guide-scan-intent";
  import CodexSheet from "../../codex/_components/CodexSheet.svelte";
  import { SHEET1, SHEET2, type CodexCellDef, type CodexSheetDef } from "../../codex/_data/codex-groups";

  let { sheet }: { sheet: CodexSheetDef } = $props();

  const emitSequence = getGuideSequenceClick();
  // The reader ALSO sets guide print mode (print STYLE + eager pictographs), so
  // getGuidePrintMode() can't tell reader from /print,/book. The sequence-click
  // context can: only the reader provides it. Interactive there; static
  // (and print-identical) sheets everywhere else.
  const printMode = getGuidePrintMode() && emitSequence === null;

  const state = printMode ? null : getGuideCodexState();

  // Flat lookup from cell id -> its CodexCellDef, across BOTH sheets, so the
  // scan-trigger handler (registered globally) can animate any cell regardless
  // of which codex page registered last — and so the click handler can read the
  // human label (`W-`, `Σ`, `α`…) without re-deriving it from the raw id.
  const CELLS_BY_ID: Map<string, CodexCellDef> = new Map(
    [SHEET1, SHEET2].flatMap((s) =>
      s.types.flatMap((type) => type.boxes.flatMap((box) => box.cells.map((c) => [c.id, c] as const)))
    )
  );

  function staticFrom(m: MotionData | undefined, color: MotionColor) {
    if (!m) return undefined;
    return createMotionData({
      motionType: MotionType.STATIC,
      startLocation: m.startLocation,
      endLocation: m.startLocation,
      startOrientation: m.startOrientation,
      endOrientation: m.startOrientation,
      color,
      propType: m.propType,
      gridMode: m.gridMode,
    });
  }

  // Cell ids on THIS page's sheet — the emit effect below only fires for
  // selections this page owns, so with both codex pages mounted exactly one
  // of them (the one rendering the cell) emits the animation strip.
  const SHEET_IDS: Set<string> = new Set(
    sheet.types.flatMap((type) => type.boxes.flatMap((box) => box.cells.map((c) => c.id)))
  );

  // Selecting a cell (tap or scan intent) only records the selection; the
  // $effect below builds and emits the strip. Because the effect re-runs when
  // anything dataFor() reads changes (turns, prop family, rotate/mirror/swap),
  // adjusting a turn while the companion is playing re-emits the strip and the
  // animation updates live — not just the static cells.
  function handleCellSelect(id: string) {
    if (!state) return;
    state.selectedCellId = id;
  }

  $effect(() => {
    if (!emitSequence || !state) return;
    const id = state.selectedCellId;
    if (!id || !SHEET_IDS.has(id)) return;
    const data = state.dataFor(id);
    if (!data) return;
    emitStrip(id, data);
  });

  function emitStrip(id: string, data: PictographData) {
    if (!emitSequence || !state) return;
    const cellDef = CELLS_BY_ID.get(id);
    const blue = data.motions?.[MotionColor.BLUE];
    const red = data.motions?.[MotionColor.RED];
    const key = `codex-${id}`;
    const start: StepData = {
      id: `${key}-start`,
      letter: null,
      gridMode: data.gridMode,
      stepNumber: 0,
      startPosition: data.startPosition,
      endPosition: data.startPosition,
      motions: {
        blue: staticFrom(blue, MotionColor.BLUE),
        red: staticFrom(red, MotionColor.RED),
      },
    } as unknown as StepData;
    const step: StepData = {
      ...data,
      id: `${key}-1`,
      stepNumber: 1,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    } as unknown as StepData;
    const strip = [start, ...bakeReversals([step])];
    emitSequence({
      strip,
      word: cellDef?.label ?? data.letter ?? id,
      key,
      propType: state.propType,
    });
  }

  // Register this page's cell-select handler so a consumed guide-scan intent
  // (see guide-scan-intent.ts) can fire a cell by id, reproducing what a tap
  // would do. The handler is sheet-agnostic (CELLS_BY_ID + state cover both
  // sheets), so with both codex pages mounted in the reader, whichever registers
  // last can still animate any cell. Only the interactive branch registers
  // (print/book never do — state is null there).
  onMount(() => {
    if (state) registerCodexCellTrigger((id) => handleCellSelect(id));
    return () => registerCodexCellTrigger(null);
  });
</script>

{#if printMode || !state}
  <!-- Faithful print/book branch — the static Double-Staff sheet, identical
       content the /guide/codex route renders. -->
  <div class="codex-page">
    <CodexSheet {sheet} embed />
  </div>
{:else}
  <!-- Interactive reader branch — the SAME sheet layout, live: prop/visibility/
       transform state comes from the shared singleton; controls live in the
       companion (GuideCodexControls.svelte), never here. One sheet fits one
       page frame, so no nested scroll is needed. -->
  <div class="codex-page">
    <CodexSheet
      {sheet}
      embed
      propType={state.propType}
      visibility={state.visibility}
      getData={(id) => state.dataFor(id)}
      onCellSelect={handleCellSelect}
    />
  </div>
{/if}

<style>
  /* Reserve the top zone for the page's calligraphic manifest title ("Codex"),
     which GuidePage paints as an absolute overlay (top:16px, height:64px). The
     sheet content would otherwise start at the page top and collide with it. */
  .codex-page {
    width: 100%;
    padding-top: 96px;
    box-sizing: border-box;
  }
</style>

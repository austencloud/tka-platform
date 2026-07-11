<script lang="ts">
  /**
   * GuideCodexPage — body page (manifest `codex`), guide/codex merge, REBUILT
   * (2026-07-10, docs/superpowers/specs/2026-07-10-guide-codex-rebuild-design.md
   * — rebuild of the rejected Explorer-style attempt from
   * docs/superpowers/specs/2026-07-10-guide-codex-merge-design.md).
   *
   * The page itself IS the printable codex — visually identical to the static
   * /guide/codex sheets (white paper, CodexSheet/CodexBox/CodexCell, grouped by
   * type, no gray backgrounds, no on-page controls). It serves print AND the
   * interactive reader with the exact same layout.
   *
   * Every control (prop family, layer visibility, rotate/mirror/color-swap)
   * lives in the companion panel (GuideCodexControls.svelte, composed by
   * GuideCompanion when the reader's active page is this one) — never on the
   * page. Both this page and the controls read/write one shared singleton,
   * guide-codex-state.svelte.ts, so a control change re-renders the sheet live.
   *
   * PRINT/BOOK SEAM: /print and /book share this exact manifest + BUILT
   * registry with the reader — this component discriminates via the
   * sequence-click context (only the reader provides it; print/book render the
   * plain static sheets, no live state, no clickable cells — same trick as the
   * previous attempt, `getGuidePrintMode() && emitSequence === null`).
   *
   * Guide overrides do NOT apply here — the dataset is canonical. Clicking a
   * cell does not set a stripKey, so the companion's admin edit row stays
   * hidden for codex cells (unchanged from the previous attempt).
   */
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { createMotionData, type MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { getGuideSequenceClick, getGuidePrintMode } from "../_data/guide-data-context";
  import { bakeReversals } from "../_data/guide-sequence-adapter";
  import { getGuideCodexState, codexDataZeroTurns } from "../_data/guide-codex-state.svelte";
  import CodexSheet from "../../codex/_components/CodexSheet.svelte";
  import { SHEET1, SHEET2, type CodexCellDef } from "../../codex/_data/codex-groups";

  const emitSequence = getGuideSequenceClick();
  // The reader ALSO sets guide print mode (print STYLE + eager pictographs), so
  // getGuidePrintMode() can't tell reader from /print,/book. The sequence-click
  // context can: only the reader provides it. Interactive there; static
  // (and print-identical) sheets everywhere else.
  const printMode = getGuidePrintMode() && emitSequence === null;

  const state = printMode ? null : getGuideCodexState();

  // Flat lookup from cell id -> its CodexCellDef, so the click handler can read
  // the human label (`W-`, `Σ`, `α`…) without re-deriving it from the raw id.
  const CELLS_BY_ID: Map<string, CodexCellDef> = new Map(
    [SHEET1, SHEET2].flatMap((sheet) =>
      sheet.types.flatMap((type) => type.boxes.flatMap((box) => box.cells.map((c) => [c.id, c] as const)))
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

  function handleCellSelect(id: string) {
    if (!emitSequence || !state) return;
    const data = state.dataFor(id);
    if (!data) return;
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
</script>

{#if printMode || !state}
  <!-- Faithful print/book branch — the static Double-Staff sheets (Types 1-6),
       identical content the /guide/codex route renders. -->
  <div class="codex-print">
    <div class="codex-print-sheet">
      <CodexSheet sheet={SHEET1} embed getData={codexDataZeroTurns} />
    </div>
    <div class="codex-print-sheet page-break">
      <CodexSheet sheet={SHEET2} embed getData={codexDataZeroTurns} />
    </div>
  </div>
{:else}
  <!-- Interactive reader branch — the SAME sheet layout, live: prop/visibility/
       transform state comes from the shared singleton; controls live in the
       companion (GuideCodexControls.svelte), never here.

       Two full letter-sized sheets are naturally taller than the reader's one
       fixed page frame (each manifest id maps to one such frame — see
       GuideReader.svelte / GuidePage.svelte, "authored to fit one page").
       Rather than let the frame's overflow:hidden silently clip the second
       sheet, the sheet stack scrolls INSIDE its own frame — same technique
       the previous Explorer draft used for its picker/variation panes. -->
  <div class="codex-reader">
    <div class="codex-reader-scroll themed-scrollbar">
      <div class="codex-reader-sheet">
        <CodexSheet
          sheet={SHEET1}
          embed
          propType={state.propType}
          visibility={state.visibility}
          getData={(id) => state.dataFor(id)}
          onCellSelect={handleCellSelect}
        />
      </div>
      <div class="codex-reader-sheet">
        <CodexSheet
          sheet={SHEET2}
          embed
          propType={state.propType}
          visibility={state.visibility}
          getData={(id) => state.dataFor(id)}
          onCellSelect={handleCellSelect}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .codex-print {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .codex-print-sheet {
    padding-top: 0.6in;
  }
  .codex-print-sheet.page-break {
    break-before: page;
  }

  /* Reader frame: a fixed budget (the 1056px page-fixed frame minus GuidePage's
     own 0.6in top/bottom body padding), with room reserved up top for
     GuidePage's absolute .guide-title overlay ("Codex"). Everything below
     scrolls in .codex-reader-scroll — the frame itself never overflows. */
  .codex-reader {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 940px;
    padding-top: 90px;
    box-sizing: border-box;
  }
  .codex-reader-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .codex-reader-sheet {
    padding-top: 0.3in;
  }
</style>

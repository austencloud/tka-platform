/**
 * Sheet row planner.
 *
 * Lays an ordered list of sequences out as one CONTINUOUS flow of cells for a
 * choreo sheet: every step of every sequence is placed left-to-right, `columns`
 * per row, wrapping straight into the next row — the next sequence begins in the
 * very next cell, not on a fresh row. A 12-count then an 8-count at 8 columns
 * fills row 1 (8), row 2 cells 1-4 (seq 1 tail) + cells 5-8 (seq 2 head), etc.
 * Only the final row is padded with blank cells to square off the grid.
 *
 * Each cell carries its `sequenceId` and whether it's the first cell of its
 * sequence (`isSequenceStart`) — a sequence's run can begin mid-row, so
 * selection highlighting and break/separator marks are per-cell, not per-row.
 *
 * Preview and PDF both consume this output, so layout is identical in both.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { ChoreoSheetLayout } from "../domain/types/choreo-sheet";
import type { SheetPageGeometry } from "../domain/sheet-page-layout";
import { bandKey, type CueMark, type NoteMark, type BandKey } from "../domain/types/choreo-sheet";

export interface SheetCell {
  step: StepData | null;
  isBlank: boolean;
  /** Owning sequence id, or null for a trailing blank pad cell. */
  sequenceId: string | null;
  /** True for the first cell of a sequence's run in the flow. */
  isSequenceStart: boolean;
}
export interface SheetRow {
  cells: SheetCell[];
}
export interface SheetPage {
  rows: SheetRow[];
}

export function planSheet(
  seqs: readonly SequenceData[],
  layout: ChoreoSheetLayout
): SheetPage[] {
  const { columns, rowsPerPage } = layout;

  // 1. Flatten every sequence's steps into one continuous cell stream.
  const cells: SheetCell[] = [];
  for (const seq of seqs) {
    seq.steps.forEach((step, i) => {
      cells.push({
        step,
        isBlank: false,
        sequenceId: seq.id,
        isSequenceStart: i === 0,
      });
    });
  }

  if (cells.length === 0) return [];

  // 2. Pad only the final row up to a full width, so the grid squares off.
  const remainder = cells.length % columns;
  if (remainder !== 0) {
    for (let i = remainder; i < columns; i++) {
      cells.push({ step: null, isBlank: true, sequenceId: null, isSequenceStart: false });
    }
  }

  // 3. Chunk into rows of `columns`, paginate every `rowsPerPage` rows.
  const pages: SheetPage[] = [];
  let rows: SheetRow[] = [];
  for (let i = 0; i < cells.length; i += columns) {
    rows.push({ cells: cells.slice(i, i + columns) });
    if (rows.length === rowsPerPage) {
      pages.push({ rows });
      rows = [];
    }
  }
  if (rows.length) pages.push({ rows });
  return pages;
}

export interface SheetBand {
  key: BandKey;
  sequenceId: string;
  rowInSequence: number;
  cells: SheetCell[]; // ≤ columns; short last row NOT cross-padded
  cue: CueMark | null;
  notes: NoteMark[];
  isSequenceStart: boolean;
  firstBeatIndex: number; // running step index across the sheet, for BPM prefill
  heightPt: number;
}
export interface SheetBandPage {
  bands: SheetBand[];
  pageIndex: number;
}
export interface BandPlanInput {
  sequences: readonly SequenceData[];
  geo: SheetPageGeometry;
  cues: readonly CueMark[];
  notes: readonly NoteMark[];
}

// Base band height: pictograph row + note strip + inter-band gutter. Grows in
// half-line steps when a strip holds a full-width bullet + pinned rows that would
// exceed one line; kept simple here (bullets and pins each cost one line).
function estimateBandHeight(geo: SheetPageGeometry, notes: NoteMark[]): number {
  const noteLines = notes.length === 0 ? 0 : Math.max(1, notes.length);
  const stripHeight = geo.stripBaseHeightPt > 0 ? Math.max(geo.stripBaseHeightPt, noteLines * geo.stripBaseHeightPt) : 0;
  return geo.cellSizePt + stripHeight + geo.interBandGutterPt;
}

export function planBands(input: BandPlanInput): SheetBandPage[] {
  const { sequences, geo, cues, notes } = input;
  const columns = geo.columns;
  const cueByBand = new Map(cues.map((c) => [c.band, c]));
  const notesByBand = new Map<BandKey, NoteMark[]>();
  for (const n of notes) {
    const list = notesByBand.get(n.band) ?? [];
    list.push(n);
    notesByBand.set(n.band, list);
  }

  // 1. Row-aligned bands: each sequence chunked into rows of `columns`.
  const bands: SheetBand[] = [];
  let beatIndex = 0;
  for (const seq of sequences) {
    const steps = seq.steps ?? [];
    for (let row = 0, s = 0; s < steps.length; row++, s += columns) {
      const slice = steps.slice(s, s + columns);
      const key = bandKey(seq.id, row);
      const bandNotes = notesByBand.get(key) ?? [];
      const cells: SheetCell[] = slice.map((step, i) => ({
        step,
        isBlank: false,
        sequenceId: seq.id,
        isSequenceStart: row === 0 && i === 0,
      }));
      bands.push({
        key,
        sequenceId: seq.id,
        rowInSequence: row,
        cells,
        cue: cueByBand.get(key) ?? null,
        notes: bandNotes,
        isSequenceStart: row === 0,
        firstBeatIndex: beatIndex + s,
        heightPt: estimateBandHeight(geo, bandNotes),
      });
    }
    beatIndex += steps.length;
  }

  // 2. Height-packed pagination.
  const pages: SheetBandPage[] = [];
  let current: SheetBand[] = [];
  let used = 0;
  let pageIndex = 0;
  for (const band of bands) {
    if (current.length > 0 && used + band.heightPt > geo.usableHeightPt) {
      pages.push({ bands: current, pageIndex: pageIndex++ });
      current = [];
      used = 0;
    }
    current.push(band);
    used += band.heightPt;
  }
  if (current.length) pages.push({ bands: current, pageIndex: pageIndex++ });
  return pages;
}

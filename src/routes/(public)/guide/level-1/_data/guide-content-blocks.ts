/**
 * The single-source content model for a Level-1 guide page. ONE `GuideBlock[]`
 * per migrated page is rendered by BOTH frames: SheetFrame positions each block
 * at its `sheet` pt hint (print-faithful), FlowFrame ignores the hint and stacks
 * blocks in reading order (mobile, crawlable). Spec:
 * docs/superpowers/specs/2026-07-14-guide-reflow-single-source-design.md.
 *
 * pt = the proof PDF's own points; the sheet is 612pt × 792pt (8.5×11in), and
 * SheetFrame multiplies by S = 816/612 to reach the 816×1056px on-screen sheet.
 */
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

/** A block's position on the print sheet, in PDF points. Only SheetFrame reads it. */
export type PtHint = {
  x: number;
  y: number;
  /** Width in pt (text wrap / element width). Optional — full-width prose omits it. */
  w?: number;
  /** Height in pt (drives font-size for text runs on the sheet). */
  h?: number;
  /** Font size in pt for prose/heading runs (sheet only; flow uses editorial sizing). */
  fontSize?: number;
  /** Line height in pt for multi-line prose runs (sheet only). */
  lineHeight?: number;
  /** Horizontal alignment on the sheet; defaults to "center". */
  align?: "left" | "center" | "right";
};

/** Grid geometry for a pictograph group on the sheet (e.g. the 16 positions). */
export type SheetGrid = {
  /** Left x of each column, in pt. */
  cols: number[];
  /** Top y of each row, in pt. */
  rows: number[];
  /** Square cell size in pt. */
  cell: number;
  /** Row index per item, parallel to `items`. */
  rowFor: number[];
};

export type GuideBlock =
  | { kind: "heading"; level: 1 | 2 | 3; text: string; sheet?: PtHint }
  | { kind: "prose"; html: string; sheet?: PtHint }
  | { kind: "glyphImage"; src: string; alt: string; heightPt: number; sheet?: PtHint }
  | { kind: "rule"; sheet: PtHint }
  | { kind: "pictograph"; data: PictographData; caption?: string; sheet?: PtHint }
  | {
      kind: "pictographGroup";
      /** Real pictographs, in reading order. */
      items: PictographData[];
      /** Optional per-group caption for the flow list. */
      caption?: string;
      /** Sheet grid geometry (SheetFrame lays the items out with this). */
      grid?: SheetGrid;
      /** Flow layout: responsive column count for FlowFrame. */
      flowCols?: number;
      sheet?: PtHint;
    }
  | {
      /** Bespoke print artifact (flattened raster / measured vector). Sheet renders
       *  `sheetHtml`; flow renders the semantic `flow` fallback. */
      kind: "printOnly";
      sheetHtml: string;
      flow: GuideBlock[];
      sheet: PtHint;
    };

/** Concatenated human-readable text of a page's prose + headings — the drift-guard
 *  input. Strips HTML tags so `<strong>`/`<span>` markup doesn't affect equality. */
export function blockProseText(blocks: GuideBlock[]): string {
  const strip = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") out.push(strip(b.text));
    else if (b.kind === "prose") out.push(strip(b.html));
    else if (b.kind === "printOnly") out.push(blockProseText(b.flow));
  }
  return out.filter(Boolean).join(" ");
}

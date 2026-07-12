import { SHEET1, SHEET2, type CodexSheetDef } from "../../codex/_data/codex-groups";

/** The Codex page is the universal hub — the living index of all base letters. */
export const GUIDE_CODEX_SLUG = "codex";

export interface GuideContentTarget {
  /** Guide page slug (manifest id). */
  slug: string;
  /** Codex cell id to highlight/animate, when the content is a single letter. */
  cellKey?: string;
}

// label ("A", "Σ", "W-") → { slug: "codex", cellKey: <codex id> }, built from
// the Codex sheets so this can never drift from the letters the codex renders.
// Enriched later per chapter by repointing specific labels to their chapter page.
const LABEL_TO_TARGET: Map<string, GuideContentTarget> = new Map(
  [SHEET1, SHEET2].flatMap((sheet: CodexSheetDef) =>
    sheet.types.flatMap((type) =>
      type.boxes.flatMap((box) =>
        box.cells.map(
          (cell) =>
            [cell.label, { slug: GUIDE_CODEX_SLUG, cellKey: cell.id }] as const
        )
      )
    )
  )
);

/** Guide destination for a single base letter (label as shown on cards/codex). */
export function guideTargetForLetter(label: string): GuideContentTarget | null {
  return LABEL_TO_TARGET.get(label) ?? null;
}

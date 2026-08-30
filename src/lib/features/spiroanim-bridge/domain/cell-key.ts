/**
 * The cellKey — the shared identity contract between SpiroAnim and the
 * Composer. SpiroAnim emits it in a link; `/from/spiroanim/<cellKey>` resolves
 * it back to the transcribed sequence.
 *
 * Grammar:
 *
 *   <concept>.<reference>.<ratio>.<shape>.<variant>
 *
 * - concept:   vtg | qtr | 8stp
 * - reference: vtg/qtr `[1-6]-[1-6]`; 8stp `[1-8]-(aa|ae|ai|ea|ee|ei|ia|ie|ii)`
 *              (his data spells the 8-step rows uppercase — `1-AA`; the key
 *              lowercases at the boundary so one spelling crosses the wire)
 * - ratio:     1x1 | 1x3 | 1x5 (`x` stands in for `:`, which a path segment
 *              cannot carry cleanly). 8stp has no speed-ratio axis and is
 *              always `1x1`.
 * - shape:     diamond | box
 * - variant:   base | anti  (anti ⇔ `isAnti: true` in the transcription)
 *
 * Two rules keep the contract durable across independent releases of the two
 * apps: the key is all-lowercase, and dot-separated fields beyond the fifth are
 * IGNORED rather than rejected, so a future SpiroAnim may append an axis
 * without breaking every existing Composer build. Anything malformed returns
 * null — the route shows an honest "no bridge entry" card. Never a guess.
 */

export type BridgeConcept = "vtg" | "qtr" | "8stp";
export type BridgeShape = "diamond" | "box";
export type BridgeSpeedRatio = "1:1" | "1:3" | "1:5";

export interface ParsedCellKey {
  concept: BridgeConcept;
  /** Lowercase, e.g. "1-1" (vtg/qtr) or "1-aa" (8stp). */
  reference: string;
  speedRatio: BridgeSpeedRatio;
  shape: BridgeShape;
  isAnti: boolean;
}

const VTG_REFERENCE = /^[1-6]-[1-6]$/;
const EIGHT_STEP_REFERENCE = /^[1-8]-(aa|ae|ai|ea|ee|ei|ia|ie|ii)$/;

const RATIOS: Record<string, BridgeSpeedRatio> = {
  "1x1": "1:1",
  "1x3": "1:3",
  "1x5": "1:5",
};

function isConcept(value: string): value is BridgeConcept {
  return value === "vtg" || value === "qtr" || value === "8stp";
}

export function parseCellKey(raw: string): ParsedCellKey | null {
  if (typeof raw !== "string" || raw !== raw.toLowerCase()) return null;

  const parts = raw.split(".");
  if (parts.length < 5) return null;

  // Extra fields beyond the fifth are deliberately ignored (forward compat).
  const [concept, reference, ratio, shape, variant] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (!isConcept(concept)) return null;

  const referenceOk =
    concept === "8stp"
      ? EIGHT_STEP_REFERENCE.test(reference)
      : VTG_REFERENCE.test(reference);
  if (!referenceOk) return null;

  const speedRatio = RATIOS[ratio];
  if (!speedRatio) return null;
  // 8stp carries no speed-ratio axis; a non-1x1 key for it is a wrong key, not
  // a key for some other cell.
  if (concept === "8stp" && ratio !== "1x1") return null;

  if (shape !== "diamond" && shape !== "box") return null;
  if (variant !== "base" && variant !== "anti") return null;

  return {
    concept,
    reference,
    speedRatio,
    shape,
    isAnti: variant === "anti",
  };
}

export function formatCellKey(cell: {
  concept: BridgeConcept;
  reference: string;
  speedRatio: string;
  shape: string;
  isAnti: boolean;
}): string {
  const ratio =
    cell.concept === "8stp" ? "1x1" : cell.speedRatio.replace(":", "x");
  return [
    cell.concept,
    cell.reference.toLowerCase(),
    ratio,
    cell.shape,
    cell.isAnti ? "anti" : "base",
  ].join(".");
}

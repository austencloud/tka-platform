/**
 * The cellKey — the shared identity contract between SpiroAnim and the
 * Composer. SpiroAnim emits it in a link; `/from/spiroanim/<cellKey>` resolves
 * it back to the transcribed sequence.
 *
 * Grammar:
 *
 *   <concept>.<reference>.<ratio>.<shape>.<variant>[.o<degrees>]
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
 * - o<degrees>: optional pattern orientation — SpiroAnim's "Pattern rotation"
 *              angle, one of o-90 | o-45 | o0 | o45 | o90 | o180. Position in
 *              the trailing fields does not matter; the `o` prefix identifies
 *              it. vtg/qtr only: 8stp has no orientation axis, so any `o` token
 *              on an 8stp key is a foreign field and is ignored like the rest.
 *              A key WITHOUT the token means "whatever SpiroAnim shows by
 *              default", which is 0 for every bridged ratio — NOT the -90 the
 *              transcription was captured at (see orientation-rotation.ts).
 *
 * Two rules keep the contract durable across independent releases of the two
 * apps: the key is all-lowercase, and unrecognised dot-separated fields beyond
 * the fifth are IGNORED rather than rejected, so a future SpiroAnim may append
 * an axis without breaking every existing Composer build. A RECOGNISED trailing
 * field is parsed strictly: an `o` token with a value outside the set above is
 * a wrong coordinate, not an unknown axis, and fails the parse. Anything
 * malformed returns null — the route shows an honest "no bridge entry" card.
 * Never a guess.
 */

export type BridgeConcept = "vtg" | "qtr" | "8stp";
export type BridgeShape = "diamond" | "box";
export type BridgeSpeedRatio = "1:1" | "1:3" | "1:5";

/** SpiroAnim's pattern-orientation axis (its "Pattern rotation" control). */
export const SPIROANIM_ORIENTATIONS = [-90, -45, 0, 45, 90, 180] as const;
export type SpiroAnimOrientation = (typeof SPIROANIM_ORIENTATIONS)[number];

function isSpiroAnimOrientation(value: number): value is SpiroAnimOrientation {
  return (SPIROANIM_ORIENTATIONS as readonly number[]).includes(value);
}

export interface ParsedCellKey {
  concept: BridgeConcept;
  /** Lowercase, e.g. "1-1" (vtg/qtr) or "1-aa" (8stp). */
  reference: string;
  speedRatio: BridgeSpeedRatio;
  shape: BridgeShape;
  isAnti: boolean;
  /**
   * The orientation the key carries, or null when it carries none (an older
   * link, or 8stp — which has no orientation axis). Null does NOT mean the
   * transcription baseline; it means SpiroAnim's default view. The resolver
   * owns that distinction.
   */
  orientation: SpiroAnimOrientation | null;
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

  // Unrecognised fields beyond the fifth are deliberately ignored (forward
  // compat); recognised ones are parsed strictly below.
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

  let orientation: SpiroAnimOrientation | null = null;
  // 8stp has no orientation axis: an `o` token there is a foreign field and is
  // ignored, matching what every already-deployed build does with it.
  if (concept !== "8stp") {
    for (const field of parts.slice(5)) {
      const token = /^o(-?\d{1,3})$/.exec(field);
      if (!token) continue;
      const value = Number(token[1]);
      // A second orientation token, or a value outside the axis, is a wrong
      // coordinate — fail the parse rather than picking one.
      if (orientation !== null || !isSpiroAnimOrientation(value)) return null;
      orientation = value;
    }
  }

  return {
    concept,
    reference,
    speedRatio,
    shape,
    isAnti: variant === "anti",
    orientation,
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

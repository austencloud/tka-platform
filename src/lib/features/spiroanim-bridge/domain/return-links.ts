/**
 * The trip back: cellKey → the SpiroAnim player URL for the same cell.
 *
 * Two vendored maps, because his query codec is version-aware and the two
 * catalogues were exported at different versions:
 *
 * - `vtg-qtr-deep-links.json` — keyed by cellKey, generated with his CURRENT
 *   codec (v11) and round-tripped through his own decoder before export.
 * - `eightstep-deep-links.json` — the legacy 8-Step export, keyed by his
 *   uppercase row label (`"1-AA"`) and encoded at v6. His decoder still reads
 *   v6, so these stay as they are rather than being re-encoded here; TKA has no
 *   copy of the codec and guessing one would produce links that look right and
 *   open the wrong animation.
 *
 * Both catalogues are diamond-only, and the 8-Step catalogue has no anti
 * variant. A cell with no link simply has no link: the route omits the button.
 * Never a guessed or constructed URL.
 */

import { formatCellKey, type ParsedCellKey } from "./cell-key";

/** cellKey → player URL (vtg/qtr), or uppercase row label → player URL (8stp). */
export type DeepLinkMap = Readonly<Record<string, string>>;

export interface ReturnLinkSources {
  /** Contents of `docs/research/spiroanim/vtg-qtr-deep-links.json`. */
  vtgQtr?: DeepLinkMap | null;
  /** Contents of `docs/research/spiroanim/eightstep-deep-links.json`. */
  eightStep?: DeepLinkMap | null;
}

const PLAYER_PREFIX = "https://spiroanim.com/player?";

/**
 * A vendored value only becomes a link if it actually is one. A malformed entry
 * is treated as a missing entry rather than rendered as an anchor.
 */
function asPlayerUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(PLAYER_PREFIX)
    ? value
    : null;
}

export function getReturnLink(
  key: ParsedCellKey,
  sources: ReturnLinkSources
): string | null {
  if (key.concept === "8stp") {
    // His 8-Step export covers the diamond base cells only.
    if (key.shape !== "diamond" || key.isAnti) return null;
    return asPlayerUrl(sources.eightStep?.[key.reference.toUpperCase()]);
  }

  return asPlayerUrl(sources.vtgQtr?.[formatCellKey(key)]);
}

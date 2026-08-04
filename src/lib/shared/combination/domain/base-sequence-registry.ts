/**
 * The base-sequence registry: the ingredient vocabulary of the combination
 * engine's ambient layer.
 *
 * Confirmed entries carry `LetterEdge[]` grounded in the canonical diamond
 * dataframe (`static/data/pictographs/DiamondPictographDataframe.csv`) —
 * verified directly against it in `tests/unit/combination/base-sequence-registry.test.ts`
 * (per `verify-at-canonical-source.md`). Unconfirmed entries are names-only
 * placeholders awaiting Austen's full 19-base roster review; they carry
 * `edges: null` and are NEVER eligible as ambient material until promoted.
 */

import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { LetterEdge } from "../services/letter-calculus";

const A = GridPositionGroup.ALPHA;
const B = GridPositionGroup.BETA;
const G = GridPositionGroup.GAMMA;

const edge = (
  letter: Letter,
  from: GridPositionGroup,
  to: GridPositionGroup
): LetterEdge => ({ letter, from, to });

export interface BaseSequenceEntry {
  /** Smallest repeating word ("GG" not "GGGG" — display simplification is
   * word-simplifier's job; Layer 0 emits primitive forms separately). */
  readonly word: string;
  readonly edges: readonly LetterEdge[] | null;
  /** Edge data grounded in the canonical dataframe. Unconfirmed entries are
   * names-only placeholders awaiting Austen's roster review (his count: 19
   * base sequences; the promotions ΦΨ / WΣYθ / XΔZΩ are from the
   * 2026-08-04 design conversation). */
  readonly confirmed: boolean;
  readonly note: string;
}

export const BASE_SEQUENCES: readonly BaseSequenceEntry[] = [
  {
    word: "AA",
    edges: [edge(Letter.A, A, A)],
    confirmed: true,
    note: "pro/pro alpha cycle",
  },
  {
    word: "BB",
    edges: [edge(Letter.B, A, A)],
    confirmed: true,
    note: "anti/anti alpha cycle",
  },
  {
    word: "GG",
    edges: [edge(Letter.G, B, B)],
    confirmed: true,
    note: "pro/pro beta cycle",
  },
  {
    word: "HH",
    edges: [edge(Letter.H, B, B)],
    confirmed: true,
    note: "anti/anti beta cycle",
  },
  {
    word: "DJ",
    edges: [edge(Letter.D, B, A), edge(Letter.J, A, B)],
    confirmed: true,
    note: "β↔α compound (MCP)",
  },
  {
    word: "EK",
    edges: [edge(Letter.E, B, A), edge(Letter.K, A, B)],
    confirmed: true,
    note: "β↔α compound (MCP)",
  },
  {
    word: "FL",
    edges: [edge(Letter.F, B, A), edge(Letter.L, A, B)],
    confirmed: true,
    note: "β↔α compound (MCP)",
  },
  {
    word: "ΦΨ",
    edges: [edge(Letter.PHI, B, A), edge(Letter.PSI, A, B)],
    confirmed: true,
    note: "dash cycle; promoted to first-class base 2026-08-04",
  },
  {
    word: "MP",
    edges: [edge(Letter.M, G, G), edge(Letter.P, G, G)],
    confirmed: true,
    note: "gamma compound (MCP)",
  },
  {
    word: "NQ",
    edges: [edge(Letter.N, G, G), edge(Letter.Q, G, G)],
    confirmed: true,
    note: "gamma compound (MCP)",
  },
  {
    word: "OR",
    edges: [edge(Letter.O, G, G), edge(Letter.R, G, G)],
    confirmed: true,
    note: "gamma compound (MCP)",
  },
  {
    word: "CC",
    edges: null,
    confirmed: false,
    note: "awaiting roster review",
  },
  {
    word: "II",
    edges: null,
    confirmed: false,
    note: "awaiting roster review",
  },
  {
    word: "WΣYθ",
    edges: null,
    confirmed: false,
    note: "Austen-promoted base; per-letter edges unconfirmed",
  },
  {
    word: "XΔZΩ",
    edges: null,
    confirmed: false,
    note: "Austen-promoted base; per-letter edges unconfirmed",
  },
];

export function confirmedBases(): BaseSequenceEntry[] {
  return BASE_SEQUENCES.filter((b) => b.confirmed);
}

/** Bases the combinator may draw ambient material from. */
export function ambientEligibleBases(): BaseSequenceEntry[] {
  return confirmedBases();
}

/** Letters available as ambient material (for option filtering). */
export function ambientLetterSet(): Set<string> {
  const letters = new Set<string>();
  for (const base of ambientEligibleBases())
    for (const e of base.edges ?? []) letters.add(e.letter);
  return letters;
}

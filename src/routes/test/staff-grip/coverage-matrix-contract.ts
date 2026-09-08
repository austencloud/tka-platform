/**
 * The seam a coverage matrix plugs into.
 *
 * A separate sweep engine is being built at `src/lib/shared/3d/diagnostics/`.
 * It walks character x prop x sequence and returns one metric bundle per
 * configuration. This shell deliberately does NOT import it: the shell has to
 * build and ship before that engine exists, and a lab that hard-depends on an
 * in-flight module cannot.
 *
 * So the contract lives here, on the consuming side, expressed in plain data.
 * When the engine lands, wiring is three steps and no shell surgery:
 *
 *   1. Adapt the engine's result to `CoverageMatrix` below. Nothing in this
 *      file names an engine symbol, so the adapter is the only new code.
 *   2. Pass it to the page as `coverageMatrix`, which forwards it to
 *      `CoverageMatrixMount`.
 *   3. Nothing else. The mount already renders cells, groups them, and turns
 *      each one into a lab URL, so clicking a failing configuration opens this
 *      same lab already set to it.
 *
 * Keep this file free of engine imports. It is the boundary, not a re-export.
 */

/** How a configuration came out. `pending` is a cell the sweep has not run. */
export type CoverageStatus = "pass" | "warn" | "fail" | "pending";

/** One character x prop x sequence configuration and how it scored. */
export interface CoverageCell {
  characterId: string;
  /** A `PropType` value, as it appears in the URL's `prop` param. */
  prop: string;
  /** A fixture id or a library sequence id, as it appears in `seq`. */
  sequenceId: string;
  /** The frame the sweep judged, in the same units as the `phase` param. */
  phase: number;
  status: CoverageStatus;
  /**
   * Whatever the sweep chose to report — deepest collision, axis error, the
   * prop-length overshoot. Rendered as a label/value list, so the shell needs
   * no schema and gains no coupling to the engine's metric set.
   */
  metrics?: Readonly<Record<string, number | null>>;
  /** One line explaining a warn or a fail. */
  note?: string;
}

export interface CoverageMatrix {
  /** Row axis, in the order the sweep walked it. */
  characterIds: readonly string[];
  /** Column axis. */
  props: readonly string[];
  /** Which sequence this slice of the sweep covers. */
  sequenceId: string;
  cells: readonly CoverageCell[];
  /** When the sweep ran, so a stale matrix reads as stale. */
  generatedAt?: string;
}

/**
 * Build the lab URL that reproduces a cell. This is the whole reason the lab's
 * state lives in the URL: a sweep result is only actionable if a failing row
 * opens the inspection rig already set to that body, prop and frame.
 */
export function coverageCellHref(
  cell: CoverageCell,
  base = "/test/staff-grip"
): string {
  const params = new URLSearchParams({
    character: cell.characterId,
    prop: cell.prop,
    seq: cell.sequenceId,
    phase: cell.phase.toFixed(2),
    play: "0",
    view: "quad",
    panel: "fit",
  });
  return `${base}?${params.toString()}`;
}

export function findCoverageCell(
  matrix: CoverageMatrix,
  characterId: string,
  prop: string
): CoverageCell | undefined {
  return matrix.cells.find(
    (cell) => cell.characterId === characterId && cell.prop === prop
  );
}

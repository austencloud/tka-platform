/**
 * ArrangeBeatCalculator - Polyrhythmic beat calculation
 *
 * Uses GCD/LCM to compute how many beats are needed for all layers
 * in a cell (and across all visible cells) to complete their cycles simultaneously.
 */

import type { IArrangeBeatCalculator } from "../contracts/IArrangeBeatCalculator";
import type { GridCell } from "../../state/arrange-grid-state.svelte";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

export class ArrangeBeatCalculator implements IArrangeBeatCalculator {
  calculateCellBeats(cell: GridCell, skipStartPosition: boolean): number {
    if (cell.layers.length === 0) return 0;

    const beatCounts = cell.layers.map((layer) => {
      const stepCount = layer.sequence.steps?.length || 1;
      return skipStartPosition ? stepCount : stepCount + 1;
    });

    const firstCount = beatCounts[0];
    if (firstCount === undefined) return 1;
    return beatCounts.reduce((acc, count) => lcm(acc, count), firstCount);
  }

  calculateTotalBeats(
    cells: GridCell[],
    skipStartPosition: boolean,
    rows: number,
    cols: number
  ): number {
    const visibleWithLayers = cells.filter(
      (c) => c.row < rows && c.col < cols && c.layers.length > 0
    );
    if (visibleWithLayers.length === 0) return 0;

    const beatCounts = visibleWithLayers.map((cell) =>
      this.calculateCellBeats(cell, skipStartPosition)
    );
    const firstCount = beatCounts[0];
    if (firstCount === undefined) return 0;
    return beatCounts.reduce((acc, count) => lcm(acc, count), firstCount);
  }
}

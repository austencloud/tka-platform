import { hashString } from "$lib/shared/foundation/services/content-hasher";
import type { MandalaPaths, MandalaPoint, SVGPathData } from "../domain/mandala-types";

/** Quantization grid in px. Coarse enough to absorb FP drift under rotation,
 *  fine enough to keep distinct glyphs apart. Tuned by the round-trip +
 *  rotation tests. */
export const QUANTIZE_GRID = 1;

/** Extract on-curve points from an SVG "d" string: the M start plus each C
 *  endpoint (control points excluded — they are not on the curve). */
export function parsePoints(d: string): MandalaPoint[] {
	const pts: MandalaPoint[] = [];
	const m = d.match(/^M\s+(-?[\d.]+)\s+(-?[\d.]+)/);
	if (m) pts.push({ x: parseFloat(m[1]!), y: parseFloat(m[2]!) });
	const c = /C\s+-?[\d.]+\s+-?[\d.]+,\s+-?[\d.]+\s+-?[\d.]+,\s+(-?[\d.]+)\s+(-?[\d.]+)/g;
	let mc: RegExpExecArray | null;
	while ((mc = c.exec(d)) !== null) {
		pts.push({ x: parseFloat(mc[1]!), y: parseFloat(mc[2]!) });
	}
	return pts;
}

function quantize(p: MandalaPoint): string {
	const qx = Math.round(p.x / QUANTIZE_GRID) * QUANTIZE_GRID;
	const qy = Math.round(p.y / QUANTIZE_GRID) * QUANTIZE_GRID;
	// -0 → 0 so signs never split a key.
	return `${qx + 0},${qy + 0}`;
}

/** Set of quantized "x,y" tokens for every on-curve point across the given
 *  path groups. A point drawn by two colors collapses to one token (Set). */
function quantizedTokenSet(...groups: readonly SVGPathData[][]): Set<string> {
	const tokens = new Set<string>();
	for (const group of groups) {
		for (const path of group) {
			for (const pt of parsePoints(path.d)) tokens.add(quantize(pt));
		}
	}
	return tokens;
}

/** Color-blind shape fingerprint: union of all blue/red/purple on-curve points,
 *  quantized, sorted, hashed. The primary equivalence key. */
export function shapeKey(p: MandalaPaths): string {
	const tokens = [...quantizedTokenSet(p.blue, p.red, p.purple)].sort();
	return hashString(tokens.join(";"));
}

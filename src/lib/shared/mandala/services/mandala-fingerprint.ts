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

export interface ColorSignature {
	blueOnly: boolean;
	redOnly: boolean;
	/** |blue∩red| / |blue∪red| over quantized points — the purple-overlap share. */
	comboPurpleRatio: number;
}

/** Which colors drew the glyph, and how much they overlap. Annotation only —
 *  never part of the primary shapeKey. */
export function colorSignature(p: MandalaPaths): ColorSignature {
	const blue = quantizedTokenSet(p.blue);
	const red = quantizedTokenSet(p.red);
	const hasBlue = blue.size > 0;
	const hasRed = red.size > 0;

	let inter = 0;
	for (const t of blue) if (red.has(t)) inter++;
	const union = blue.size + red.size - inter;
	const comboPurpleRatio = union === 0 ? 0 : inter / union;

	return {
		blueOnly: hasBlue && !hasRed,
		redOnly: hasRed && !hasBlue,
		comboPurpleRatio,
	};
}

const ROTATIONS = 8; // 45deg increments
const RAD_PER_STEP = Math.PI / 4;

function transformPath(d: string, rotSteps: number, reflect: boolean): SVGPathData {
	const pts = parsePoints(d);
	const cos = Math.cos(rotSteps * RAD_PER_STEP);
	const sin = Math.sin(rotSteps * RAD_PER_STEP);
	const out: MandalaPoint[] = pts.map(({ x, y }) => {
		const rx = reflect ? -x : x; // mirror across the y-axis before rotating
		const tx = rx * cos - y * sin;
		const ty = rx * sin + y * cos;
		return { x: tx, y: ty };
	});
	// Re-emit as an M + straight-segment "d" — only on-curve points matter for
	// the key, so a polyline encoding is sufficient and parsePoints-compatible.
	const head = out[0];
	if (!head) return { d: "", tipIndex: 0 };
	let s = `M ${head.x.toFixed(2)} ${head.y.toFixed(2)}`;
	for (let i = 1; i < out.length; i++) {
		const a = out[i - 1]!;
		const b = out[i]!;
		s += ` C ${a.x.toFixed(2)} ${a.y.toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}, ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
	}
	return { d: s, tipIndex: 0 };
}

function transformPaths(p: MandalaPaths, rotSteps: number, reflect: boolean): MandalaPaths {
	const t = (g: SVGPathData[]) => g.map((path) => transformPath(path.d, rotSteps, reflect));
	return { blue: t(p.blue), red: t(p.red), purple: t(p.purple) };
}

/** Rotation/reflection-invariant key: the lexicographic minimum shapeKey over
 *  all 8 rotations × {identity, mirror}. Members of one orbit share this key. */
export function orbitKey(p: MandalaPaths): string {
	let min: string | null = null;
	for (let r = 0; r < ROTATIONS; r++) {
		for (const reflect of [false, true]) {
			const k = shapeKey(transformPaths(p, r, reflect));
			if (min === null || k < min) min = k;
		}
	}
	return min ?? shapeKey(p);
}

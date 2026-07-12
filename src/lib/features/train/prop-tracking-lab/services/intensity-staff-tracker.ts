/**
 * IntensityStaffTracker — colorless LED-staff tracker for real footage.
 *
 * Reality check (2026-07-11, ALIΦ.mov): real LED staffs color-cycle (orange →
 * purple → blue → green …) and the whole shaft glows in segments, so the
 * fixed-color ColorEndTracker assumption ("sample blue, sample red once")
 * does not hold. What DOES hold in low-light footage:
 *   - LEDs are emissive: bright, high-saturation pixels on a dark scene.
 *   - Each staff is a COLLINEAR chain of glowing blobs (shaft segments +
 *     brighter end caps).
 *
 * Method per frame:
 *   1. Threshold: luminance above `lumaThreshold` OR strongly saturated color.
 *   2. Connected components (8-conn, same pattern as color-end-tracker.ts),
 *      keeping per-blob peak brightness; blobs below `peakMin` are treated as
 *      reflections (glowing clothing) and dropped.
 *   3. RANSAC 2-line fit over blob centroids (mass-weighted): the two highest
 *      total-mass collinear clusters = the two staffs.
 *   4. Per staff: mass-weighted PCA axis; endpoints = extreme projections.
 *   5. Temporal identity: staffs matched to the previous frame by centroid
 *      distance (2x2 assignment); endpoints labeled thumb/pinky by
 *      constant-velocity-predicted nearest assignment (2x2 Hungarian case),
 *      same approach proven in ColorEndTracker.
 *
 * Output shape reuses EndpointPair so the existing notation pipeline
 * (endpointPairToPose → framesToNotation) consumes it unchanged.
 */

import type { TrackConfidence } from '../domain/notation-3d';
import type { EndpointPair, PixelPoint } from './color-end-tracker';

export interface IntensityConfig {
	/** 0-255 luminance above which a pixel counts as lit. */
	lumaThreshold: number;
	/** Per-blob peak channel value required (emissive LED vs reflection). */
	peakMin: number;
	/** Minimum blob pixel count (speckle rejection). */
	minPixels: number;
	/** Max px distance from a candidate line for a blob to count as inlier. */
	lineTolerancePx: number;
	/** Max frames to coast identity through a lost staff. */
	maxCoastFrames: number;
	/**
	 * Max plausible projected staff length as a fraction of frame height.
	 * Kills two real-footage failure modes (verified on ALIΦ.mov): a line
	 * connecting the two staffs' tips ACROSS the body when they sit collinear,
	 * and lines that ride a motion-blur trail arc. Candidates longer than this
	 * are split at their largest projection gap and only the densest
	 * contiguous chain survives.
	 */
	maxStaffFrac: number;
	/** Max gap between consecutive blobs along an over-long line, as frame-height fraction. */
	maxGapFrac: number;
}

export const DEFAULT_INTENSITY_CONFIG: IntensityConfig = {
	lumaThreshold: 170,
	peakMin: 200,
	minPixels: 6,
	lineTolerancePx: 14,
	maxCoastFrames: 6,
	// Tuned against real footage (ALIΦ.mov sweep, 2026-07-11): 208/240 frames
	// with both staffs found and no cross-body/trail aliasing on inspection.
	maxStaffFrac: 0.45,
	maxGapFrac: 0.16,
};

export interface DetectedBlob {
	x: number;
	y: number;
	mass: number;
	peak: number;
}

export interface DetectedStaff {
	p0: PixelPoint;
	p1: PixelPoint;
	centroid: PixelPoint;
	angle: number;
	blobCount: number;
	mass: number;
	lengthPx: number;
}

export interface IntensityFrameResult {
	blobs: DetectedBlob[];
	staffs: DetectedStaff[];
	/** Pair per staff slot after temporal identity: [0] = first staff, [1] = second. Null = lost this frame. */
	pairs: [EndpointPair | null, EndpointPair | null];
}

export function detectBlobs(
	frame: ImageData,
	config: IntensityConfig = DEFAULT_INTENSITY_CONFIG,
): DetectedBlob[] {
	const { width: w, height: h, data } = frame;
	const mask = new Uint8Array(w * h);
	for (let i = 0, p = 0; i < w * h; i++, p += 4) {
		const r = data[p]!;
		const g = data[p + 1]!;
		const b = data[p + 2]!;
		const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		const mx = Math.max(r, g, b);
		const mn = Math.min(r, g, b);
		if (luma > config.lumaThreshold || (mx > 180 && mx - mn > 100)) mask[i] = 1;
	}
	const label = new Int32Array(w * h).fill(-1);
	const blobs: DetectedBlob[] = [];
	const stack: number[] = [];
	for (let i = 0; i < w * h; i++) {
		if (!mask[i] || label[i]! >= 0) continue;
		const id = blobs.length;
		let mass = 0;
		let sx = 0;
		let sy = 0;
		let peak = 0;
		stack.push(i);
		label[i] = id;
		while (stack.length) {
			const q = stack.pop()!;
			const x = q % w;
			const y = (q / w) | 0;
			mass++;
			sx += x;
			sy += y;
			const p = q * 4;
			const pl = Math.max(data[p]!, data[p + 1]!, data[p + 2]!);
			if (pl > peak) peak = pl;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx;
					const ny = y + dy;
					if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
					const n = ny * w + nx;
					if (mask[n] && label[n]! < 0) {
						label[n] = id;
						stack.push(n);
					}
				}
			}
		}
		if (mass >= config.minPixels && peak >= config.peakMin) {
			blobs.push({ x: sx / mass, y: sy / mass, mass, peak });
		}
	}
	return blobs;
}

function fitLine(blobs: DetectedBlob[]): DetectedStaff {
	let m = 0;
	let mx = 0;
	let my = 0;
	for (const b of blobs) {
		m += b.mass;
		mx += b.x * b.mass;
		my += b.y * b.mass;
	}
	mx /= m;
	my /= m;
	let sxx = 0;
	let sxy = 0;
	let syy = 0;
	for (const b of blobs) {
		const dx = b.x - mx;
		const dy = b.y - my;
		sxx += b.mass * dx * dx;
		sxy += b.mass * dx * dy;
		syy += b.mass * dy * dy;
	}
	const t = (sxx + syy) / 2;
	const d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy ** 2);
	let ex = sxy;
	let ey = t + d - sxx;
	if (Math.abs(ex) < 1e-9 && Math.abs(ey) < 1e-9) {
		ex = 1;
		ey = 0;
	}
	const el = Math.hypot(ex, ey);
	ex /= el;
	ey /= el;
	let tmin = Infinity;
	let tmax = -Infinity;
	for (const b of blobs) {
		const tp = (b.x - mx) * ex + (b.y - my) * ey;
		if (tp < tmin) tmin = tp;
		if (tp > tmax) tmax = tp;
	}
	return {
		p0: { x: mx + ex * tmin, y: my + ey * tmin },
		p1: { x: mx + ex * tmax, y: my + ey * tmax },
		centroid: { x: mx, y: my },
		angle: Math.atan2(ey, ex),
		blobCount: blobs.length,
		mass: m,
		lengthPx: tmax - tmin,
	};
}

/** Greedy RANSAC: best collinear cluster by total mass, then best over the rest. */
export function fitStaffs(
	blobs: DetectedBlob[],
	config: IntensityConfig = DEFAULT_INTENSITY_CONFIG,
	frameHeight = 448,
): DetectedStaff[] {
	const maxLen = config.maxStaffFrac * frameHeight;
	const maxGap = config.maxGapFrac * frameHeight;

	// Over-long candidate = cross-body or trail-arc alias. Split at the largest
	// projection gaps and keep the densest contiguous chain.
	const bestChain = (inl: DetectedBlob[]): DetectedBlob[] => {
		const line = fitLine(inl);
		if (line.lengthPx <= maxLen) return inl;
		const ex = (line.p1.x - line.p0.x) / (line.lengthPx || 1);
		const ey = (line.p1.y - line.p0.y) / (line.lengthPx || 1);
		const sorted = inl
			.map((b) => ({ b, t: (b.x - line.p0.x) * ex + (b.y - line.p0.y) * ey }))
			.sort((a, c) => a.t - c.t);
		const chains: { b: DetectedBlob; t: number }[][] = [[sorted[0]!]];
		for (let i = 1; i < sorted.length; i++) {
			if (sorted[i]!.t - sorted[i - 1]!.t > maxGap) chains.push([]);
			chains[chains.length - 1]!.push(sorted[i]!);
		}
		let best = chains[0]!;
		let bestMass = best.reduce((s, e) => s + e.b.mass, 0);
		for (const c of chains.slice(1)) {
			const m = c.reduce((s, e) => s + e.b.mass, 0);
			if (m > bestMass) {
				bestMass = m;
				best = c;
			}
		}
		return best.map((e) => e.b);
	};

	const pick = (cands: DetectedBlob[]): DetectedBlob[] | null => {
		if (cands.length < 2) return null;
		let bestMass = 0;
		let best: DetectedBlob[] | null = null;
		for (let a = 0; a < cands.length; a++) {
			for (let b = a + 1; b < cands.length; b++) {
				const A = cands[a]!;
				const B = cands[b]!;
				const dx = B.x - A.x;
				const dy = B.y - A.y;
				const len = Math.hypot(dx, dy);
				if (len < 10 || len > maxLen * 1.4) continue;
				const nx = -dy / len;
				const ny = dx / len;
				let mass = 0;
				const inl: DetectedBlob[] = [];
				for (const bl of cands) {
					const dist = Math.abs((bl.x - A.x) * nx + (bl.y - A.y) * ny);
					if (dist < config.lineTolerancePx) {
						mass += bl.mass;
						inl.push(bl);
					}
				}
				if (inl.length < 2) continue;
				const chain = bestChain(inl);
				if (chain.length < 2) continue;
				const chainMass = chain.reduce((s, b) => s + b.mass, 0);
				if (chainMass > bestMass) {
					bestMass = chainMass;
					best = chain;
				}
			}
		}
		return best;
	};
	const staffs: DetectedStaff[] = [];
	const first = pick(blobs);
	if (!first) return staffs;
	staffs.push(fitLine(first));
	const rest = blobs.filter((b) => !first.includes(b));
	const second = pick(rest);
	if (second) staffs.push(fitLine(second));
	return staffs;
}

interface EndState {
	thumb: PixelPoint;
	pinky: PixelPoint;
	vThumb: PixelPoint;
	vPinky: PixelPoint;
	coast: number;
}

const dist2 = (a: PixelPoint, b: PixelPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export class IntensityStaffTracker {
	private slots: (EndState | null)[] = [null, null];
	private lastCentroids: (PixelPoint | null)[] = [null, null];

	constructor(private config: IntensityConfig = DEFAULT_INTENSITY_CONFIG) {}

	reset() {
		this.slots = [null, null];
		this.lastCentroids = [null, null];
	}

	track(frame: ImageData): IntensityFrameResult {
		const blobs = detectBlobs(frame, this.config);
		const staffs = fitStaffs(blobs, this.config, frame.height);

		// Assign detected staffs to identity slots by centroid continuity (2x2 assignment).
		const assigned: (DetectedStaff | null)[] = [null, null];
		if (staffs.length >= 2 && this.lastCentroids[0] && this.lastCentroids[1]) {
			const c0 = this.lastCentroids[0]!;
			const c1 = this.lastCentroids[1]!;
			const straight = dist2(staffs[0]!.centroid, c0) + dist2(staffs[1]!.centroid, c1);
			const crossed = dist2(staffs[0]!.centroid, c1) + dist2(staffs[1]!.centroid, c0);
			if (straight <= crossed) {
				assigned[0] = staffs[0]!;
				assigned[1] = staffs[1]!;
			} else {
				assigned[0] = staffs[1]!;
				assigned[1] = staffs[0]!;
			}
		} else if (staffs.length >= 2) {
			assigned[0] = staffs[0]!;
			assigned[1] = staffs[1]!;
		} else if (staffs.length === 1) {
			const s = staffs[0]!;
			if (this.lastCentroids[0] && this.lastCentroids[1]) {
				const slot =
					dist2(s.centroid, this.lastCentroids[0]!) <= dist2(s.centroid, this.lastCentroids[1]!)
						? 0
						: 1;
				assigned[slot] = s;
			} else {
				assigned[0] = s;
			}
		}

		const pairs: [EndpointPair | null, EndpointPair | null] = [null, null];
		for (let i = 0; i < 2; i++) {
			const staff = assigned[i];
			if (!staff) {
				const st = this.slots[i];
				if (st) st.coast++;
				continue;
			}
			this.lastCentroids[i] = staff.centroid;
			pairs[i] = this.labelEnds(i, staff, staffs.length);
		}
		return { blobs, staffs: assigned.filter((s): s is DetectedStaff => s !== null), pairs };
	}

	private labelEnds(slot: number, staff: DetectedStaff, staffCount: number): EndpointPair {
		const st = this.slots[slot];
		let thumb = staff.p0;
		let pinky = staff.p1;
		let corrConf = 0.5;
		if (st && st.coast <= this.config.maxCoastFrames) {
			const pt = { x: st.thumb.x + st.vThumb.x, y: st.thumb.y + st.vThumb.y };
			const pp = { x: st.pinky.x + st.vPinky.x, y: st.pinky.y + st.vPinky.y };
			const straight = dist2(staff.p0, pt) + dist2(staff.p1, pp);
			const crossed = dist2(staff.p0, pp) + dist2(staff.p1, pt);
			if (crossed < straight) {
				thumb = staff.p1;
				pinky = staff.p0;
			}
			const margin = Math.abs(straight - crossed);
			const scale = Math.max(1, staff.lengthPx * staff.lengthPx);
			corrConf = Math.min(1, margin / scale);
		}
		const vThumb = st ? { x: thumb.x - st.thumb.x, y: thumb.y - st.thumb.y } : { x: 0, y: 0 };
		const vPinky = st ? { x: pinky.x - st.pinky.x, y: pinky.y - st.pinky.y } : { x: 0, y: 0 };
		this.slots[slot] = { thumb, pinky, vThumb, vPinky, coast: 0 };

		const blobConf = Math.min(1, staff.blobCount / 3) * (staffCount >= 2 ? 1 : 0.6);
		const orientConf = Math.min(1, staff.lengthPx / 60);
		const detail: TrackConfidence = {
			blob: blobConf,
			correspondence: corrConf,
			orientation: orientConf,
			overall: Math.min(blobConf, corrConf, orientConf),
		};
		return { thumb, pinky, confidence: detail.overall, detail };
	}
}

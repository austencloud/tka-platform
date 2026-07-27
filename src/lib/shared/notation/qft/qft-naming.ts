/**
 * Naming for QfT knob states.
 *
 * Two tiers, and the difference is shown in the UI rather than hidden:
 *
 * - `sourced` — the move is named and worked through in the source article.
 * - `derived` — the name follows from the petal rule below, which every worked
 *   example in the article confirms but which the article never states as a
 *   general rule.
 *
 * The petal rule: with the hand making one circle and the prop making n,
 * antispin gives n+1 petals and inspin gives n-1.
 *
 * Confirmed against the source's own examples:
 *   4-petal inspin  — prop travels 5x farther than the hand   n=5 -> 4  ✓
 *   4-petal antispin                                          n=3 -> 4  ✓
 *   triquetra       — 2 prop downbeats per hand downbeat      n=2 -> 3  ✓
 *   cateye          — direction advances by 1 per increment   n=1 -> 2  ✓
 *   extension       — hand and prop in lockstep               n=1 -> circle ✓
 */

import type { QftKnobs, Spin } from "./qft-model";

export type Provenance = "sourced" | "derived";

export interface QftName {
	label: string;
	provenance: Provenance;
}

interface SourcedMove {
	label: string;
	radius: number;
	downbeats: number;
	spin: Spin;
	phase: number;
}

/** The moves the article works through by name. */
const SOURCED: SourcedMove[] = [
	{ label: "Static spin", radius: 0, downbeats: 1, spin: "inspin", phase: 0 },
	{ label: "Extension", radius: 1, downbeats: 1, spin: "inspin", phase: 0 },
	{ label: "Isolation", radius: 0.5, downbeats: 1, spin: "inspin", phase: 4 },
	{ label: "Cateye", radius: 0.5, downbeats: 1, spin: "antispin", phase: 0 },
	{ label: "Triquetra", radius: 1, downbeats: 2, spin: "antispin", phase: 0 },
	{ label: "4-petal antispin flower", radius: 1, downbeats: 3, spin: "antispin", phase: 0 },
	{ label: "4-petal inspin flower", radius: 1, downbeats: 5, spin: "inspin", phase: 0 }
];

const CLOSE = 0.02;

/** Petals a flower shows at this downbeat ratio. Zero means it closes into a circle. */
export function petalCount(knobs: QftKnobs): number {
	const n = knobs.downbeats;
	return knobs.spin === "antispin" ? n + 1 : Math.abs(n - 1);
}

/**
 * The radius at which a flower's petals collapse to zero width and the head
 * traces a straight line.
 *
 * The head path is an ellipse whose half-width is |radius − d| and half-height
 * is radius + d, where d is the prop's angular contribution. Where those cancel
 * the width is exactly zero. For the one-rotation case the boundary sits at
 * radius 1 — hand path radius equal to prop length — and the shape reverses
 * through it: same width either side, opposite side of the axis.
 *
 * Only the one-rotation antispin case degenerates this way; higher ratios never
 * cancel across a whole revolution.
 */
export function lineRadiusFor(knobs: QftKnobs): number | null {
	return knobs.spin === "antispin" && knobs.downbeats === 1 ? 1 : null;
}

/**
 * Whether this knob state has flattened into a line.
 *
 * The petal count is derived from the downbeat ratio and the spin direction
 * alone — it never looks at radius. That is fine for the source's own examples,
 * which are all quoted at one radius, but it means the name asserts a flower
 * that the radius may have flattened. At radius 1 a one-rotation antispin is a
 * straight line, and calling it a 2-petal flower is simply wrong.
 */
export function isDegenerateLine(knobs: QftKnobs): boolean {
	const boundary = lineRadiusFor(knobs);
	return boundary !== null && Math.abs(knobs.radius - boundary) < CLOSE;
}

export function nameFor(knobs: QftKnobs): QftName {
	const phase = knobs.phase ?? 0;

	const sourced = SOURCED.find(
		(m) =>
			Math.abs(m.radius - knobs.radius) < CLOSE &&
			m.downbeats === knobs.downbeats &&
			m.spin === knobs.spin &&
			m.phase === phase
	);
	if (sourced) return { label: sourced.label, provenance: "sourced" };

	if (knobs.radius < CLOSE) {
		return { label: "Prop rotation, no hand path", provenance: "derived" };
	}

	if (isDegenerateLine(knobs)) {
		return { label: "Line", provenance: "derived" };
	}

	const petals = petalCount(knobs);
	if (petals === 0) {
		return { label: "Circle", provenance: "derived" };
	}

	const spinWord = knobs.spin === "antispin" ? "antispin" : "inspin";
	return { label: `${petals}-petal ${spinWord} flower`, provenance: "derived" };
}

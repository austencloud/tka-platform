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

	const petals = petalCount(knobs);
	if (petals === 0) {
		return { label: "Circle", provenance: "derived" };
	}

	const spinWord = knobs.spin === "antispin" ? "antispin" : "inspin";
	return { label: `${petals}-petal ${spinWord} flower`, provenance: "derived" };
}

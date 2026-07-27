/**
 * QfT notation model — Charlie Cushing's poi notation, computed rather than traced.
 *
 * Home base: eight positions around a circle, numbered clockwise with 8 at top.
 * 1 up/right, 2 right, 3 down/right, 4 down, 5 down/left, 6 left, 7 up/left, 8 up.
 *
 * The same compass doubles as the direction-of-travel scale, which is the thing
 * that separates otherwise-identical patterns: a 4-petal inspin and a 4-petal
 * antispin flower pass through the exact same eight positions.
 *
 * Sources and the published tables this reproduces:
 * docs/reference/archive/qft-notation/README.md
 */

export type Convention = "charlie" | "drex";
export type Spin = "inspin" | "antispin";

export type PositionValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** `n` is Charlie's "out of resolution" — the tangent doesn't land on the compass. */
export type DirectionValue = PositionValue | "n";

export interface QftKnobs {
	/** Hand path radius, in units of one prop length. The source's own unit. */
	radius: number;
	/** Prop rotations per hand rotation. */
	downbeats: number;
	spin: Spin;
	/**
	 * Prop offset from the hand, in eighths. Zero for flowers and extensions;
	 * 4 for isolations, where the prop sits opposite the hand on the compass.
	 */
	phase?: number;
}

export interface QftIncrement {
	propDepart: PositionValue;
	propDirDepart: DirectionValue;
	handDepart: PositionValue;
	radius: number;
	handArrive: PositionValue;
	propDirArrive: DirectionValue;
	propArrive: PositionValue;
}

const STEPS = 8;
const EIGHTH = Math.PI / 4;

/** One prop length. Every distance in the system is expressed against this. */
export const PROP_LENGTH = 1;

/**
 * Map any integer onto 1..8, with 0 landing on 8 rather than 0 — the source
 * numbers the top position 8, not 0.
 */
export function norm(k: number): PositionValue {
	const m = ((Math.round(k) % STEPS) + STEPS) % STEPS;
	return (m === 0 ? STEPS : m) as PositionValue;
}

/** Compass angle in radians for a position, measured clockwise from straight up. */
export function angleOf(position: number): number {
	return position * EIGHTH;
}

/** Screen-space point for a position at a given radius. Screen y grows downward. */
export function pointAt(position: number, radius: number): { x: number; y: number } {
	const a = angleOf(position);
	return { x: radius * Math.sin(a), y: -radius * Math.cos(a) };
}

const spinSign = (spin: Spin): 1 | -1 => (spin === "inspin" ? 1 : -1);

/** Continuous prop index at hand-step `u`. Integer steps give the table rows. */
function propIndexAt(knobs: QftKnobs, u: number): number {
	return spinSign(knobs.spin) * knobs.downbeats * u + (knobs.phase ?? 0);
}

/**
 * Tangent of the prop head's actual path, as a screen-space vector.
 *
 * head(u) = hand(u) + prop offset, so the derivative is the sum of the hand's
 * tangent and the prop's tangent about the hand. The constant factor from the
 * chain rule drops out because only the direction matters.
 */
function headTangent(knobs: QftKnobs, u: number): { x: number; y: number } {
	const handAngle = angleOf(u);
	const propAngle = angleOf(propIndexAt(knobs, u));
	const s = spinSign(knobs.spin) * knobs.downbeats;
	return {
		x: knobs.radius * Math.cos(handAngle) + PROP_LENGTH * s * Math.cos(propAngle),
		y: knobs.radius * Math.sin(handAngle) + PROP_LENGTH * s * Math.sin(propAngle)
	};
}

/** Compass angle of a screen-space vector, in eighths. Not necessarily integral. */
function eighthsOf(v: { x: number; y: number }): number {
	const a = Math.atan2(v.x, -v.y);
	const positive = a < 0 ? a + Math.PI * 2 : a;
	return positive / EIGHTH;
}

const TOLERANCE = 1e-6;

/**
 * Charlie's rule: direction is parallel to the instantaneous slope of the path
 * the head actually traces. Where that slope doesn't land on the eight-point
 * compass, the value is out of resolution and the cell reads `n`.
 */
function directionCharlie(knobs: QftKnobs, u: number): DirectionValue {
	const t = headTangent(knobs, u);
	if (Math.hypot(t.x, t.y) < TOLERANCE) return "n";
	const e = eighthsOf(t);
	const nearest = Math.round(e);
	return Math.abs(e - nearest) < TOLERANCE ? norm(nearest) : "n";
}

/**
 * Drex's rule: direction is always at a right angle to the tether, so nothing
 * is ever out of resolution. Two eighths ahead of the prop when spinning with
 * the hand, two behind when spinning against it.
 */
function directionDrex(knobs: QftKnobs, u: number): DirectionValue {
	return norm(propIndexAt(knobs, u) + 2 * spinSign(knobs.spin));
}

function directionAt(knobs: QftKnobs, u: number, convention: Convention): DirectionValue {
	return convention === "charlie" ? directionCharlie(knobs, u) : directionDrex(knobs, u);
}

/**
 * The eight increments of one hand revolution, as notation rows.
 *
 * Each row's arrival values are the next row's departure values — the source
 * writes movement as origin and destination, assuming a continuous path
 * between them rather than drawing every infinitesimal step.
 */
export function buildIncrements(knobs: QftKnobs, convention: Convention): QftIncrement[] {
	const rows: QftIncrement[] = [];
	for (let i = 0; i < STEPS; i += 1) {
		rows.push({
			propDepart: norm(propIndexAt(knobs, i)),
			propDirDepart: directionAt(knobs, i, convention),
			handDepart: norm(i),
			radius: knobs.radius,
			handArrive: norm(i + 1),
			propDirArrive: directionAt(knobs, i + 1, convention),
			propArrive: norm(propIndexAt(knobs, i + 1))
		});
	}
	return rows;
}

/**
 * Pendulum, which is not a knob state.
 *
 * Everything else here is rotational: a hand circle with a prop rotating
 * against it. A pendulum oscillates, never completing a revolution, and never
 * touches 7, 8 or 1 because those point upward. It gets its own generator
 * rather than a fudged radius.
 */
export function buildPendulum(): QftIncrement[] {
	const path = [2, 3, 4, 5, 6, 5, 4, 3, 2];
	return Array.from({ length: STEPS }, (_, i) => {
		const depart = path[i] as number;
		const arrive = path[i + 1] as number;
		const descending = arrive > depart;
		return {
			propDepart: norm(depart),
			propDirDepart: norm(depart + (descending ? 2 : -2)),
			handDepart: 8,
			radius: 0,
			handArrive: 8,
			propDirArrive: norm(arrive + (descending ? 2 : -2)),
			propArrive: norm(arrive)
		};
	});
}

/** Sample points of the traced path, for drawing the trail. */
export function tracePath(knobs: QftKnobs, samples = 240): Array<{ x: number; y: number }> {
	const points: Array<{ x: number; y: number }> = [];
	const revolutions = revolutionsToClose(knobs);
	for (let i = 0; i <= samples; i += 1) {
		const u = (i / samples) * STEPS * revolutions;
		const hand = pointAt(u, knobs.radius);
		const prop = pointAt(propIndexAt(knobs, u), PROP_LENGTH);
		points.push({ x: hand.x + prop.x, y: hand.y + prop.y });
	}
	return points;
}

/**
 * How many hand revolutions before the pattern repeats. A prop making a whole
 * number of turns per hand circle closes in one; anything else needs more.
 */
export function revolutionsToClose(knobs: QftKnobs): number {
	return Number.isInteger(knobs.downbeats) ? 1 : 8;
}

/** Hand and prop-head positions at a continuous step, for rendering. */
export function posesAt(knobs: QftKnobs, u: number) {
	const hand = pointAt(u, knobs.radius);
	const offset = pointAt(propIndexAt(knobs, u), PROP_LENGTH);
	return { hand, head: { x: hand.x + offset.x, y: hand.y + offset.y } };
}

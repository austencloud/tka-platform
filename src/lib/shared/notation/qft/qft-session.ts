/**
 * Session persistence for the QfT app.
 *
 * A reload should put you back exactly where you were — same move or same knob
 * values, same point in the cycle, playing or paused. During development the
 * page reloads constantly, and losing the shape you were studying every time is
 * what makes a visual tool tiring to work on.
 *
 * Stored under a versioned key. A shape change bumps the version rather than
 * trying to migrate, because the whole payload is cheap to rebuild and a
 * half-restored state is worse than a fresh one.
 */

import { normalizeLayers, type QftLayers } from "./qft-layers";
import type { Spin } from "./qft-model";
import {
	MODE_ORDER,
	type VtgMode
} from "$lib/shared/shape-matrix/services/shape-matrix-realizations";

const KEY = "qft:session:v2";

/** Flowers per matrix axis: the shape matrix's `large` preset. */
const AXIS_LENGTH = 12;

export interface QftSession {
	/**
	 * Whether this visitor has been past the landing card.
	 *
	 * Stored explicitly, because the app saves a payload the moment it mounts —
	 * including while the card is still up. Inferring this from the presence of
	 * a payload would therefore mark every visitor entered within a frame, and
	 * the card would never survive a reload.
	 *
	 * A payload written before this field existed has no value for it. Those are
	 * read as entered: reaching that state at all means the page was used, and
	 * showing the doorway to an existing reader is the worse error.
	 */
	entered: boolean;
	appMode: "guide" | "instrument" | "matrix";
	moveIndex: number;
	/** Index into the twelve-flower matrix axis, per hand. */
	blueIndex: number;
	redIndex: number;
	vtgMode: VtgMode;
	radius: number;
	downbeats: number;
	spin: Spin;
	phase: number;
	pendulum: boolean;
	/** Continuous position in the eight-step cycle. */
	cursor: number;
	playing: boolean;
	/**
	 * Which stage layers are on. Stored loosely and validated on the way back in
	 * by `normalizeLayers`, so a layer added after a payload was written simply
	 * restores on rather than invalidating the whole session.
	 */
	layers: QftLayers;
}

const SPINS: Spin[] = ["inspin", "antispin"];

const num = (v: unknown, min: number, max: number, fallback: number): number =>
	typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;

/**
 * Restore, or null if there is nothing usable.
 *
 * Every field is validated rather than trusted. Stored state outlives the code
 * that wrote it — a knob whose range narrowed, or a move list that got shorter,
 * would otherwise restore a value the app can no longer represent.
 */
export function loadQftSession(moveCount: number): QftSession | null {
	if (typeof localStorage === "undefined") return null;

	let raw: unknown;
	try {
		const stored = localStorage.getItem(KEY);
		if (!stored) return null;
		raw = JSON.parse(stored);
	} catch {
		return null;
	}

	if (!raw || typeof raw !== "object") return null;
	const s = raw as Record<string, unknown>;

	return {
		/* Absent means a pre-landing payload, which counts as entered. */
		entered: s.entered === undefined ? true : s.entered === true,
		/*
		 * Defaults to the matrix, not the guide. Combining two flowers is the
		 * front door; the guide is where the notation's provenance lives. A
		 * payload written before that flip carries an explicit `appMode`, so
		 * nobody is moved out of the mode they left in.
		 */
		appMode:
			s.appMode === "instrument" || s.appMode === "guide"
				? (s.appMode as "instrument" | "guide")
				: "matrix",
		moveIndex: Math.floor(num(s.moveIndex, 0, moveCount - 1, 0)),
		blueIndex: Math.floor(num(s.blueIndex, 0, AXIS_LENGTH - 1, 6)),
		redIndex: Math.floor(num(s.redIndex, 0, AXIS_LENGTH - 1, 7)),
		vtgMode: MODE_ORDER.includes(s.vtgMode as VtgMode) ? (s.vtgMode as VtgMode) : "SS",
		radius: num(s.radius, 0, 1.5, 1),
		downbeats: Math.floor(num(s.downbeats, 1, 8, 3)),
		spin: SPINS.includes(s.spin as Spin) ? (s.spin as Spin) : "antispin",
		phase: Math.floor(num(s.phase, 0, 7, 0)),
		pendulum: s.pendulum === true,
		cursor: num(s.cursor, 0, 8, 0),
		playing: s.playing !== false,
		layers: normalizeLayers(s.layers)
	};
}

export function saveQftSession(session: QftSession): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(KEY, JSON.stringify(session));
	} catch {
		/* Storage full or blocked. Persistence is a convenience, never a
		   requirement — the app works fine without it. */
	}
}

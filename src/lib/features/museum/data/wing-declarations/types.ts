/**
 * Era-agnostic wing declaration — the manifest the shared graybox review
 * harness consumes. One per wing. Declares the approved Phase 0 canon
 * (teaching sentence, five beats, cases, barrier) plus the sealed elements
 * from 2026-08-11: the choreo-card opener, the case triptych, and the
 * eternal-props ensemble. Future historical wings are new manifests, not
 * new architectures.
 *
 * Spec: docs/superpowers/specs/2026-08-11-wing-declaration-shape-design.md
 */

export type TndCategory = "SS" | "SO" | "TS" | "TO" | "QS" | "QO";

/** Static dual-wield props only — never poi (eternal-props seal). */
export type StaticDualWieldProp = "staff" | "club" | "fan" | "buugeng";

export interface ThresholdBeat {
	kind: "threshold";
	/** The wing stamp/title presented at entry. Clinical Order voice. */
	stamp: string;
}

export interface OpenerBeat {
	kind: "opener";
	/**
	 * SEALED FORM: the wing's choreo card (actual pictographs, unlabeled)
	 * beside a propless avatar performing just that hand path, trail effect
	 * on the tips of the hands.
	 */
	catalogId: string;
	/** museum-exhibit-sequences key backing both the card and the avatar. */
	sequenceKey: string;
	/** Performer station; pending placement until the wing's Gate 1 board. */
	stationRef: string;
}

export interface ExhibitCase {
	/** Expanded letter string, e.g. "AAAA". Display uses simplifyRepeatedWord. */
	word: string;
	/** l1-tnd-motions catalog row id — the variation authority. */
	catalogId: string;
	/** museum-exhibit-sequences key; the validator proves it matches the catalog verbatim. */
	sequenceKey: string;
	/** The one showcase per word — INVIOLABLE (eternal-props rider 2). */
	showcaseStationRef: string;
	/**
	 * SEALED TRIPTYCH: alcove avatar + screen + card sign, one playback
	 * clock. Presence asserted here; placement is Gate 1's job.
	 */
	triptych: { screen: true; cardSign: true };
	/**
	 * Eternal-props ensemble AROUND the showcase (rider 1: positioning is
	 * free per wing). Never replaces the showcase.
	 */
	ensemble?: { stationRef: string; prop: StaticDualWieldProp }[];
}

export interface CasesBeat {
	kind: "cases";
	cases: ExhibitCase[];
}

export interface PayoffBeat {
	kind: "payoff";
	/** Viewpoint station/landing the payoff is composed from. */
	viewpointRef: string;
	/** Case words visible from it (validator: subset of declared cases). */
	visibleCases: string[];
	description: string;
}

export interface ExitBeat {
	kind: "exit";
	/** Next wingId in walk order; null for the era's last wing. */
	toWingId: string | null;
	/** Seam phenomenon handing off to the next space. */
	handoff: string;
}

export interface WingDeclaration {
	/** Stable, era-agnostic id: the TnD class, e.g. "split-same". */
	wingId: string;
	/** Which museum era hosts this wing. All six launch wings: "vulcan-cave". */
	era: string;
	/** Spatial owner: RoomNode id in the era's floor plan. */
	roomId: string;

	mode: {
		category: TndCategory;
		/** Clinical label spoken by the Order, e.g. "SPLIT-SAME". */
		label: string;
		/** e.g. "Split-time / same-direction". */
		technicalMode: string;
	};

	/** Verbatim from the approved Phase 0 canon row. */
	teachingSentence: string;
	uniqueObservable: string;

	barrier: {
		/** Open string set, not an enum — future eras add kinds freely. */
		kind: string;
		expression: string;
	};

	/** THE GRAMMAR: exactly five beats, in this order, typed as a tuple. */
	beats: [ThresholdBeat, OpenerBeat, CasesBeat, PayoffBeat, ExitBeat];

	/** Optional scene-owned interaction program (Fire's procession, etc.). */
	signatureProgram?: { id: string; description: string };

	/** Graybox review-shell presentation (what hand-rolled pages hardcode today). */
	review: {
		accentColor: string;
		loadingTitle: string;
		loadingSubtitle: string;
		/** HUD location readout: first entry whose whenZAbove the player-z exceeds wins; a final entry without whenZAbove is the fallback. */
		locationLabels: { label: string; whenZAbove?: number }[];
	};
}

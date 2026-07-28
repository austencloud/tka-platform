/**
 * The stage's layers.
 *
 * QftStage draws six things that are each a separate claim about the move, and
 * they compete: the direction dart is hard to follow through a lit trail, and
 * the prop's own compass sits on top of the hand's. Being able to switch them
 * off one at a time is the difference between a picture of a move and a thing
 * you can read.
 *
 * The prop itself — hand, tether, head — is deliberately not a layer. With that
 * gone there is no stage.
 */

export interface QftLayers {
	/** The body compass: the outer ring and its eight numbered points. */
	handCompass: boolean;
	/** The circle the hand traces, and the arm out to it. */
	handPath: boolean;
	/** The prop's own compass, projected from the hand, and its lit position. */
	propCompass: boolean;
	/** The dart that fires along the direction of travel at each increment. */
	dart: boolean;
	/** The wedge the prop sweeps across the current increment. */
	sector: boolean;
	/** The traced shape, and the afterimage riding the head. */
	trail: boolean;
}

export const ALL_LAYERS: QftLayers = {
	handCompass: true,
	handPath: true,
	propCompass: true,
	dart: true,
	sector: true,
	trail: true
};

export const LAYER_KEYS = Object.keys(ALL_LAYERS) as Array<keyof QftLayers>;

/**
 * Labels name the thing on the stage, not the code. Each one should be findable
 * by eye: switch it off, see what left.
 */
export const LAYER_LABELS: Record<keyof QftLayers, string> = {
	handCompass: "Hand compass",
	handPath: "Hand path",
	propCompass: "Prop compass",
	dart: "Direction",
	sector: "Swept sector",
	trail: "Trail"
};

/** Validated restore. An unknown or missing key falls back to on. */
export function normalizeLayers(raw: unknown): QftLayers {
	if (!raw || typeof raw !== "object") return { ...ALL_LAYERS };
	const source = raw as Record<string, unknown>;
	const out = { ...ALL_LAYERS };
	for (const key of LAYER_KEYS) {
		if (source[key] === false) out[key] = false;
	}
	return out;
}

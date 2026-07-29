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

/**
 * Every layer off — the prop, its tether and the hand, and nothing else.
 *
 * Worth having as one action rather than six taps: reading a single mark against
 * a bare stage is exactly why the layers are switchable, and getting there by
 * turning five things off one at a time is the part that made it not worth
 * doing.
 */
export const NO_LAYERS: QftLayers = {
	handCompass: false,
	handPath: false,
	propCompass: false,
	dart: false,
	sector: false,
	trail: false
};

export const LAYER_KEYS = Object.keys(ALL_LAYERS) as Array<keyof QftLayers>;

/** Whether every layer is currently drawn, which is what the reset toggles off. */
export function allLayersOn(layers: QftLayers): boolean {
	return LAYER_KEYS.every((key) => layers[key]);
}

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

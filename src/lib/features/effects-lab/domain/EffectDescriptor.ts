import type { FirePoint } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import type { LedPoint } from "$lib/shared/animation-engine/domain/types/LedTypes";
import { getFirePoints } from "$lib/shared/animation-engine/domain/types/PropFirePoints";
import { getLedPoints } from "$lib/shared/animation-engine/domain/types/PropLedPoints";

/**
 * Describes how a visual effect behaves in the Effects Lab editor.
 * Shared components use this to adapt their UI (colors, labels, slider ranges)
 * without knowing the specific effect type.
 */
export interface EffectDescriptor {
	/** Unique ID for persistence and routing */
	id: string;
	/** Display label */
	label: string;
	/** FontAwesome icon class */
	icon: string;
	/** Primary accent color (hex) */
	accentColor: string;
	/** Mid-opacity accent for backgrounds (rgba) */
	accentColorMid: string;
	/** Border accent (rgba) */
	accentColorBorder: string;
	/** Whether this effect type has a point placement editor */
	hasPointEditor: boolean;

	// Point editor config (only used when hasPointEditor is true)
	/** Label for the intensity slider (e.g. "Flame Scale", "Brightness") */
	intensityLabel: string;
	/** Min/max range for the intensity slider */
	intensityRange: [number, number];
	/** Step increment for the intensity slider */
	intensityStep: number;
	/** Default intensity for new points */
	intensityDefault: number;
	/** Read intensity from a point object */
	getIntensity(point: FirePoint | LedPoint): number;
	/** Write intensity to a point object (mutates in place) */
	setIntensity(point: FirePoint | LedPoint, value: number): void;
	/** Create a new point at the given coordinates with default intensity */
	createPoint(dx: number, dy: number): FirePoint | LedPoint;
	/** Load default points for a prop type from the domain registry */
	getDefaultPoints(propType: string): (FirePoint | LedPoint)[];
}

export type EffectMode = "trails" | "fire" | "led";

export const FIRE_DESCRIPTOR: EffectDescriptor = {
	id: "fire",
	label: "Fire",
	icon: "fas fa-fire",
	accentColor: "#f97316",
	accentColorMid: "rgba(249, 115, 22, 0.15)",
	accentColorBorder: "rgba(249, 115, 22, 0.3)",
	hasPointEditor: true,
	intensityLabel: "Flame Scale",
	intensityRange: [0.1, 2.0],
	intensityStep: 0.1,
	intensityDefault: 0.8,
	getIntensity: (p: FirePoint) => p.flameScale,
	setIntensity: (p: FirePoint, v: number) => {
		p.flameScale = v;
	},
	createPoint: (dx: number, dy: number): FirePoint => ({
		dx,
		dy,
		flameScale: 0.8,
	}),
	getDefaultPoints: (propType: string) => getFirePoints(propType).points,
};

export const LED_DESCRIPTOR: EffectDescriptor = {
	id: "led",
	label: "LED",
	icon: "fas fa-lightbulb",
	accentColor: "#00ff88",
	accentColorMid: "rgba(0, 255, 136, 0.15)",
	accentColorBorder: "rgba(0, 255, 136, 0.3)",
	hasPointEditor: true,
	intensityLabel: "Brightness",
	intensityRange: [0, 1],
	intensityStep: 0.05,
	intensityDefault: 0.8,
	getIntensity: (p: LedPoint) => p.brightness,
	setIntensity: (p: LedPoint, v: number) => {
		p.brightness = v;
	},
	createPoint: (dx: number, dy: number): LedPoint => ({
		dx,
		dy,
		brightness: 0.8,
	}),
	getDefaultPoints: (propType: string) => getLedPoints(propType).points,
};

export const TRAILS_DESCRIPTOR: EffectDescriptor = {
	id: "trails",
	label: "Trails",
	icon: "fas fa-wind",
	accentColor: "#3b82f6",
	accentColorMid: "rgba(59, 130, 246, 0.15)",
	accentColorBorder: "rgba(59, 130, 246, 0.3)",
	hasPointEditor: false,
	// Point editor fields unused for trails, but interface requires them
	intensityLabel: "",
	intensityRange: [0, 1],
	intensityStep: 0.1,
	intensityDefault: 1,
	getIntensity: () => 1,
	setIntensity: () => {},
	createPoint: (dx: number, dy: number) => ({ dx, dy, brightness: 1 }),
	getDefaultPoints: () => [],
};

/** All registered effect descriptors, in display order */
export const EFFECT_DESCRIPTORS: EffectDescriptor[] = [
	TRAILS_DESCRIPTOR,
	FIRE_DESCRIPTOR,
	LED_DESCRIPTOR,
];

/** Look up a descriptor by ID */
export function getEffectDescriptor(id: string): EffectDescriptor {
	return EFFECT_DESCRIPTORS.find((d) => d.id === id) ?? TRAILS_DESCRIPTOR;
}

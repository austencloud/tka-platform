/**
 * Pure flow-color helpers for mandala rendering. Extracted from
 * MandalaViewerController so the controller and the MandalaLoader share one
 * source of truth for preset colors and gradient interpolation.
 */
import type { MandalaPalette, MandalaPresetId } from "./mandala-types";

export const PRESET_COLORS: Record<
	Exclude<MandalaPresetId, "custom">,
	{ pair: [string, string]; morph: string[] }
> = {
	aurora: { pair: ["#00e5ff", "#76ff03"], morph: ["#00e5ff", "#76ff03", "#7c4dff", "#ff4081", "#00e5ff"] },
	neon: { pair: ["#ff0099", "#00ddff"], morph: ["#ff0099", "#7928ca", "#0055ff", "#00ddff", "#ff0099"] },
	ember: { pair: ["#ff3d00", "#ffd600"], morph: ["#ff3d00", "#ff9100", "#ffd600", "#ff6d00", "#ff3d00"] },
	twilight: { pair: ["#aa00ff", "#f50057"], morph: ["#311b92", "#aa00ff", "#f50057", "#ff6d00", "#311b92"] },
	ice: { pair: ["#4dd0e1", "#b388ff"], morph: ["#e0f7fa", "#4dd0e1", "#1a237e", "#b388ff", "#e0f7fa"] },
	solar: { pair: ["#ffab00", "#dd2c00"], morph: ["#ffab00", "#ff6d00", "#dd2c00", "#ffea00", "#ffab00"] },
};

export function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function rgbToHex(r: number, g: number, b: number): string {
	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function mixColors(a: string, b: string): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return rgbToHex(Math.round((ar + br) / 2), Math.round((ag + bg) / 2), Math.round((ab + bb) / 2));
}

export function withAlpha(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function lerpColor(a: string, b: string, t: number): string {
	const [ar, ag, ab] = hexToRgb(a);
	const [br, bg, bb] = hexToRgb(b);
	return rgbToHex(
		Math.round(ar + (br - ar) * t),
		Math.round(ag + (bg - ag) * t),
		Math.round(ab + (bb - ab) * t),
	);
}

export function sampleGradient(colors: string[], t: number): string {
	const segments = colors.length - 1;
	const scaled = t * segments;
	const idx = Math.min(Math.floor(scaled), segments - 1);
	const frac = scaled - idx;
	return lerpColor(colors[idx]!, colors[idx + 1]!, frac);
}

/** Flow-mode stroke/fill palette for a morph ramp at a phase in [0,1). */
export function flowPalette(morphColors: string[], phase: number): MandalaPalette {
	const c1 = sampleGradient(morphColors, phase);
	const c2 = sampleGradient(morphColors, (phase + 0.4) % 1);
	const mix = mixColors(c1, c2);
	return {
		blueStroke: c1, blueFill: withAlpha(c1, 0.15),
		redStroke: c2, redFill: withAlpha(c2, 0.15),
		purpleStroke: mix, purpleFill: withAlpha(mix, 0.2),
	};
}

/** Per-path gradient endpoints for a morph ramp at a phase in [0,1). */
export function flowGradientColors(
	morphColors: string[],
	phase: number,
): { blue: [string, string]; red: [string, string]; purple: [string, string] } {
	const c1 = sampleGradient(morphColors, phase);
	const c2 = sampleGradient(morphColors, (phase + 0.4) % 1);
	const c3 = sampleGradient(morphColors, (phase + 0.7) % 1);
	const mix = mixColors(c1, c2);
	return {
		blue: [c1, c3],
		red: [c2, c1],
		purple: [mix, c3],
	};
}

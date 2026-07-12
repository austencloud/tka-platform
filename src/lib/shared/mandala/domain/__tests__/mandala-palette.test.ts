import { describe, it, expect } from "vitest";
import {
	PRESET_COLORS,
	sampleGradient,
	mixColors,
	flowPalette,
	flowGradientColors,
} from "../mandala-palette";

describe("mandala-palette", () => {
	it("PRESET_COLORS exposes the named presets with pair + morph", () => {
		for (const id of [
			"aurora",
			"neon",
			"ember",
			"twilight",
			"ice",
			"solar",
			"ink",
			"gilded",
			"abyss",
		] as const) {
			expect(PRESET_COLORS[id].pair).toHaveLength(2);
			expect(PRESET_COLORS[id].morph.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("every preset ships a valid #rrggbb background", () => {
		const hex6 = /^#[0-9a-f]{6}$/i;
		for (const id of Object.keys(PRESET_COLORS) as (keyof typeof PRESET_COLORS)[]) {
			expect(PRESET_COLORS[id].bg).toMatch(hex6);
		}
	});

	it("sampleGradient interpolates within a morph ramp", () => {
		const colors = ["#000000", "#ffffff"];
		expect(sampleGradient(colors, 0)).toBe("#000000");
		expect(sampleGradient(colors, 1)).toBe("#ffffff");
		expect(sampleGradient(colors, 0.5)).toBe("#808080"); // round(127.5) = 128 = 0x80
	});

	it("flowPalette reproduces the controller's flow-mode palette math", () => {
		const morph = PRESET_COLORS.aurora.morph;
		const c1 = sampleGradient(morph, 0);
		const c2 = sampleGradient(morph, 0.4);
		const pal = flowPalette(morph, 0);
		expect(pal.blueStroke).toBe(c1);
		expect(pal.redStroke).toBe(c2);
		expect(pal.purpleStroke).toBe(mixColors(c1, c2));
	});

	it("flowGradientColors reproduces the controller's gradientColors math", () => {
		const morph = PRESET_COLORS.aurora.morph;
		const c1 = sampleGradient(morph, 0.25);
		const c2 = sampleGradient(morph, (0.25 + 0.4) % 1);
		const c3 = sampleGradient(morph, (0.25 + 0.7) % 1);
		const g = flowGradientColors(morph, 0.25);
		expect(g.blue).toEqual([c1, c3]);
		expect(g.red).toEqual([c2, c1]);
		expect(g.purple).toEqual([mixColors(c1, c2), c3]);
	});
});

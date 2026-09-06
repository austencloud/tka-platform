import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Drowned Gallery shell is authored in Blender and baked, so its materials
 * are not reviewable in the Svelte source. These read the shipped asset.
 *
 * The gilded threshold shipped once as `metallic 0.7`. The museum never sets
 * `scene.environment`, and in three.js a metal without one has no diffuse term
 * AND no image-based reflection, so the only thing left to draw was its flat
 * emissive: it rendered as a cream cardboard cutout and Austen reported the
 * archway as still looking like graybox. Nothing in Blender was wrong -- Cycles
 * had the whole grotto to reflect. The rule that came out of it is a build
 * rule, which is why it is checked against the build's output.
 */
const GLB_PATH = "static/models/museum/cave/drowned-gallery.glb";

const readGltfJson = (path: string): Record<string, any> => {
	const buffer = readFileSync(resolve(process.cwd(), path));
	expect(buffer.subarray(0, 4).toString("ascii")).toBe("glTF");

	let offset = 12;
	while (offset < buffer.length) {
		const length = buffer.readUInt32LE(offset);
		const type = buffer.readUInt32LE(offset + 4);
		if (type === 0x4e4f534a) {
			return JSON.parse(
				buffer.subarray(offset + 8, offset + 8 + length).toString("utf8")
			);
		}
		offset += 8 + length;
	}
	throw new Error(`no JSON chunk in ${path}`);
};

const gltf = readGltfJson(GLB_PATH);
const materials: Array<Record<string, any>> = gltf.materials ?? [];

describe("drowned gallery shell materials", () => {
	it("ships no metallic material into a museum with no environment map", () => {
		expect(materials.length).toBeGreaterThan(0);

		for (const material of materials) {
			// glTF defaults metallicFactor to 1 when the key is absent, so an
			// omitted factor is the worst case, not a pass.
			const metallic = material.pbrMetallicRoughness?.metallicFactor ?? 1;
			expect(
				metallic,
				`${material.name} is metallic ${metallic}; bake the specular or use a dielectric`
			).toBe(0);
		}
	});

	it("exports every material under the name the runtime tunes by", () => {
		// Blender appends ".001" rather than replacing a name. The gilt material
		// collided with the graybox's and shipped as "DG Gilded Threshold.001",
		// which no lookup in DrownedGalleryAuthored.svelte would ever match.
		const names = materials.map((material) => material.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"DG Rock",
				"DG Slab",
				"DG Rail",
				"DG Gilded Threshold",
				"DG Glowworm",
				"DG Alcove Firelight",
			])
		);
		for (const name of names) {
			expect(name, `${name} is a Blender duplicate name`).not.toMatch(
				/\.\d{3}$/
			);
		}
	});

	it("tunes only material names the shell actually carries", () => {
		const source = readFileSync(
			resolve(
				process.cwd(),
				"src/lib/features/museum/components/game/DrownedGalleryAuthored.svelte"
			),
			"utf8"
		);
		const block = source.slice(
			source.indexOf("const EMISSIVE_TUNING"),
			source.indexOf("function tuneShellMaterials")
		);
		const tuned = [...block.matchAll(/"(DG [^"]+)":/g)].map((m) => m[1]);

		expect(tuned.length).toBeGreaterThan(0);
		const names = new Set(materials.map((material) => material.name));
		for (const name of tuned) {
			expect(names.has(name), `${name} is tuned but not in the shell`).toBe(
				true
			);
		}

		// The lightmapped surfaces must NOT be tuned by name: they take the flat
		// lift, and the threshold rejoined them when it gained a lightmap.
		expect(tuned).not.toContain("DG Gilded Threshold");
		expect(tuned).not.toContain("DG Rock");
	});
});

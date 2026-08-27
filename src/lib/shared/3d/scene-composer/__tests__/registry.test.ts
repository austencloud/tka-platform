import { describe, it, expect, beforeEach } from "vitest";
import { SceneComposerRegistry } from "../registry";
import type { SceneComposerPlugin, ComposerCatalog, SurfaceRules } from "../types";

function makeStubPlugin(sceneId: string): SceneComposerPlugin {
	const catalog: ComposerCatalog = {
		categories: [],
		getDefinition: () => undefined,
		allItems: () => [],
	};
	const surfaceRules: SurfaceRules = {
		isSurface: () => true,
		orientationMode: "upright",
		gridSize: null,
		surfaceOffset: 0.01,
	};
	return {
		sceneId,
		displayName: sceneId,
		catalog,
		surfaceRules,
		getDefaults: () => [],
	};
}

describe("SceneComposerRegistry", () => {
	let registry: SceneComposerRegistry;

	beforeEach(() => {
		registry = new SceneComposerRegistry();
	});

	it("registers and retrieves a plugin", () => {
		const plugin = makeStubPlugin("autumn");
		registry.register(plugin);
		expect(registry.get("autumn")).toBe(plugin);
		expect(registry.has("autumn")).toBe(true);
	});

	it("returns undefined for unregistered scene", () => {
		expect(registry.get("nonexistent")).toBeUndefined();
		expect(registry.has("nonexistent")).toBe(false);
	});

	it("overwrites on duplicate registration", () => {
		const first = makeStubPlugin("autumn");
		const second = makeStubPlugin("autumn");
		registry.register(first);
		registry.register(second);
		expect(registry.get("autumn")).toBe(second);
	});

	it("lists all registered plugins", () => {
		registry.register(makeStubPlugin("autumn"));
		registry.register(makeStubPlugin("winter"));
		expect(registry.list()).toHaveLength(2);
		expect(registry.composableSceneIds()).toEqual(
			expect.arrayContaining(["autumn", "winter"])
		);
	});
});

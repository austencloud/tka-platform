import type { Mesh } from "three";
import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
import type {
	SceneComposerPlugin,
	ComposerCatalog,
	CatalogCategory,
	SurfaceRules,
	PlacementConstraints,
} from "$lib/shared/3d/scene-composer/types";
import type { ObjectDefinition } from "$lib/shared/3d/procedural-engine/objects/object-catalog";
import { COSMIC_PLACEMENTS } from "./placements";

const spireItems: ObjectDefinition[] = [
	{
		key: "crystal-spire-prismatic",
		name: "Prismatic Spire",
		type: "prop",
		icon: "fa-gem",
		fallbackGeometry: "cone",
		defaultScale: 2.0,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x88ccff,
	},
	{
		key: "crystal-spire-cyan",
		name: "Cyan Spire",
		type: "prop",
		icon: "fa-gem",
		fallbackGeometry: "cone",
		defaultScale: 2.0,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x22ccdd,
	},
	{
		key: "crystal-spire-amethyst",
		name: "Amethyst Spire",
		type: "prop",
		icon: "fa-gem",
		fallbackGeometry: "cone",
		defaultScale: 2.2,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x9944cc,
	},
	{
		key: "crystal-pyramid-blue",
		name: "Blue Pyramid",
		type: "prop",
		icon: "fa-gem",
		fallbackGeometry: "cone",
		defaultScale: 2.0,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x2266cc,
	},
];

const clusterItems: ObjectDefinition[] = [
	{
		key: "crystal-cluster-aurora",
		name: "Aurora Cluster",
		type: "prop",
		icon: "fa-diamond",
		fallbackGeometry: "sphere",
		defaultScale: 1.5,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x00ccaa,
	},
	{
		key: "crystal-cluster-emerald",
		name: "Emerald Cluster",
		type: "prop",
		icon: "fa-diamond",
		fallbackGeometry: "sphere",
		defaultScale: 1.5,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x22aa66,
	},
	{
		key: "crystal-branch-moonlit",
		name: "Moonlit Branch",
		type: "prop",
		icon: "fa-snowflake",
		fallbackGeometry: "cylinder",
		defaultScale: 1.8,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xaabbdd,
	},
];

const categories: CatalogCategory[] = [
	{ id: "spires", label: "Spires", icon: "fa-gem", items: spireItems },
	{ id: "clusters", label: "Clusters", icon: "fa-diamond", items: clusterItems },
];

const allItems = categories.flatMap((c) => c.items);

const catalog: ComposerCatalog = {
	categories,
	getDefinition(key: string) {
		return allItems.find((d) => d.key === key);
	},
	allItems() {
		return allItems;
	},
};

const surfaceRules: SurfaceRules = {
	isSurface(mesh: Mesh): boolean {
		const name = (mesh.name ?? "").toLowerCase();
		return name.includes("ground") || name.includes("lunar") || name.includes("terrain") || name.includes("floor") || name.includes("platform");
	},
	orientationMode: "upright",
	gridSize: null,
	surfaceOffset: 0.02,
};

const constraints: PlacementConstraints = {
	maxObjects: 100,
	minSpacing: 0.8,
	exclusionZones: [
		{ center: [0, 0, 0], radius: 5, reason: "Performance stage — keep clear for performers" },
	],
};

const cosmicPlugin: SceneComposerPlugin = {
	sceneId: "cosmic",
	displayName: "Cosmic Crystal Garden",
	catalog,
	surfaceRules,
	getDefaults: () => [...COSMIC_PLACEMENTS],
	constraints,
};

composerRegistry.register(cosmicPlugin);

export { cosmicPlugin };

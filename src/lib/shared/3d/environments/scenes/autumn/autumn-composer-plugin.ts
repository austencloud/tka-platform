import type { Mesh } from "three";
import { composerRegistry } from "$lib/shared/3d/scene-composer/registry";
import type {
	SceneComposerPlugin,
	ComposerCatalog,
	CatalogCategory,
	SurfaceRules,
	PlacementConstraints,
	ComposerPlacement,
} from "$lib/shared/3d/scene-composer/types";
import type { ObjectDefinition } from "$lib/shared/3d/procedural-engine/objects/object-catalog";
import { FOREST_AUTUMN_PLACEMENTS } from "./placements";

const vegetationItems: ObjectDefinition[] = [
	{
		key: "oak-tree",
		name: "Oak Tree",
		type: "prop",
		icon: "fa-tree",
		fallbackGeometry: "cone",
		defaultScale: 3,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xc87533,
	},
	{
		key: "birch-tree",
		name: "Birch Tree",
		type: "prop",
		icon: "fa-tree",
		fallbackGeometry: "cone",
		defaultScale: 2.5,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xe8c170,
	},
	{
		key: "bush-large",
		name: "Large Bush",
		type: "prop",
		icon: "fa-leaf",
		fallbackGeometry: "sphere",
		defaultScale: 1.5,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0x8b6914,
	},
	{
		key: "bush-small",
		name: "Small Bush",
		type: "prop",
		icon: "fa-seedling",
		fallbackGeometry: "sphere",
		defaultScale: 0.8,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0xa07828,
	},
	{
		key: "mushroom-cluster",
		name: "Mushroom Cluster",
		type: "prop",
		icon: "fa-fan",
		fallbackGeometry: "sphere",
		defaultScale: 0.4,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0xd4a574,
	},
];

const terrainItems: ObjectDefinition[] = [
	{
		key: "rock-large",
		name: "Large Rock",
		type: "prop",
		icon: "fa-mountain",
		fallbackGeometry: "sphere",
		defaultScale: 1.8,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x6b6b6b,
	},
	{
		key: "rock-small",
		name: "Small Rock",
		type: "prop",
		icon: "fa-gem",
		fallbackGeometry: "sphere",
		defaultScale: 0.6,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x7a7a7a,
	},
	{
		key: "fallen-log",
		name: "Fallen Log",
		type: "prop",
		icon: "fa-minus",
		fallbackGeometry: "cylinder",
		defaultScale: 2,
		defaultHeight: 0.2,
		snapToGround: true,
		canRotate: true,
		canScale: true,
		color: 0x5c3a1e,
	},
];

const atmosphereItems: ObjectDefinition[] = [
	{
		key: "campfire",
		name: "Campfire",
		type: "prop",
		icon: "fa-fire",
		fallbackGeometry: "cylinder",
		defaultScale: 1,
		defaultHeight: 0,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0xcc5500,
	},
	{
		key: "lantern",
		name: "Lantern",
		type: "prop",
		icon: "fa-lightbulb",
		fallbackGeometry: "sphere",
		defaultScale: 0.3,
		defaultHeight: 0.5,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0xffcc44,
	},
	{
		key: "mist-patch",
		name: "Mist Patch",
		type: "zone",
		icon: "fa-cloud",
		fallbackGeometry: "cylinder",
		defaultScale: 3,
		defaultHeight: 0.1,
		snapToGround: true,
		canRotate: false,
		canScale: true,
		color: 0xcccccc,
	},
];

const categories: CatalogCategory[] = [
	{ id: "vegetation", label: "Vegetation", icon: "fa-tree", items: vegetationItems },
	{ id: "terrain", label: "Terrain", icon: "fa-mountain", items: terrainItems },
	{ id: "atmosphere", label: "Atmosphere", icon: "fa-fire", items: atmosphereItems },
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
		if (name.includes("ground") || name.includes("terrain") || name.includes("plane")) {
			return true;
		}
		if (mesh.geometry?.boundingSphere) {
			mesh.geometry.computeBoundingSphere();
			if (mesh.geometry.boundingSphere!.radius > 5) return true;
		}
		return false;
	},
	orientationMode: "upright",
	gridSize: null,
	surfaceOffset: 0.02,
};

const constraints: PlacementConstraints = {
	maxObjects: 200,
	minSpacing: 0.5,
	exclusionZones: [
		{
			center: [0, 0, 0],
			radius: 5,
			reason: "performer clearing",
		},
	],
};

const autumnPlugin: SceneComposerPlugin = {
	sceneId: "forest-autumn",
	displayName: "Autumn Forest",
	catalog,
	surfaceRules,
	getDefaults(): ComposerPlacement[] {
		return [...FOREST_AUTUMN_PLACEMENTS];
	},
	constraints,
};

composerRegistry.register(autumnPlugin);

export { autumnPlugin };

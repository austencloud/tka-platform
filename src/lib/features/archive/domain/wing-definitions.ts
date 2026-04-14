import type { RoomDefinition } from "$lib/shared/3d/indoor/domain/room-types";

export const DISCOVERY_CHAMBER: RoomDefinition = {
	id: "wing-1-discovery",
	name: "Discovery Chamber",
	shape: "rectangular",
	width: 10,
	depth: 12,
	height: 4.5,
	walls: { thickness: 0.5, material: "stone" },
	entrance: {
		wall: "south",
		width: 3,
		height: 3.2,
		offset: "center",
		corridor: { depth: 4, height: 3.2, width: 2.8 },
	},
	connections: [],
	objects: [
		{
			id: "tablet-pedestal",
			type: "pedestal",
			placement: { anchor: "wall", wall: "north", position: "center", distance: 1.5 },
		},
		{
			id: "torch-e1",
			type: "torch-mount",
			placement: { anchor: "wall", wall: "east", position: 0.3, distance: 0, height: 2.5 },
		},
		{
			id: "torch-e2",
			type: "torch-mount",
			placement: { anchor: "wall", wall: "east", position: 0.7, distance: 0, height: 2.5 },
		},
		{
			id: "torch-w1",
			type: "torch-mount",
			placement: { anchor: "wall", wall: "west", position: 0.3, distance: 0, height: 2.5 },
		},
		{
			id: "torch-w2",
			type: "torch-mount",
			placement: { anchor: "wall", wall: "west", position: 0.7, distance: 0, height: 2.5 },
		},
	],
	lighting: [
		{ type: "ambient", color: "#2a1808", intensity: 0.4 },
		{ type: "hemisphere", color: "#1a1008", intensity: 0.25 },
		{ type: "spotlight", target: "tablet-pedestal", angle: 30, intensity: 3, color: "#fff0d0" },
	],
	spawn: { wall: "south", distance: 2, facing: "north" },
};

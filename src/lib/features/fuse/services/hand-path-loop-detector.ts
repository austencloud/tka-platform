const DIAMOND_POINTS = new Set(["n", "e", "s", "w"]);
const BOX_POINTS = new Set(["ne", "se", "sw", "nw"]);

export function isHandPathLoop(locations: string[], gridMode: "diamond" | "box"): boolean {
	if (locations.length < 2) return false;

	// Must return to start
	const start = locations[0]?.toLowerCase();
	const end = locations[locations.length - 1]?.toLowerCase();
	if (start !== end) return false;

	// Must visit all required points
	const requiredPoints = gridMode === "diamond" ? DIAMOND_POINTS : BOX_POINTS;
	const visited = new Set(locations.map((l) => l.toLowerCase()));

	for (const point of requiredPoints) {
		if (!visited.has(point)) return false;
	}

	return true;
}

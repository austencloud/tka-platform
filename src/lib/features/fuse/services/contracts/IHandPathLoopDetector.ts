export interface IHandPathLoopDetector {
	/** Check if a location sequence forms a LOOP (visits all grid points and returns to start) */
	isLoop(locations: string[], gridMode: "diamond" | "box"): boolean;
}

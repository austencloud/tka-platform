import type { ComposerPlacement } from "$lib/shared/3d/scene-composer/types";

function q(rotY: number): [number, number, number, number] {
	return [0, Math.sin(rotY / 2), 0, Math.cos(rotY / 2)];
}

// <!-- PLACEMENTS_START -->
export const OCEAN_PLACEMENTS: ComposerPlacement[] = [];
// <!-- PLACEMENTS_END -->

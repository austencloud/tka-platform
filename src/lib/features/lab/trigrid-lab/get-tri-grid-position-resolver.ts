import { browser } from '$app/environment';
import type { GridLocation } from '$lib/shared/pictograph/grid/domain/enums/grid-enums';
import type { TriGridMode, TriGridPositionInfo } from './domain/trigrid-types';
import { resolveTriGridPosition } from './domain/trigrid-positions';

/**
 * Browser-only accessor for trigrid position classification.
 *
 * Delegates directly to the domain resolver (same vertex = beta, different
 * vertices = gamma; no alpha on a 3-point grid). The previous passthrough
 * service shim was removed — this factory is the only browser guard needed.
 */
export function getTriGridPositionResolver(): {
	resolvePosition: (
		leftLocation: GridLocation,
		rightLocation: GridLocation,
		mode: TriGridMode,
	) => TriGridPositionInfo | null;
} {
	if (!browser) throw new Error('getTriGridPositionResolver() is browser-only');
	return { resolvePosition: resolveTriGridPosition };
}

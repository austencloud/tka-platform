/**
 * Compose Browse ITI Container
 *
 * Services for the composition browse tab: layout calculation and thumbnail resolution.
 * Self-contained, no external dependencies.
 */

import { createContainer } from "iti";
import { CompositionLayoutCalculator } from "$lib/features/compose/tabs/browse/services/implementations/CompositionLayoutCalculator";
import { CompositionThumbnailResolver } from "$lib/features/compose/tabs/browse/services/implementations/CompositionThumbnailResolver";

export function createComposeBrowseContainer() {
	return createContainer().add({
		compositionLayoutCalculator: () => new CompositionLayoutCalculator(),
		compositionThumbnailResolver: () => new CompositionThumbnailResolver(),
	});
}

export type ComposeBrowseContainer = ReturnType<typeof createComposeBrowseContainer>;

/**
 * Compose Arrange ITI Container
 *
 * Services for the arrange grid tab: beat calculation, persistence,
 * playback engine, layer transforms, and keyboard handling.
 * Self-contained, no external dependencies.
 */

import { createContainer } from "iti";
import { ArrangeBeatCalculator } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeBeatCalculator";
import { ArrangeGridPersister } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeGridPersister";
import { ArrangePlaybackEngine } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangePlaybackEngine";
import { ArrangeLayerTransformer } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeLayerTransformer";
import { ArrangeKeyboardHandler } from "$lib/features/compose/tabs/arrange/services/implementations/ArrangeKeyboardHandler";
import { CellTransformStack } from "$lib/features/compose/tabs/arrange/services/implementations/CellTransformStack";

export function createComposeArrangeContainer() {
	return createContainer().add({
		arrangeBeatCalculator: () => new ArrangeBeatCalculator(),
		arrangeGridPersister: () => new ArrangeGridPersister(),
		arrangePlaybackEngine: () => new ArrangePlaybackEngine(),
		arrangeLayerTransformer: () => new ArrangeLayerTransformer(),
		arrangeKeyboardHandler: () => new ArrangeKeyboardHandler(),
	}).add((items) => ({
		cellTransformStack: () => new CellTransformStack(items.arrangeLayerTransformer),
	}));
}

export type ComposeArrangeContainer = ReturnType<typeof createComposeArrangeContainer>;

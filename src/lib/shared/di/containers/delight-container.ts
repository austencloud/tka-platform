/**
 * Delight Module ITI Container
 *
 * Provides the DelightOrchestrator service for calibrated celebrations.
 * Depends on HapticFeedback from core-container.
 */

import { createContainer } from 'iti';
import { DelightOrchestrator } from '$lib/shared/delight/services/implementations/DelightOrchestrator';
import type { IHapticFeedback } from '$lib/shared/application/services/contracts/IHapticFeedback';

/**
 * Creates the delight container with required external dependencies.
 *
 * @param hapticService - The haptic feedback service for tactile responses
 */
export function createDelightContainer(hapticService: IHapticFeedback | null) {
	return createContainer().add({
		delightOrchestrator: () => new DelightOrchestrator(hapticService)
	});
}

export type DelightContainer = ReturnType<typeof createDelightContainer>;

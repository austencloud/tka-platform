/**
 * Hall of Shame DI Container
 *
 * Services for the age-gated adult content gallery.
 * Handles submission, loading, voting, and admin moderation.
 */

import { createContainer } from 'iti';

import { AgeVerifier } from '$lib/features/hall-of-shame/services/implementations/AgeVerifier';
import { HallOfShameSubmitter } from '$lib/features/hall-of-shame/services/implementations/HallOfShameSubmitter';
import { HallOfShameLoader } from '$lib/features/hall-of-shame/services/implementations/HallOfShameLoader';
import { HallOfShameVoter } from '$lib/features/hall-of-shame/services/implementations/HallOfShameVoter';
import { ShameQueueManager } from '$lib/features/hall-of-shame/services/implementations/ShameQueueManager';

/**
 * Create Hall of Shame container with all services
 */
export function createHallOfShameContainer() {
	return createContainer()
		// Age verification (no dependencies)
		.add({
			ageVerifier: () => new AgeVerifier()
		})
		// Services that depend on ageVerifier
		.add((ctx) => ({
			hallOfShameSubmitter: () => new HallOfShameSubmitter(ctx.ageVerifier),
			hallOfShameLoader: () => new HallOfShameLoader(ctx.ageVerifier),
			hallOfShameVoter: () => new HallOfShameVoter(ctx.ageVerifier)
		}))
		// Admin services (no dependencies)
		.add({
			shameQueueManager: () => new ShameQueueManager()
		});
}

// Export types for the container
export type HallOfShameContainer = ReturnType<typeof createHallOfShameContainer>;

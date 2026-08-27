/**
 * Destination Manager - State management for 3D destination navigation
 *
 * Handles:
 * - Current active destination
 * - Destination transitions
 * - History (back navigation)
 * - Destination metadata
 */

import { getDestination } from "./definitions";
import type { Destination } from "./types";

export function createDestinationManager() {
	// Current active destination
	let currentDestinationId = $state<string | null>(null);

	// Navigation history (for back button)
	let history = $state<string[]>([]);

	// Loading state
	const isTransitioning = $state(false);

	// Optional parameters for the active destination (e.g., userId for museum visiting)
	let navigationParams = $state<Record<string, string>>({});

	/**
	 * Navigate to a destination with optional parameters
	 */
	function navigateTo(destinationId: string, params?: Record<string, string>): void {
		const destination = getDestination(destinationId);
		if (!destination) {
			console.error(`Destination not found: ${destinationId}`);
			return;
		}

		// Add current to history if navigating away from one
		if (currentDestinationId) {
			history = [...history, currentDestinationId];
		}

		currentDestinationId = destinationId;
		navigationParams = params ?? {};
	}

	/**
	 * Go back to previous destination (or picker if no history)
	 */
	function goBack(): void {
		if (history.length > 0) {
			// Pop from history
			currentDestinationId = history[history.length - 1]!;
			history = history.slice(0, -1);
		} else {
			// Return to picker
			currentDestinationId = null;
		}
	}

	/**
	 * Return to destination picker
	 */
	function returnToPicker(): void {
		currentDestinationId = null;
		history = [];
		navigationParams = {};
	}

	/**
	 * Get current destination metadata
	 */
	function getCurrentDestination(): Destination | null {
		if (!currentDestinationId) return null;
		return getDestination(currentDestinationId) ?? null;
	}

	/**
	 * Check if showing picker (no active destination)
	 */
	function isPickerActive(): boolean {
		return currentDestinationId === null;
	}

	return {
		// State
		get currentDestinationId() {
			return currentDestinationId;
		},
		get isTransitioning() {
			return isTransitioning;
		},
		get canGoBack() {
			return history.length > 0;
		},
		get navigationParams() {
			return navigationParams;
		},

		// Computed
		getCurrentDestination,
		isPickerActive,

		// Actions
		navigateTo,
		goBack,
		returnToPicker,
	};
}

/**
 * Singleton instance for global access
 */
export const destinationManager = createDestinationManager();

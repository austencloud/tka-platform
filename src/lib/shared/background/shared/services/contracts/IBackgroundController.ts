/**
 * IBackgroundController - Interface for the singleton background rendering controller
 *
 * This controller manages canvas-based background rendering outside of Svelte's
 * reactive system. It survives HMR and provides an imperative API for background
 * management.
 *
 * ## Architecture
 *
 * The controller owns:
 * - Canvas elements (creates them directly in DOM)
 * - Animation loops
 * - Background system instances
 * - Crossfade transitions
 *
 * Svelte components use this via a thin wrapper (BackgroundHost.svelte) that
 * bridges reactive props to the controller's imperative API.
 *
 * ## Why This Pattern
 *
 * Svelte's $state resets on HMR, but canvases need persistent state.
 * By extracting canvas management to a singleton controller that persists
 * via import.meta.hot.data, we avoid the coordination problems between
 * Svelte's reactivity and the DOM.
 */

import type { BackgroundType } from '../../domain/enums/background-enums';
import type { QualityLevel } from '../../domain/types/background-types';

/**
 * Options for customizing background appearance.
 * Used for solid colors and gradients.
 */
export interface BackgroundOptions {
	/** Hex color for solid backgrounds (e.g., "#000000") */
	backgroundColor?: string;

	/** Array of hex colors for gradient backgrounds */
	gradientColors?: string[];

	/** Angle in degrees for gradient direction (e.g., 135) */
	gradientDirection?: number;

	/** Reduce quality for thumbnail previews */
	thumbnailMode?: boolean;
}

/**
 * Controller for managing background canvas rendering.
 *
 * @example
 * ```typescript
 * const controller = getBackgroundController();
 *
 * // Mount to a container element
 * controller.mount(document.getElementById('background-container'));
 *
 * // Set the background
 * await controller.setBackground(BackgroundType.DEEP_OCEAN);
 *
 * // Change background with crossfade
 * await controller.setBackground(BackgroundType.FIREFLY_FOREST);
 *
 * // Cleanup when done
 * controller.unmount();
 * ```
 */
export interface IBackgroundController {
	/**
	 * Mount the controller to a container element.
	 * Creates canvas elements inside the container.
	 *
	 * Safe to call multiple times - will verify existing canvases
	 * and recreate if needed (e.g., after HMR).
	 */
	mount(container: HTMLElement): void;

	/**
	 * Unmount the controller.
	 * Stops animations, cleans up systems, removes canvases.
	 *
	 * Note: In normal HMR scenarios, you typically DON'T want to unmount.
	 * Only unmount when the app is truly shutting down.
	 */
	unmount(): void;

	/**
	 * Set the background type with optional customization.
	 *
	 * Behavior:
	 * - If same type and already rendered: no-op (prevents flicker)
	 * - If different type: performs smooth crossfade
	 * - If currently transitioning: queues the request
	 * - If not mounted yet: stores for later initialization
	 *
	 * @returns Promise that resolves when transition completes
	 */
	setBackground(type: BackgroundType, options?: BackgroundOptions): Promise<void>;

	/**
	 * Set the quality level for the background.
	 * Affects particle count, blur quality, etc.
	 */
	setQuality(quality: QualityLevel): void;

	/**
	 * Get the currently displayed background type.
	 * Returns null if no background is set.
	 */
	getCurrentType(): BackgroundType | null;

	/**
	 * Check if the controller is mounted and displaying content.
	 */
	isReady(): boolean;

	/**
	 * Force a refresh of the current background.
	 * Useful for debugging or manual recovery from edge cases.
	 */
	forceRefresh(): void;
}

/**
 * Pinch-to-Zoom Grid Controller Interface
 *
 * Handles two-finger pinch gestures to control grid column count.
 * Mobile-only feature for photo gallery-style zoom behavior.
 */

export interface IPinchZoomGridController {
	/**
	 * Attach gesture listeners to an element.
	 * @param element The container element to track pinch gestures on
	 */
	attach(element: HTMLElement): void;

	/**
	 * Remove gesture listeners and clean up.
	 */
	detach(): void;

	/**
	 * Set callback for when column count should change.
	 * @param callback Called with new column count (2-6)
	 */
	setOnColumnChange(callback: (columns: number) => void): void;

	/**
	 * Set the current column count (for initializing from settings).
	 * @param columns Current column count (2-6)
	 */
	setColumnCount(columns: number): void;

	/**
	 * Check if device supports touch gestures.
	 */
	isTouchDevice(): boolean;
}

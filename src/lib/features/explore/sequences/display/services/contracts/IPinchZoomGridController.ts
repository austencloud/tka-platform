/**
 * Pinch-to-Zoom Grid Controller Interface
 *
 * iOS Photos-style pinch gestures for controlling grid column count.
 * Uses discrete column changes with CSS layout transitions (no scale transforms).
 */

/** State emitted during pinch gestures */
export interface PinchZoomState {
	/** Current column count (discrete: 2-6) */
	columns: number;
	/** Whether gesture is active */
	isGesturing: boolean;
	/** True for ~200ms after column change (for CSS transition timing) */
	isTransitioning: boolean;
}

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
	 * Set callback for state updates.
	 * Called when columns change or transition state changes.
	 * @param callback Called with current pinch state
	 */
	setOnStateChange(callback: (state: PinchZoomState) => void): void;

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

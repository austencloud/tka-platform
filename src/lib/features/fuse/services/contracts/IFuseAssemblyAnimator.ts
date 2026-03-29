/**
 * Contract for the fuse assembly animation.
 *
 * Takes two panel DOM elements and animates them sliding toward a shared
 * center point, creating the visual effect of two sequences merging into one.
 */
export interface IFuseAssemblyAnimator {
	/**
	 * Animate both panels toward the center, fading out at the end.
	 * Resolves when the animation completes (or immediately if reduced motion).
	 */
	animate(
		leftEl: HTMLElement,
		rightEl: HTMLElement,
		targetEl: HTMLElement
	): Promise<void>;
}

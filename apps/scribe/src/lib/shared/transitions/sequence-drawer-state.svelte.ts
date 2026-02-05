/**
 * Coordination state for the sequence drawer transition.
 *
 * When the user swipe-dismisses the sequence page, the swipe animation
 * already handles the visual exit. This module lets the sequence route
 * tell the layout's onNavigate callback to skip the view transition
 * so the two animations don't compete.
 */

let _skip = $state(false);

/** Call before goto() when a swipe dismiss already animated the exit. */
export function setSkipNextViewTransition(): void {
	_skip = true;
}

/**
 * Called by onNavigate. If a skip was requested, consumes it and returns true.
 * Otherwise returns false (proceed with normal view transition).
 */
export function consumeSkipNextViewTransition(): boolean {
	if (_skip) {
		_skip = false;
		return true;
	}
	return false;
}

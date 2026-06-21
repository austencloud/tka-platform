/**
 * Grid Zoom State
 *
 * Shared state for grid column count, controlled by:
 * - Pinch gestures on touch devices
 * - +/- buttons in the top bar (for dev tools / non-touch)
 *
 * Persists to settings automatically.
 * Preserves state across HMR updates.
 */

import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";

const MIN_COLUMNS = 2;

/**
 * Per-breakpoint maximum columns. Prevents cards from becoming
 * unreadably small on narrow screens while allowing more density
 * on wider ones. Breakpoints use container width, not viewport,
 * so the grid adapts to its actual available space.
 */
function getMaxColumnsForWidth(width: number): number {
	if (width < 480) return 2;
	if (width < 800) return 3;
	if (width < 1200) return 4;
	if (width < 1800) return 5;
	if (width < 2600) return 6;
	return 7;
}

// Preserve state across HMR
function getInitialColumns(): number {
	// Check HMR preserved data first
	if (import.meta.hot?.data?.gridColumns !== undefined) {
		return import.meta.hot.data.gridColumns;
	}
	// Fall back to settings
	return settingsService.settings.gridZoomLevel ?? 2;
}

class GridZoomManager {
	// Current column count
	columns = $state<number>(getInitialColumns());

	// True for ~200ms after column change (for CSS transition)
	isTransitioning = $state(false);

	// Container width reported by BrowseGrid's ResizeObserver
	private _containerWidth = 0;

	private transitionTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Max columns allowed for the current container width.
	 * Uses per-breakpoint limits so small phones can never exceed 2,
	 * mid-size devices cap at 3, etc.
	 */
	get maxColumns(): number {
		return getMaxColumnsForWidth(this._containerWidth);
	}

	/**
	 * Called by BrowseGrid when it measures its container.
	 * Re-clamps the current column count if the new max is lower.
	 */
	updateContainerWidth(width: number) {
		if (width <= 0 || width === this._containerWidth) return;
		this._containerWidth = width;

		// Re-clamp: if the user had 4 columns on desktop and resized
		// down to a phone, snap to the new max immediately.
		const max = this.maxColumns;
		if (this.columns > max) {
			this.columns = max;
			this.persistToSettings();
		}
	}

	/**
	 * Set column count directly (from pinch controller or buttons)
	 */
	setColumns(newColumns: number) {
		const clamped = Math.max(MIN_COLUMNS, Math.min(this.maxColumns, newColumns));
		if (clamped !== this.columns) {
			this.columns = clamped;
			this.triggerTransition();
			this.persistToSettings();
		}
	}

	/**
	 * Zoom in = more columns = smaller cards
	 */
	zoomIn() {
		this.setColumns(this.columns + 1);
	}

	/**
	 * Zoom out = fewer columns = larger cards
	 */
	zoomOut() {
		this.setColumns(this.columns - 1);
	}

	/**
	 * Check if zoom in is possible
	 */
	get canZoomIn() {
		return this.columns < this.maxColumns;
	}

	/**
	 * Check if zoom out is possible
	 */
	get canZoomOut() {
		return this.columns > MIN_COLUMNS;
	}

	/**
	 * Initialize from settings (call on mount)
	 */
	initFromSettings() {
		const saved = settingsService.settings.gridZoomLevel;
		if (saved !== undefined && saved !== this.columns) {
			this.columns = Math.max(MIN_COLUMNS, Math.min(this.maxColumns, saved));
		}
	}

	private triggerTransition() {
		this.isTransitioning = true;

		if (this.transitionTimeout) {
			clearTimeout(this.transitionTimeout);
		}

		this.transitionTimeout = setTimeout(() => {
			this.isTransitioning = false;
			this.transitionTimeout = null;
		}, 200);
	}

	private persistToSettings() {
		if (this.columns !== settingsService.settings.gridZoomLevel) {
			settingsService.updateSetting("gridZoomLevel", this.columns);
		}
	}
}

export const gridZoomManager = new GridZoomManager();

// Preserve state across HMR
if (import.meta.hot) {
	import.meta.hot.accept();
	import.meta.hot.dispose(() => {
		// Save current state before module is replaced
		import.meta.hot!.data.gridColumns = gridZoomManager.columns;
	});
}

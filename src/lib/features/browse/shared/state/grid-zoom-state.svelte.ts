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

import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { BREAKPOINTS } from "$lib/shared/device/domain/constants/device-constants";

const MIN_COLUMNS = 2;
const MAX_COLUMNS_MOBILE = 3;
const MAX_COLUMNS_DESKTOP = 5;

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

	private transitionTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Max columns allowed for the current viewport.
	 * Mobile (< BREAKPOINTS.MOBILE): 3 columns max
	 * Desktop (>= BREAKPOINTS.MOBILE): 5 columns max
	 */
	get maxColumns(): number {
		if (typeof window === "undefined") return MAX_COLUMNS_DESKTOP;
		return window.innerWidth < BREAKPOINTS.MOBILE
			? MAX_COLUMNS_MOBILE
			: MAX_COLUMNS_DESKTOP;
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

/**
 * Pinch-to-Zoom Grid Controller
 *
 * Handles two-finger pinch gestures to control grid column count.
 * Mobile-only feature for photo gallery-style zoom behavior.
 *
 * Uses Pointer Events for cross-platform touch/mouse support.
 */

import type { IPinchZoomGridController } from "../contracts/IPinchZoomGridController";

/** Zoom levels: columns 2-6 (2 = largest cards, 6 = smallest) */
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;

/** Debounce delay for column changes to avoid jittery transitions */
const DEBOUNCE_MS = 100;

/** Scale threshold to trigger column change (pinch must be significant) */
const SCALE_THRESHOLD = 1.3;

export class PinchZoomGridController implements IPinchZoomGridController {
	private element: HTMLElement | null = null;
	private pointerCache: PointerEvent[] = [];
	private prevPointerDist = -1;
	private currentColumns: number;
	private onColumnChange: ((columns: number) => void) | null = null;
	private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	private cumulativeScale = 1;

	// Bound event handlers for cleanup
	private boundPointerDown: (ev: PointerEvent) => void;
	private boundPointerMove: (ev: PointerEvent) => void;
	private boundPointerUp: (ev: PointerEvent) => void;

	constructor() {
		this.currentColumns = MIN_COLUMNS; // Default

		// Bind handlers
		this.boundPointerDown = this.handlePointerDown.bind(this);
		this.boundPointerMove = this.handlePointerMove.bind(this);
		this.boundPointerUp = this.handlePointerUp.bind(this);
	}

	attach(element: HTMLElement): void {
		if (this.element) {
			this.detach();
		}

		this.element = element;

		// Only attach on touch devices
		if (!this.isTouchDevice()) {
			return;
		}

		element.addEventListener("pointerdown", this.boundPointerDown);
		element.addEventListener("pointermove", this.boundPointerMove);
		element.addEventListener("pointerup", this.boundPointerUp);
		element.addEventListener("pointercancel", this.boundPointerUp);
		element.addEventListener("pointerleave", this.boundPointerUp);
	}

	detach(): void {
		if (this.element) {
			this.element.removeEventListener("pointerdown", this.boundPointerDown);
			this.element.removeEventListener("pointermove", this.boundPointerMove);
			this.element.removeEventListener("pointerup", this.boundPointerUp);
			this.element.removeEventListener("pointercancel", this.boundPointerUp);
			this.element.removeEventListener("pointerleave", this.boundPointerUp);
			this.element = null;
		}

		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
			this.debounceTimeout = null;
		}

		this.pointerCache = [];
		this.prevPointerDist = -1;
		this.cumulativeScale = 1;
	}

	setOnColumnChange(callback: (columns: number) => void): void {
		this.onColumnChange = callback;
	}

	setColumnCount(columns: number): void {
		this.currentColumns = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, columns));
	}

	isTouchDevice(): boolean {
		// Check for touch capability
		return "ontouchstart" in window || navigator.maxTouchPoints > 0;
	}

	private handlePointerDown(ev: PointerEvent): void {
		// Only handle touch events
		if (ev.pointerType !== "touch") {
			return;
		}

		this.pointerCache.push(ev);

		// Capture pointer for tracking outside element
		(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);

		// Reset cumulative scale when starting a new pinch gesture
		if (this.pointerCache.length === 2) {
			this.cumulativeScale = 1;
			this.prevPointerDist = this.getPointerDistance();
		}
	}

	private handlePointerMove(ev: PointerEvent): void {
		// Only handle touch events
		if (ev.pointerType !== "touch") {
			return;
		}

		// Update cached pointer
		const idx = this.pointerCache.findIndex((p) => p.pointerId === ev.pointerId);
		if (idx >= 0) {
			this.pointerCache[idx] = ev;
		}

		// Only handle two-finger gestures
		if (this.pointerCache.length === 2) {
			this.handlePinch();
		}
	}

	private handlePointerUp(ev: PointerEvent): void {
		// Remove pointer from cache
		const idx = this.pointerCache.findIndex((p) => p.pointerId === ev.pointerId);
		if (idx >= 0) {
			this.pointerCache.splice(idx, 1);
		}

		// Reset pinch state when losing second finger
		if (this.pointerCache.length < 2) {
			this.prevPointerDist = -1;

			// Apply any pending column change when gesture ends
			if (this.cumulativeScale !== 1) {
				this.applyScaleToColumns();
				this.cumulativeScale = 1;
			}
		}
	}

	private getPointerDistance(): number {
		if (this.pointerCache.length < 2) return -1;
		const [p1, p2] = this.pointerCache;
		return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
	}

	private handlePinch(): void {
		const curDist = this.getPointerDistance();

		if (this.prevPointerDist > 0 && curDist > 0) {
			// Calculate scale change since last move
			const scaleChange = curDist / this.prevPointerDist;

			// Accumulate scale
			this.cumulativeScale *= scaleChange;

			// Check if we've crossed threshold for column change
			if (this.cumulativeScale > SCALE_THRESHOLD) {
				// Pinch out = fewer columns (larger cards)
				this.changeColumns(-1);
				this.cumulativeScale = 1; // Reset for next change
			} else if (this.cumulativeScale < 1 / SCALE_THRESHOLD) {
				// Pinch in = more columns (smaller cards)
				this.changeColumns(1);
				this.cumulativeScale = 1; // Reset for next change
			}
		}

		this.prevPointerDist = curDist;
	}

	private changeColumns(delta: number): void {
		const newColumns = Math.max(
			MIN_COLUMNS,
			Math.min(MAX_COLUMNS, this.currentColumns + delta)
		);

		if (newColumns !== this.currentColumns) {
			this.currentColumns = newColumns;
			this.emitColumnChange();
		}
	}

	private applyScaleToColumns(): void {
		// Final application of scale when gesture ends
		// This handles cases where the scale didn't quite reach threshold
		// but the user clearly intended to zoom
	}

	private emitColumnChange(): void {
		if (!this.onColumnChange) return;

		// Debounce to avoid rapid-fire changes
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
		}

		this.debounceTimeout = setTimeout(() => {
			this.onColumnChange?.(this.currentColumns);
			this.debounceTimeout = null;
		}, DEBOUNCE_MS);
	}
}

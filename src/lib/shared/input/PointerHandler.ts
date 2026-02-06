/**
 * Pointer Handler
 *
 * Unified handler for all pointing devices using the Pointer Events API.
 * Works identically for mouse, touch, pen, and DevTools touch emulation.
 *
 * Features:
 * - Multi-touch support via pointer ID tracking
 * - Gesture classification (click/tap vs drag)
 * - Pointer capture for reliable drag operations
 * - Zone-based touch handling (left = movement, right = look)
 */

import type { PointerType } from "./InputCapabilities.svelte";

export interface PointerState {
	id: number;
	type: PointerType;
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	timestamp: number;
	zone: "left" | "right" | "center";
}

export interface PointerClickEvent {
	type: "click";
	pointerType: PointerType;
	clientX: number;
	clientY: number;
	zone: "left" | "right" | "center";
}

export interface PointerDragEvent {
	type: "drag";
	pointerType: PointerType;
	clientX: number;
	clientY: number;
	deltaX: number;
	deltaY: number;
	movementX: number; // Frame-to-frame delta
	movementY: number;
	zone: "left" | "right" | "center";
	pointerId: number;
}

export interface PointerDownEvent {
	type: "down";
	pointerType: PointerType;
	clientX: number;
	clientY: number;
	zone: "left" | "right" | "center";
	pointerId: number;
}

export interface PointerUpEvent {
	type: "up";
	pointerType: PointerType;
	clientX: number;
	clientY: number;
	zone: "left" | "right" | "center";
	pointerId: number;
	wasDrag: boolean;
}

export type PointerEventType = PointerClickEvent | PointerDragEvent | PointerDownEvent | PointerUpEvent;

type PointerEventCallback = (event: PointerEventType) => void;

interface PointerHandlerOptions {
	/** Minimum movement to classify as drag (pixels) */
	dragThreshold?: number;
	/** Maximum time for click/tap (ms) */
	clickMaxDuration?: number;
	/** Element to attach listeners to */
	element: HTMLElement;
}

/**
 * Unified pointer handler using Pointer Events API
 */
export class PointerHandler {
	private element: HTMLElement;
	private pointers = new Map<number, PointerState>();
	private lastPositions = new Map<number, { x: number; y: number }>();
	private callbacks: PointerEventCallback[] = [];
	private dragThreshold: number;
	private clickMaxDuration: number;

	constructor(options: PointerHandlerOptions) {
		this.element = options.element;
		this.dragThreshold = options.dragThreshold ?? 10;
		this.clickMaxDuration = options.clickMaxDuration ?? 300;

		this.init();
	}

	private init() {
		// Critical: Prevent browser touch gestures
		this.element.style.touchAction = "none";
		this.element.style.userSelect = "none";
		(this.element.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = "none";

		// Attach pointer event listeners
		this.element.addEventListener("pointerdown", this.handlePointerDown);
		this.element.addEventListener("pointermove", this.handlePointerMove);
		this.element.addEventListener("pointerup", this.handlePointerUp);
		this.element.addEventListener("pointercancel", this.handlePointerUp);
		this.element.addEventListener("pointerleave", this.handlePointerUp);

		// Prevent context menu on long press
		this.element.addEventListener("contextmenu", (e) => e.preventDefault());
	}

	/**
	 * Determine which zone a pointer is in (for touch control layout)
	 */
	private getZone(clientX: number): "left" | "right" | "center" {
		const rect = this.element.getBoundingClientRect();
		const relativeX = clientX - rect.left;
		const width = rect.width;

		// Left third = movement zone
		// Right two-thirds = look zone
		// Center third could be special actions (future)
		if (relativeX < width * 0.4) {
			return "left";
		} else {
			return "right";
		}
	}

	private handlePointerDown = (e: PointerEvent) => {
		// Don't prevent default for mouse - we need clicks to work for pointer lock
		if (e.pointerType === "touch") {
			e.preventDefault();
		}

		const zone = this.getZone(e.clientX);

		const state: PointerState = {
			id: e.pointerId,
			type: e.pointerType as PointerType,
			startX: e.clientX,
			startY: e.clientY,
			currentX: e.clientX,
			currentY: e.clientY,
			timestamp: performance.now(),
			zone,
		};

		this.pointers.set(e.pointerId, state);
		this.lastPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });

		// Capture pointer for reliable drag tracking
		if (e.pointerType === "touch") {
			this.element.setPointerCapture(e.pointerId);
		}

		this.emit({
			type: "down",
			pointerType: e.pointerType as PointerType,
			clientX: e.clientX,
			clientY: e.clientY,
			zone,
			pointerId: e.pointerId,
		});
	};

	private handlePointerMove = (e: PointerEvent) => {
		const state = this.pointers.get(e.pointerId);
		if (!state) return;

		const lastPos = this.lastPositions.get(e.pointerId) ?? { x: e.clientX, y: e.clientY };

		// Update state
		state.currentX = e.clientX;
		state.currentY = e.clientY;

		// Calculate deltas
		const deltaX = e.clientX - state.startX;
		const deltaY = e.clientY - state.startY;
		const movementX = e.clientX - lastPos.x;
		const movementY = e.clientY - lastPos.y;

		// Update last position
		this.lastPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });

		// Emit drag event
		this.emit({
			type: "drag",
			pointerType: e.pointerType as PointerType,
			clientX: e.clientX,
			clientY: e.clientY,
			deltaX,
			deltaY,
			movementX,
			movementY,
			zone: state.zone,
			pointerId: e.pointerId,
		});
	};

	private handlePointerUp = (e: PointerEvent) => {
		const state = this.pointers.get(e.pointerId);
		if (!state) return;

		const duration = performance.now() - state.timestamp;
		const distance = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);

		// Classify as click/tap if short duration and minimal movement
		const wasClick = duration < this.clickMaxDuration && distance < this.dragThreshold;

		// Emit up event
		this.emit({
			type: "up",
			pointerType: e.pointerType as PointerType,
			clientX: e.clientX,
			clientY: e.clientY,
			zone: state.zone,
			pointerId: e.pointerId,
			wasDrag: !wasClick,
		});

		// Emit click event if it was a click
		if (wasClick) {
			this.emit({
				type: "click",
				pointerType: e.pointerType as PointerType,
				clientX: e.clientX,
				clientY: e.clientY,
				zone: state.zone,
			});
		}

		// Clean up
		this.pointers.delete(e.pointerId);
		this.lastPositions.delete(e.pointerId);

		// Release capture
		if (e.pointerType === "touch" && this.element.hasPointerCapture?.(e.pointerId)) {
			this.element.releasePointerCapture(e.pointerId);
		}
	};

	private emit(event: PointerEventType) {
		for (const cb of this.callbacks) {
			cb(event);
		}
	}

	/**
	 * Subscribe to pointer events
	 */
	on(callback: PointerEventCallback): () => void {
		this.callbacks.push(callback);
		return () => {
			const idx = this.callbacks.indexOf(callback);
			if (idx >= 0) this.callbacks.splice(idx, 1);
		};
	}

	/**
	 * Get active pointers (for multi-touch)
	 */
	getActivePointers(): Map<number, PointerState> {
		return new Map(this.pointers);
	}

	/**
	 * Get pointer by zone (useful for joystick/look separation)
	 */
	getPointerInZone(zone: "left" | "right" | "center"): PointerState | null {
		return Array.from(this.pointers.values()).find((pointer) => pointer.zone === zone) ?? null;
	}

	/**
	 * Check if there's active touch input
	 */
	hasActiveTouch(): boolean {
		return Array.from(this.pointers.values()).some((pointer) => pointer.type === "touch");
	}

	/**
	 * Clean up
	 */
	destroy() {
		this.element.removeEventListener("pointerdown", this.handlePointerDown);
		this.element.removeEventListener("pointermove", this.handlePointerMove);
		this.element.removeEventListener("pointerup", this.handlePointerUp);
		this.element.removeEventListener("pointercancel", this.handlePointerUp);
		this.element.removeEventListener("pointerleave", this.handlePointerUp);
		this.pointers.clear();
		this.lastPositions.clear();
		this.callbacks.length = 0;
	}
}

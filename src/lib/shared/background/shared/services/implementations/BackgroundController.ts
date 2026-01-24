/**
 * BackgroundController - Singleton controller for canvas background rendering
 *
 * This controller manages all canvas-based background rendering outside of
 * Svelte's reactive system. It survives HMR via import.meta.hot.data persistence.
 *
 * ## Key Design Decisions
 *
 * 1. **Singleton Pattern**: One controller instance manages all background rendering.
 *    The instance persists across HMR module reloads.
 *
 * 2. **Imperative API**: Instead of reactive props, the controller exposes methods
 *    like setBackground(), mount(), unmount(). This avoids the Svelte reactivity
 *    reset problem.
 *
 * 3. **Self-Healing Animation Loop**: For animated backgrounds, the loop runs
 *    continuously. Even if HMR clears the canvas, the next frame redraws it.
 *
 * 4. **Dual Canvas Crossfade**: Same visual effect as before - two canvases
 *    layered with CSS opacity transitions for smooth switches.
 *
 * 5. **Canvas Ownership**: The controller creates and owns the canvas elements
 *    directly, rather than receiving them from Svelte. This ensures consistent
 *    state management.
 */

import type {
	IBackgroundController,
	BackgroundOptions
} from '../contracts/IBackgroundController';
import type { BackgroundSystem } from '../../domain/models/background-models';
import { BackgroundType } from '../../domain/enums/background-enums';
import type { QualityLevel } from '../../domain/types/background-types';
import { BackgroundFactory } from './BackgroundFactory';

/**
 * BackgroundController implementation
 */
export class BackgroundController implements IBackgroundController {
	// ═══════════════════════════════════════════════════════════════════════════
	// PRIVATE STATE - All state lives here, survives HMR via singleton pattern
	// ═══════════════════════════════════════════════════════════════════════════

	// Canvas elements (owned by controller, created in mount())
	private canvasA: HTMLCanvasElement | null = null;
	private canvasB: HTMLCanvasElement | null = null;
	private container: HTMLElement | null = null;

	// Background system instances
	private systemA: BackgroundSystem | null = null;
	private systemB: BackgroundSystem | null = null;

	// Animation frame IDs
	private animationIdA: number | null = null;
	private animationIdB: number | null = null;

	// Which canvas is currently active (visible)
	private activeCanvas: 'A' | 'B' = 'A';

	// Current state
	private currentType: BackgroundType | null = null;
	private currentOptions: BackgroundOptions = {};
	private quality: QualityLevel = 'medium';

	// Transition state
	private isTransitioning = false;
	private pendingType: BackgroundType | null = null;
	private pendingOptions: BackgroundOptions | null = null;

	// Lifecycle flags
	private mounted = false;
	private initialized = false;
	private initializationInProgress = false; // Lock to prevent concurrent initialization

	// Resize observer
	private resizeObserver: ResizeObserver | null = null;

	// ═══════════════════════════════════════════════════════════════════════════
	// PUBLIC API
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Mount the controller to a container element.
	 * Creates canvas elements and sets up observers.
	 */
	mount(container: HTMLElement): void {
		// If already mounted to this exact container, just verify canvases
		if (this.mounted && this.container === container) {
			this.verifyCanvases();
			return;
		}

		// If mounted to a different container, unmount first
		if (this.mounted && this.container !== container) {
			this.unmount();
		}

		this.container = container;
		this.createCanvases();
		this.setupResizeObserver();
		this.mounted = true;

		// If we have a stored background type, initialize it
		if (this.currentType) {
			void this.initializeBackground(this.currentType, this.currentOptions);
		}
	}

	/**
	 * Unmount the controller.
	 * Stops animations, cleans up systems, removes canvases.
	 */
	unmount(): void {
		// Stop all animations
		this.stopAnimation('A');
		this.stopAnimation('B');

		// Cleanup background systems
		this.systemA?.cleanup();
		this.systemB?.cleanup();
		this.systemA = null;
		this.systemB = null;

		// Disconnect resize observer
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;

		// Remove canvases from DOM
		this.canvasA?.remove();
		this.canvasB?.remove();
		this.canvasA = null;
		this.canvasB = null;

		// Clear container reference
		this.container = null;

		// Reset flags (but keep currentType for potential remount)
		this.mounted = false;
		this.initialized = false;
	}

	/**
	 * Set the background type.
	 */
	async setBackground(type: BackgroundType, options?: BackgroundOptions): Promise<void> {
		// Merge options with existing (allows partial updates)
		if (options) {
			this.currentOptions = { ...this.currentOptions, ...options };
		}

		// If not mounted yet, just store for later
		if (!this.mounted) {
			this.currentType = type;
			return;
		}

		// If same type, already initialized, and canvas has content → no-op
		if (
			this.currentType === type &&
			this.initialized &&
			!this.isActiveCanvasBlank()
		) {
			return;
		}

		// If currently transitioning, queue this request
		if (this.isTransitioning) {
			this.pendingType = type;
			this.pendingOptions = options || null;
			return;
		}

		// First initialization or recovery from blank canvas
		if (!this.initialized || this.isActiveCanvasBlank()) {
			// Prevent concurrent initialization calls
			if (this.initializationInProgress) {
				this.pendingType = type;
				this.pendingOptions = options || null;
				return;
			}
			await this.initializeBackground(type, this.currentOptions);
			return;
		}

		// Type changed - perform crossfade
		await this.performCrossfade(type, this.currentOptions);
	}

	/**
	 * Set quality level.
	 */
	setQuality(quality: QualityLevel): void {
		this.quality = quality;
		this.systemA?.setQuality(quality);
		this.systemB?.setQuality(quality);
	}

	/**
	 * Get current background type.
	 */
	getCurrentType(): BackgroundType | null {
		return this.currentType;
	}

	/**
	 * Check if ready.
	 */
	isReady(): boolean {
		return this.mounted && this.initialized && !this.isActiveCanvasBlank();
	}

	/**
	 * Force a refresh.
	 */
	forceRefresh(): void {
		if (this.currentType && this.mounted) {
			this.initialized = false;
			void this.initializeBackground(this.currentType, this.currentOptions);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// PRIVATE METHODS - Canvas Management
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Create the dual canvas elements inside the container.
	 */
	private createCanvases(): void {
		if (!this.container) return;

		// Create canvas A
		this.canvasA = document.createElement('canvas');
		this.canvasA.className = 'background-canvas canvas-a';
		this.canvasA.setAttribute('aria-hidden', 'true');

		// Create canvas B
		this.canvasB = document.createElement('canvas');
		this.canvasB.className = 'background-canvas canvas-b';
		this.canvasB.setAttribute('aria-hidden', 'true');

		// Set initial active state
		this.updateActiveCanvasClass();

		// Append to container
		this.container.appendChild(this.canvasA);
		this.container.appendChild(this.canvasB);

		// Set initial dimensions
		this.updateCanvasDimensions();
	}

	/**
	 * Verify canvases are still in the DOM.
	 * Called when mount() is called on an already-mounted controller.
	 */
	private verifyCanvases(): void {
		if (!this.container) return;

		const aInDom = this.canvasA?.parentElement === this.container;
		const bInDom = this.canvasB?.parentElement === this.container;

		if (!aInDom || !bInDom) {
			// Canvases were removed (HMR?), recreate them
			this.canvasA?.remove();
			this.canvasB?.remove();
			this.createCanvases();

			// Re-initialize if we had a background
			if (this.currentType) {
				this.initialized = false;
				void this.initializeBackground(this.currentType, this.currentOptions);
			}
		}
	}

	/**
	 * Set up resize observer on the container.
	 */
	private setupResizeObserver(): void {
		if (!this.container || typeof ResizeObserver === 'undefined') return;

		this.resizeObserver = new ResizeObserver(() => {
			this.handleResize();
		});
		this.resizeObserver.observe(this.container);
	}

	/**
	 * Update canvas dimensions to match container.
	 */
	private updateCanvasDimensions(): void {
		if (!this.canvasA || !this.canvasB || !this.container) return;

		const rect = this.container.getBoundingClientRect();
		const width = Math.max(1, Math.floor(rect.width));
		const height = Math.max(1, Math.floor(rect.height));

		this.canvasA.width = width;
		this.canvasA.height = height;
		this.canvasB.width = width;
		this.canvasB.height = height;
	}

	/**
	 * Handle container resize.
	 */
	private handleResize(): void {
		const oldWidth = this.canvasA?.width || 0;
		const oldHeight = this.canvasA?.height || 0;

		this.updateCanvasDimensions();

		const newWidth = this.canvasA?.width || 0;
		const newHeight = this.canvasA?.height || 0;

		// Only notify systems if dimensions actually changed
		if (oldWidth !== newWidth || oldHeight !== newHeight) {
			const oldDim = { width: oldWidth, height: oldHeight };
			const newDim = { width: newWidth, height: newHeight };
			this.systemA?.handleResize?.(oldDim, newDim);
			this.systemB?.handleResize?.(oldDim, newDim);
		}
	}

	/**
	 * Update CSS classes to reflect active canvas.
	 */
	private updateActiveCanvasClass(): void {
		if (this.canvasA) {
			this.canvasA.classList.toggle('active', this.activeCanvas === 'A');
		}
		if (this.canvasB) {
			this.canvasB.classList.toggle('active', this.activeCanvas === 'B');
		}
	}

	/**
	 * Check if the active canvas is blank (no content).
	 */
	private isActiveCanvasBlank(): boolean {
		const canvas = this.activeCanvas === 'A' ? this.canvasA : this.canvasB;
		if (!canvas) return true;

		// Use willReadFrequently for performance
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return true;

		try {
			// Sample a pixel - if alpha is 0, canvas is blank
			const pixel = ctx.getImageData(0, 0, 1, 1).data;
			return pixel[3] === 0;
		} catch {
			// getImageData can throw in certain scenarios
			return true;
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// PRIVATE METHODS - Background Initialization & Transitions
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Initialize the first background (no crossfade).
	 */
	private async initializeBackground(
		type: BackgroundType,
		options: BackgroundOptions
	): Promise<void> {
		if (!this.canvasA) {
			return;
		}

		// Set lock immediately to prevent concurrent calls
		this.initializationInProgress = true;

		try {
			// Clean up any existing systems
			this.stopAnimation('A');
			this.stopAnimation('B');
			this.systemA?.cleanup();
			this.systemB?.cleanup();
			this.systemA = null;
			this.systemB = null;

			// Create the background system
			let system;
			try {
				system = await BackgroundFactory.createBackgroundSystem({
					type,
					quality: this.quality,
					initialQuality: this.quality,
					thumbnailMode: options.thumbnailMode,
					backgroundColor: options.backgroundColor,
					gradientColors: options.gradientColors,
					gradientDirection: options.gradientDirection
				});
			} catch (factoryError) {
				this.initializationInProgress = false;
				return;
			}

			if (!system) {
				this.initializationInProgress = false;
				return;
			}

			// Store and activate on canvas A
			this.systemA = system;
			this.activeCanvas = 'A';
			this.updateActiveCanvasClass();

			// Initialize the system with current dimensions
			const dimensions = {
				width: this.canvasA.width,
				height: this.canvasA.height
			};
			system.initialize(dimensions, this.quality);

			// Start the animation loop
			this.startAnimation('A', type);

			// Update state
			this.currentType = type;
			this.initialized = true;
		} finally {
			// Always release lock
			this.initializationInProgress = false;
		}

		// Process any pending request that came in during initialization
		if (this.pendingType && this.pendingType !== type) {
			const pending = this.pendingType;
			const pendingOpts = this.pendingOptions || options;
			this.pendingType = null;
			this.pendingOptions = null;
			await this.performCrossfade(pending, pendingOpts);
		} else {
			this.pendingType = null;
			this.pendingOptions = null;
		}
	}

	/**
	 * Perform a crossfade transition to a new background.
	 */
	private async performCrossfade(
		newType: BackgroundType,
		options: BackgroundOptions
	): Promise<void> {
		this.isTransitioning = true;

		// Determine which canvas to use for the new background
		const incomingCanvas = this.activeCanvas === 'A' ? 'B' : 'A';
		const canvas = incomingCanvas === 'A' ? this.canvasA : this.canvasB;

		if (!canvas) {
			this.isTransitioning = false;
			return;
		}

		// Create the new background system
		const newSystem = await BackgroundFactory.createBackgroundSystem({
			type: newType,
			quality: this.quality,
			initialQuality: this.quality,
			thumbnailMode: options.thumbnailMode,
			backgroundColor: options.backgroundColor,
			gradientColors: options.gradientColors,
			gradientDirection: options.gradientDirection
		});

		// Store the new system
		if (incomingCanvas === 'A') {
			this.systemA = newSystem;
		} else {
			this.systemB = newSystem;
		}

		// Initialize with current dimensions
		const dimensions = { width: canvas.width, height: canvas.height };
		newSystem.initialize(dimensions, this.quality);

		// Start animation on the new canvas
		this.startAnimation(incomingCanvas, newType);

		// Wait for at least one frame to render
		await this.waitForFrame();
		await this.waitForFrame();

		// Trigger the CSS crossfade
		this.activeCanvas = incomingCanvas;
		this.updateActiveCanvasClass();

		// Wait for CSS transition (500ms)
		await this.delay(500);

		// Cleanup the old system
		const oldCanvas = incomingCanvas === 'A' ? 'B' : 'A';
		this.stopAnimation(oldCanvas);

		const oldSystem = oldCanvas === 'A' ? this.systemA : this.systemB;
		oldSystem?.cleanup();

		if (oldCanvas === 'A') {
			this.systemA = null;
		} else {
			this.systemB = null;
		}

		// Update state
		this.currentType = newType;
		this.isTransitioning = false;

		// Process any pending request
		if (this.pendingType && this.pendingType !== newType) {
			const pending = this.pendingType;
			const pendingOpts = this.pendingOptions || options;
			this.pendingType = null;
			this.pendingOptions = null;
			await this.performCrossfade(pending, pendingOpts);
		} else {
			this.pendingType = null;
			this.pendingOptions = null;
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// PRIVATE METHODS - Animation Loop
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Start the animation loop for a canvas.
	 */
	private startAnimation(which: 'A' | 'B', type: BackgroundType): void {
		const canvas = which === 'A' ? this.canvasA : this.canvasB;
		const system = which === 'A' ? this.systemA : this.systemB;

		if (!canvas || !system) return;

		const ctx = canvas.getContext('2d', { willReadFrequently: false });
		if (!ctx) return;

		// Check if this is a static background (no animation needed)
		const isStatic =
			type === BackgroundType.SOLID_COLOR ||
			type === BackgroundType.LINEAR_GRADIENT;

		if (isStatic) {
			// Render once and exit
			const dimensions = { width: canvas.width, height: canvas.height };
			system.draw(ctx, dimensions);
			return;
		}

		// Animated background - start the loop
		let lastTimestamp = 0;

		// Maximum delta time cap - prevents teleporting after HMR/tab switch
		// 100ms = ~6 frames at 60fps, a reasonable upper bound
		const MAX_DELTA_MS = 100;

		const animate = (timestamp: number): void => {
			// Get current system (may have changed)
			const currentSystem = which === 'A' ? this.systemA : this.systemB;
			if (!currentSystem || !canvas) return;

			// Calculate delta time with proper first-frame handling
			// First frame has no reference point, use ideal 60fps frame time
			const rawDelta = lastTimestamp === 0 ? 16.67 : timestamp - lastTimestamp;
			lastTimestamp = timestamp;

			// Clamp to prevent teleporting after tab visibility change or HMR
			const deltaTime = Math.min(rawDelta, MAX_DELTA_MS);

			// Frame multiplier for consistent speed regardless of frame rate
			const frameMultiplier = deltaTime / 16.67; // Normalized to 60fps

			// Get current dimensions
			const dimensions = { width: canvas.width, height: canvas.height };

			// Update and draw
			currentSystem.update(dimensions, frameMultiplier);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			currentSystem.draw(ctx, dimensions);

			// Schedule next frame
			if (which === 'A') {
				this.animationIdA = requestAnimationFrame(animate);
			} else {
				this.animationIdB = requestAnimationFrame(animate);
			}
		};

		// Start the loop
		if (which === 'A') {
			this.animationIdA = requestAnimationFrame(animate);
		} else {
			this.animationIdB = requestAnimationFrame(animate);
		}
	}

	/**
	 * Stop the animation loop for a canvas.
	 */
	private stopAnimation(which: 'A' | 'B'): void {
		if (which === 'A' && this.animationIdA !== null) {
			cancelAnimationFrame(this.animationIdA);
			this.animationIdA = null;
		} else if (which === 'B' && this.animationIdB !== null) {
			cancelAnimationFrame(this.animationIdB);
			this.animationIdB = null;
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// PRIVATE METHODS - Utilities
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Wait for the next animation frame.
	 */
	private waitForFrame(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => resolve()));
	}

	/**
	 * Delay for a specified time.
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE - Persists across HMR via import.meta.hot.data
// ═══════════════════════════════════════════════════════════════════════════════

let controllerInstance: BackgroundController | null = null;

// Restore from HMR data if available
if (import.meta.hot?.data?.backgroundController) {
	controllerInstance = import.meta.hot.data.backgroundController as BackgroundController;
}

/**
 * Get the singleton BackgroundController instance.
 *
 * The instance persists across HMR module reloads via import.meta.hot.data.
 * This ensures the canvas state survives code changes during development.
 *
 * @example
 * ```typescript
 * const controller = getBackgroundController();
 * controller.mount(containerElement);
 * await controller.setBackground(BackgroundType.DEEP_OCEAN);
 * ```
 */
export function getBackgroundController(): BackgroundController {
	if (!controllerInstance) {
		controllerInstance = new BackgroundController();
	}

	// Store in HMR data for persistence across module reloads
	if (import.meta.hot) {
		import.meta.hot.data.backgroundController = controllerInstance;
	}

	return controllerInstance;
}

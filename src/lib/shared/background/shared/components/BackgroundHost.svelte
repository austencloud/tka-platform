<!--
  BackgroundHost - Thin Svelte wrapper around BackgroundController

  This component:
  1. Provides a container div for the controller to mount its canvases
  2. Bridges Svelte's reactive props to the controller's imperative API
  3. Handles the mount/unmount lifecycle

  The actual rendering logic lives in BackgroundController, which survives HMR.
  This component can remount many times - the controller persists.

  ## Why This Architecture

  Svelte's $state resets on HMR, but canvas rendering needs persistent state.
  By keeping all canvas state in a singleton controller that persists via
  import.meta.hot.data, we avoid the coordination problems that caused
  backgrounds to go black after HMR.

  ## Key Behavior

  - onMount: Calls controller.mount(container)
  - $effect: Calls controller.setBackground(type) when props change
  - onDestroy: Does NOT unmount controller (it persists for HMR)
  - Controller handles its own canvas creation, animation, and cleanup
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { BackgroundType } from '../domain/enums/background-enums';
	import type { QualityLevel } from '../domain/types/background-types';
	import { getBackgroundController } from '../services/implementations/BackgroundController';

	// Props - same interface as old BackgroundCanvas for compatibility
	const {
		backgroundType = BackgroundType.SOLID_COLOR,
		quality = 'medium' as QualityLevel,
		backgroundColor = '#000000',
		gradientColors,
		gradientDirection,
		thumbnailMode = false,
		onReady
	} = $props<{
		backgroundType?: BackgroundType;
		quality?: QualityLevel;
		backgroundColor?: string;
		gradientColors?: string[];
		gradientDirection?: number;
		thumbnailMode?: boolean;
		onReady?: () => void;
	}>();

	// Container element reference
	let containerRef: HTMLDivElement;

	// Get controller instance (singleton, survives HMR)
	const controller = browser ? getBackgroundController() : null;

	// Track if we've done initial setup (must be $state for $effect to re-run)
	let hasInitialized = $state(false);

	// Some backgrounds use fixed positioning
	let isFixedPosition = $derived(
		backgroundType === BackgroundType.FIREFLY_FOREST ||
			backgroundType === BackgroundType.PRIDE
	);

	// Mount controller when container is ready
	onMount(() => {
		if (!browser || !containerRef || !controller) return;

		// Mount the controller to our container
		controller.mount(containerRef);

		// Set quality
		controller.setQuality(quality);

		// Set initial background
		controller
			.setBackground(backgroundType, {
				backgroundColor,
				gradientColors,
				gradientDirection,
				thumbnailMode
			})
			.then(() => {
				hasInitialized = true;
				onReady?.();
			});
	});

	// React to background type changes
	$effect(() => {
		if (!browser || !controller || !hasInitialized) {
			return;
		}

		// This effect runs when backgroundType or options change
		// The controller handles "same type" no-op internally
		controller.setBackground(backgroundType, {
			backgroundColor,
			gradientColors,
			gradientDirection,
			thumbnailMode
		});
	});

	// React to quality changes
	$effect(() => {
		if (!browser || !controller) return;
		controller.setQuality(quality);
	});

	// Cleanup on destroy
	onDestroy(() => {
		// IMPORTANT: We do NOT unmount the controller here!
		//
		// The controller persists across component remounts (HMR).
		// If we unmounted here, the background would disappear every time
		// Svelte remounts this component during HMR.
		//
		// The controller will only be truly unmounted when:
		// 1. The app is closing
		// 2. The user explicitly disables backgrounds
		// 3. Navigation to a page without backgrounds
		//
		// For those cases, the parent component should call controller.unmount()
		// directly, or we'd need a different cleanup strategy.
	});
</script>

<div
	bind:this={containerRef}
	class="background-container"
	class:fixed={isFixedPosition}
	class:initialized={hasInitialized}
	aria-hidden="true"
></div>

<style>
	.background-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
		opacity: 0;
		transition: opacity 0.3s ease-in-out;
	}

	.background-container.initialized {
		opacity: 1;
	}

	/* Fixed positioning for backgrounds that look awkward when stretched */
	.background-container.fixed {
		position: fixed;
	}

	/*
	 * Canvas styles - these are applied to canvases created by the controller.
	 * Using :global because the canvases are created imperatively, not in this template.
	 */
	:global(.background-canvas) {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		transition: opacity 0.5s ease-in-out;
	}

	:global(.background-canvas.active) {
		opacity: 1;
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.background-container,
		:global(.background-canvas) {
			transition: none;
		}
	}
</style>

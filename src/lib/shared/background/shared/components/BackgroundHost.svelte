<!--
  BackgroundHost - Thin Svelte wrapper around shared package BackgroundController

  Uses @austencloud/backgrounds for all rendering. The controller singleton
  survives HMR via import.meta.hot.data. This component just provides a
  mount point and bridges Svelte reactive props to the controller's API.

  Pattern matches Ringmaster's BackgroundCanvas.svelte which is proven stable.
-->
<script lang="ts">
	import '@austencloud/backgrounds/css/backgrounds.css';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { BackgroundType, getBackgroundController } from '@austencloud/backgrounds';
	import { isBackgroundSuppressed } from '../state/background-suppression.svelte';

	const {
		backgroundType = BackgroundType.COSMIC,
		backgroundColor = '#000000',
		gradientColors,
		gradientDirection,
		thumbnailMode = false,
		onReady
	} = $props<{
		backgroundType?: BackgroundType;
		backgroundColor?: string;
		gradientColors?: string[];
		gradientDirection?: number;
		thumbnailMode?: boolean;
		onReady?: () => void;
	}>();

	let containerRef: HTMLDivElement | undefined = $state();
	const controller = browser ? getBackgroundController() : null;
	let mounted = $state(false);

	// The @austencloud/backgrounds package caps canvas at 960×540 for perf,
	// but that makes 2D backgrounds look zoomed/blurry on modern displays.
	// Patch the controller to use full viewport resolution (capped at 1x DPR).
	// Proper fix: expose a public resolution API in @austencloud/backgrounds and
	// remove this patch. Until then, keep it typed via the interface below.

	/** Private fields accessed by the patched updateCanvasDimensions method. */
	interface BackgroundControllerPrivate {
		canvasA: HTMLCanvasElement | null;
		canvasB: HTMLCanvasElement | null;
		container: HTMLElement | null;
		updateCanvasDimensions: () => void;
	}

	function patchCanvasResolution(ctrl: NonNullable<typeof controller>) {
		const c = ctrl as unknown as BackgroundControllerPrivate;
		c.updateCanvasDimensions = function (this: BackgroundControllerPrivate) {
			const cA = this.canvasA;
			const cB = this.canvasB;
			const cont = this.container;
			if (!cA || !cB || !cont) return;
			const rect = cont.getBoundingClientRect();
			const w = Math.max(1, Math.floor(rect.width));
			const h = Math.max(1, Math.floor(rect.height));
			cA.width = w;
			cA.height = h;
			cB.width = w;
			cB.height = h;
		};
	}

	onMount(() => {
		if (!browser || !containerRef || !controller) return;
		mounted = true;
		onReady?.();

		// App-wide cursor flee: the container is pointer-events:none, so listen on
		// window and map client coords to container-relative px. The canvas is sized
		// to the container (patchCanvasResolution), so container CSS px == canvas
		// logical px. setPointer is a no-op for non-ocean backgrounds (their systems
		// lack setPointer), so this is safe app-wide.
		const onPointerMove = (e: PointerEvent) => {
			if (!controller || !containerRef) return;
			const rect = containerRef.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
			controller.setPointer(x, y, inside);
		};
		const onPointerLeaveWin = () => controller?.setPointer(0, 0, false);
		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('pointerleave', onPointerLeaveWin);

		return () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerleave', onPointerLeaveWin);
		};
	});

	onDestroy(() => {
		// Don't unmount the controller - it persists for HMR and
		// survives component remounts. Only unmount if the app is
		// truly closing, which SvelteKit handles via navigation.
	});

	// Single owner of the controller's mount/unmount/background lifecycle.
	// Re-runs on: initial mount, background prop changes, and suppression toggles.
	//
	// Suppression: a fullscreen-opaque scene (e.g. the museum) registers a
	// suppressor so we unmount the controller while it's fully occluded. The
	// controller's rAF runs even when its canvas is covered, so an un-paused
	// ocean background burned ~40% of the main thread behind the museum and
	// stalled the 2D->3D flip. unmount() stops that loop; mount() restores it.
	$effect(() => {
		if (!mounted || !controller || !containerRef) return;

		if (isBackgroundSuppressed.current) {
			if (controller.isReady()) controller.unmount();
			return;
		}

		// mount() is idempotent and container-aware: a no-op when already bound to
		// this container, a re-bind (unmount + remount) when the container changed.
		// Gating it on isReady() was the bug — once mounted+initialized, isReady()
		// stays true, so after any SPA navigation / remount the new container never
		// received the canvases and only the CSS gradient showed. Always call mount()
		// so the canvases follow the current container; only (re)patch + resize when
		// we actually bind a new one.
		const priv = controller as unknown as BackgroundControllerPrivate;
		const needsBind = priv.container !== containerRef;
		controller.mount(containerRef);
		if (needsBind) {
			patchCanvasResolution(controller);
			priv.updateCanvasDimensions();
		}
		controller.setBackground(backgroundType, {
			backgroundColor,
			gradientColors,
			gradientDirection,
			thumbnailMode
		});
	});
</script>

<div
	bind:this={containerRef}
	class="background-canvas-container"
	aria-hidden="true"
></div>

<style>
	.background-canvas-container {
		position: fixed;
		inset: 0;
		z-index: -1;
		overflow: hidden;
		pointer-events: none;
	}
</style>

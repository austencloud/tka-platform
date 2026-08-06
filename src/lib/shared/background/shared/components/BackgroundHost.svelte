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
	import {
		createJellyfishChime,
		buildPentatonicNotes,
		midiToFreq
	} from '$lib/shared/3d/environments/scenes/ocean/runtime/fauna/jellyfish/jellyfish-chime';
	import { isBackgroundSuppressed } from '../state/background-suppression.svelte';
	import { sharedAnimationState } from '$lib/shared/animation-engine/state/shared-animation-state.svelte';
	import { shouldReduceBackgroundResolution } from '$lib/shared/platform/network-conditions';

	const {
		backgroundType = BackgroundType.COSMIC,
		backgroundColor = '#000000',
		gradientColors,
		gradientDirection,
		thumbnailMode = false,
		pauseDuringPlayback = false,
		onReady
	} = $props<{
		backgroundType?: BackgroundType;
		backgroundColor?: string;
		gradientColors?: string[];
		gradientDirection?: number;
		thumbnailMode?: boolean;
		/** Pause the background's rAF while any animation player is playing
		 *  (sharedAnimationState.isPlaying). The background loop repaints a
		 *  viewport-sized canvas every frame, and its bursty entities (cosmic
		 *  comets/UFOs, ocean fish) steal enough main thread to visibly stutter
		 *  playback — measured 37.9fps/40.7% hitch frames vs 59.9fps/0.1% with
		 *  the loop stopped. The app shell opts in; marketing surfaces
		 *  (MarketingChrome, shop) keep their backdrop alive. */
		pauseDuringPlayback?: boolean;
		onReady?: () => void;
	}>();

	let containerRef: HTMLDivElement | undefined = $state();
	const controller = browser ? getBackgroundController() : null;
	let mounted = $state(false);

	// Layout-readiness gate. Bumped from a deferred frame to re-run the lifecycle
	// $effect once the container has actually laid out to a real size. See the gate
	// in that effect for why seeding before layout permanently breaks the cosmic
	// background. layoutRetries bounds the wait so a legitimately zero-size host
	// (if one ever exists) still mounts instead of spinning rAF forever.
	let layoutReadyTick = $state(0);
	let layoutRetries = 0;
	let pendingLayoutRaf: number | null = null;
	const MAX_LAYOUT_RETRIES = 60; // ~1s at 60fps before we give up and mount anyway

	// True while the tab is hidden (switched away, minimized, screen off). The
	// @austencloud/backgrounds controller runs its rAF regardless of visibility,
	// so without this it keeps burning CPU and battery painting a canvas nobody
	// can see. We pause it via the same unmount/mount lever the fullscreen-scene
	// suppression uses, and resume when the tab comes back.
	let pageHidden = $state(false);

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
		// The active/incoming background systems. Read-only here to hover-test the
		// ocean jellyfish swarm for a desktop pointer cursor (see pointerOverJelly).
		systemA: unknown;
		systemB: unknown;
	}

	// Read-only shape of the ocean system's jelly swarm, mirrored just enough to
	// hit-test. The real state lives on the (TS-private) OceanBackgroundOrchestrator
	// and is only reached to give a hover affordance; everything is optional-chained
	// so a non-ocean background — or a future package that renames the field — is a
	// silent no-op, exactly like the setPointer/pokeAt guards above.
	interface OceanSystemLike {
		state?: { jellyfish?: { x: number; y: number; size: number }[] };
	}

	function jellyHit(system: unknown, x: number, y: number): boolean {
		const jellies = (system as OceanSystemLike | null)?.state?.jellyfish;
		if (!Array.isArray(jellies)) return false;
		for (const j of jellies) {
			// Match pokeAt's generous hit radius (size * 0.6) so the cursor flips
			// exactly where a poke would land.
			const r = j.size * 0.6;
			const dx = j.x - x;
			const dy = j.y - y;
			if (dx * dx + dy * dy <= r * r) return true;
		}
		return false;
	}

	// True when (x, y) — container CSS px — is over a pokeable jelly on either the
	// active or incoming (mid-crossfade) system, mirroring pokeAt's systemA ?? systemB.
	function pointerOverJelly(ctrl: NonNullable<typeof controller>, x: number, y: number): boolean {
		const c = ctrl as unknown as BackgroundControllerPrivate;
		return jellyHit(c.systemA, x, y) || jellyHit(c.systemB, x, y);
	}

	// The 2D background sits behind the whole app (pointer-events:none, z-index:-1),
	// so the window-level pointerdown fires even when the click really landed on a
	// control sitting on top of a jelly. Clicking that button must not also ring the
	// jelly hiding behind it. A pointerdown/hover whose target resolves to an
	// interactive element is "consumed by the UI" — skip the poke and the hover
	// cursor there. Covers native controls plus the ARIA/tabbable widgets this app
	// uses (role="button"/"switch" divs, per the no-checkboxes toggle pattern).
	const INTERACTIVE_SELECTOR =
		'a[href], button, input, select, textarea, label, summary, ' +
		'[role="button"], [role="link"], [role="tab"], [role="menuitem"], ' +
		'[role="switch"], [role="checkbox"], [role="radio"], [role="option"], ' +
		'[contenteditable=""], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

	function isInteractiveTarget(target: EventTarget | null): boolean {
		return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
	}

	// On a genuinely low-capability device (explicit data-saver, or a slow 3g-or-worse
	// radio bucket) the device is usually a phone that can't comfortably repaint the
	// background at full viewport resolution every frame. In that case we cap the
	// longest side so the background stays cheap. The cap mirrors the upstream
	// package's own perf-first default, so the controller's pointer hit-testing
	// (cursor flee, jellyfish poke) keeps working with a sub-viewport buffer just as
	// it does by default. The check runs inside updateCanvasDimensions so it
	// re-evaluates on every resize — if conditions improve, a later resize restores
	// full res.
	//
	// This uses shouldReduceBackgroundResolution(), NOT isConstrainedConnection().
	// Render resolution must not key off the noisy downlink-Mbps bandwidth estimate
	// the prefetch heuristic uses: Chrome routinely under-reports downlink to 1–2
	// Mbps on capable links (and on localhost), and a false positive there caps the
	// canvas to 960px and stretches it ~2x across the viewport — the whole background
	// renders zoomed in and blurry, permanently, until the estimate happens to rise.
	const CONSTRAINED_MAX_DIMENSION = 960;

	function patchCanvasResolution(ctrl: NonNullable<typeof controller>) {
		const c = ctrl as unknown as BackgroundControllerPrivate;
		c.updateCanvasDimensions = function (this: BackgroundControllerPrivate) {
			const cA = this.canvasA;
			const cB = this.canvasB;
			const cont = this.container;
			if (!cA || !cB || !cont) return;
			const rect = cont.getBoundingClientRect();
			let w = Math.max(1, Math.floor(rect.width));
			let h = Math.max(1, Math.floor(rect.height));
			if (shouldReduceBackgroundResolution()) {
				const longest = Math.max(w, h);
				if (longest > CONSTRAINED_MAX_DIMENSION) {
					const scale = CONSTRAINED_MAX_DIMENSION / longest;
					w = Math.max(1, Math.floor(w * scale));
					h = Math.max(1, Math.floor(h * scale));
				}
			}
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

		// Dev-only escape hatch so automated verification (DevTools MCP) can query
		// the live background state — jelly positions, hoverGlow, active system —
		// without guessing canvas pixels. Stripped from prod builds by the DEV gate.
		if (import.meta.env.DEV) {
			(window as unknown as Record<string, unknown>).__tkaBackgroundController = controller;
		}

		// App-wide cursor flee: the container is pointer-events:none, so listen on
		// window and map client coords to container-relative px. The canvas is sized
		// to the container (patchCanvasResolution), so container CSS px == canvas
		// logical px. setPointer is method-optional-chained: it no-ops for
		// non-ocean backgrounds (their systems lack setPointer) AND for a stale
		// HMR-persisted controller singleton from a pre-0.6.2 build that predates
		// the setPointer API. Safe app-wide; a hard reload picks up the new method.
		// Desktop-only: show a pointer cursor while hovering a pokeable 2D jelly, so a
		// mouse user can tell the swarm is interactive (the pointerdown poke already
		// works window-wide). Touch has no hover state, so gate to a fine pointer with
		// hover. The container is pointer-events:none behind the app, so the cursor is
		// set on <body> — an inherited property, so descendants that don't set their
		// own cursor pick it up, while buttons/inputs keep theirs. On desktop the canvas
		// is sized 1:1 to the container (the constrained-res cap only trips on
		// phones/data-saver), so container CSS px == the canvas-logical px the jelly
		// positions live in — the same space pokeAt() hit-tests.
		const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
		let cursorOverJelly = false;
		const setJellyCursor = (over: boolean) => {
			if (over === cursorOverJelly) return;
			cursorOverJelly = over;
			document.body.style.cursor = over ? 'pointer' : '';
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!controller || !containerRef) return;
			const rect = containerRef.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
			controller.setPointer?.(x, y, inside, e.pointerType);
			if (finePointer.matches) {
				// Only claim the pointer cursor where a poke would actually fire — not
				// over a control sitting on top of the jelly (it owns its own cursor).
				setJellyCursor(inside && !isInteractiveTarget(e.target) && pointerOverJelly(controller, x, y));
			}
		};
		const onPointerLeaveWin = () => {
			controller.setPointer?.(0, 0, false);
			setJellyCursor(false);
		};
		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('pointerleave', onPointerLeaveWin);

		// Jellyfish "ding": tap a 2D ocean jelly to ring a warm pentatonic bell,
		// pitch by screen height, pan by screen X — mirrors the 3D JellyfishSwarm.
		// The chime is a pure-WebAudio synth shared with the 3D scene (no-op when
		// Web Audio is unavailable). A fixed 16-note table covers the swarm; the
		// poked jelly's pitch01 indexes it. pokeAt is method-optional-chained, so
		// this is a safe no-op for non-ocean backgrounds and for a stale
		// HMR-persisted controller from a pre-0.6.3 build that predates pokeAt.
		const chime = createJellyfishChime();
		const notes = buildPentatonicNotes(16);
		const onPointerDown = (e: PointerEvent) => {
			if (!controller || !containerRef) return;
			// A click that landed on real UI on top of the background must not also
			// poke a jelly hiding behind it.
			if (isInteractiveTarget(e.target)) return;
			const rect = containerRef.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const r = controller.pokeAt?.(x, y);
			if (r?.hit) {
				const idx = Math.round(r.pitch01 * (notes.length - 1));
				chime.play(midiToFreq(notes[idx]!), r.pan);
			}
		};
		window.addEventListener('pointerdown', onPointerDown);

		// Pause the background's animation loop while the tab is hidden, resume on
		// return. The lifecycle $effect below reacts to pageHidden.
		const onVisibilityChange = () => {
			pageHidden = document.hidden;
		};
		pageHidden = document.hidden;
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			window.removeEventListener('pointermove', onPointerMove);
			window.removeEventListener('pointerleave', onPointerLeaveWin);
			window.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			setJellyCursor(false); // never leave a stray pointer cursor on <body>
			chime.dispose();
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

		// Pause when a fullscreen-opaque scene is occluding us, when the tab is
		// hidden, or (opt-in) while an animation player is playing — in all three
		// cases the rAF would otherwise burn main-thread time the user either
		// can't see or actively needs for smooth playback. unmount() stops the
		// loop; the branch below remounts it.
		if (
			isBackgroundSuppressed.current ||
			pageHidden ||
			(pauseDuringPlayback && sharedAnimationState.isPlaying)
		) {
			if (controller.isReady()) controller.unmount();
			return;
		}

		// Don't mount/seed until the container has laid out to a real size. The
		// cosmic star & nebula fields are generated ONCE at the system's
		// initialize() from the canvas dimensions, and they cannot grow back from a
		// zero-area seed: ParallaxStarSystem.adaptToNewDimensions() adds stars
		// proportional to the CURRENT count (≈count*0.5 per resize), so an empty
		// field stays empty no matter how large the canvas later becomes. A mount
		// that runs before layout — e.g. the HMR-persisted controller singleton
		// remounting between frames, or createCanvases() measuring the container
		// before it has been laid out — therefore seeds an empty field and leaves a
		// permanent gradient-only background (the symptom: "every once in a while it
		// just gives me the placeholder gradient"). Wait for a real size first.
		void layoutReadyTick; // dependency: a deferred frame bumps this to re-run us
		const rect = containerRef.getBoundingClientRect();
		if ((rect.width < 1 || rect.height < 1) && layoutRetries < MAX_LAYOUT_RETRIES) {
			// Re-run on the next frame once layout settles. The rAF handle is held on
			// the component (not returned as effect cleanup) so every branch of this
			// effect returns void — a mixed void/cleanup return trips noImplicitReturns.
			if (pendingLayoutRaf !== null) cancelAnimationFrame(pendingLayoutRaf);
			pendingLayoutRaf = requestAnimationFrame(() => {
				pendingLayoutRaf = null;
				layoutRetries += 1;
				layoutReadyTick += 1;
			});
			return;
		}
		layoutRetries = 0;

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

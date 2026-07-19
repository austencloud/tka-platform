/**
 * magnetic.ts - Svelte action: pulls the node a few px toward the pointer
 *
 * Two @austencloud/backgrounds rAF springs (x, y) chase the pointer offset
 * from the element's center, clamped to a small radius, and write
 * `--mag-x`/`--mag-y` (px) onto the node. Consuming CSS composes
 * `translate: var(--mag-x, 0px) var(--mag-y, 0px);` into its own transform
 * (see tilt.ts for the sibling --rot-x/--rot-y pattern).
 *
 * Skipped on coarse pointers and under prefers-reduced-motion: reduce.
 *
 * `enabled` (default true) lets a caller opt a specific instance out without
 * conditionally attaching/detaching the `use:` directive in markup — pass
 * `use:magnetic={tile.magnetic}` and non-magnetic tiles get a pure no-op.
 */

const MAX_OFFSET_PX = 6;
const PULL_FACTOR = 0.22;

// The /card barrel defines a Custom Element (extends HTMLElement) at module
// scope, so it can only be evaluated in the browser. Actions run client-side
// only, so a dynamic import here keeps the barrel out of the SSR module graph
// (same pattern as tilt.ts).
export function magnetic(node: HTMLElement, enabled: boolean = true) {
	const reduced =
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches;
	const coarse =
		typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;

	if (!enabled || reduced || coarse) {
		return { destroy() {} };
	}

	let destroyed = false;
	let cleanup: (() => void) | undefined;

	import("@austencloud/backgrounds/card").then(({ createSpring }) => {
		if (destroyed) return;

		const springX = createSpring(0, { stiffness: 260, damping: 20 });
		const springY = createSpring(0, { stiffness: 260, damping: 20 });
		springX.onUpdate((value) => node.style.setProperty("--mag-x", `${value.toFixed(2)}px`));
		springY.onUpdate((value) => node.style.setProperty("--mag-y", `${value.toFixed(2)}px`));

		function onPointerMove(event: PointerEvent) {
			const rect = node.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const dx = (event.clientX - cx) * PULL_FACTOR;
			const dy = (event.clientY - cy) * PULL_FACTOR;
			const magnitude = Math.hypot(dx, dy);
			const scale = magnitude > MAX_OFFSET_PX ? MAX_OFFSET_PX / magnitude : 1;
			springX.target = dx * scale;
			springY.target = dy * scale;
		}

		function onPointerLeave() {
			springX.target = 0;
			springY.target = 0;
		}

		node.addEventListener("pointermove", onPointerMove);
		node.addEventListener("pointerleave", onPointerLeave);

		cleanup = () => {
			node.removeEventListener("pointermove", onPointerMove);
			node.removeEventListener("pointerleave", onPointerLeave);
			springX.destroy();
			springY.destroy();
		};
	});

	return {
		destroy() {
			destroyed = true;
			cleanup?.();
		},
	};
}

/**
 * press-spring.ts - Svelte action for spring-driven press/scale feedback
 *
 * Springs a `--press` CSS custom property between 1 (rest) and a pressed
 * value on pointerdown, releasing back to 1 on pointerup/pointercancel/
 * pointerleave. Uses the shared @austencloud/backgrounds rAF spring — no
 * hand-rolled animation loop (see tilt.ts / cursor-glow.ts for the sibling
 * adapter pattern).
 *
 * Consuming CSS composes `scale(var(--press, 1))` into its own transform.
 *
 * Skipped entirely under prefers-reduced-motion: reduce (freeze press
 * movement, per the project's reduced-motion contract — only opacity/color
 * hover feedback survives).
 */

const PRESSED = 0.96;
const RESTING = 1;

// The /card barrel defines a Custom Element (extends HTMLElement) at module
// scope, so it can only be evaluated in the browser. Actions run client-side
// only, so a dynamic import here keeps the barrel out of the SSR module graph
// (same pattern as tilt.ts).
export function pressSpring(node: HTMLElement) {
	const reduced =
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-reduced-motion: reduce)").matches;

	if (reduced) {
		return { destroy() {} };
	}

	let destroyed = false;
	let cleanup: (() => void) | undefined;

	import("@austencloud/backgrounds/card").then(({ createSpring }) => {
		if (destroyed) return;

		const spring = createSpring(RESTING, { stiffness: 420, damping: 26 });
		spring.onUpdate((value) => {
			node.style.setProperty("--press", value.toFixed(4));
		});

		const press = () => {
			spring.target = PRESSED;
		};
		const release = () => {
			spring.target = RESTING;
		};

		node.addEventListener("pointerdown", press);
		node.addEventListener("pointerup", release);
		node.addEventListener("pointercancel", release);
		node.addEventListener("pointerleave", release);

		cleanup = () => {
			node.removeEventListener("pointerdown", press);
			node.removeEventListener("pointerup", release);
			node.removeEventListener("pointercancel", release);
			node.removeEventListener("pointerleave", release);
			spring.destroy();
		};
	});

	return {
		destroy() {
			destroyed = true;
			cleanup?.();
		},
	};
}

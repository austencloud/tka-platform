/**
 * tilt.ts - Svelte action adapter for @austencloud/backgrounds tilt effect
 *
 * Thin wrapper preserving `use:tilt` syntax while delegating to the shared package.
 */

import type { TiltEffectOptions } from "@austencloud/backgrounds/card";

export type TiltOptions = TiltEffectOptions;

// The /card barrel defines a Custom Element (extends HTMLElement) at module
// scope, so it can only be evaluated in the browser. Actions run client-side
// only, so a dynamic import here keeps the barrel out of the SSR module graph.
export function tilt(node: HTMLElement, options: TiltOptions = {}) {
	let destroyed = false;
	let destroyHandle: (() => void) | undefined;

	import("@austencloud/backgrounds/card").then(({ attachTiltEffect }) => {
		if (destroyed) return;
		destroyHandle = attachTiltEffect(node, options).destroy;
	});

	return {
		destroy() {
			destroyed = true;
			destroyHandle?.();
		},
	};
}

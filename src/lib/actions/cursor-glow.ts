/**
 * cursor-glow.ts - Svelte action adapter for @austencloud/backgrounds glow effect
 *
 * Thin wrapper preserving `use:cursorGlow` syntax while delegating to the shared package.
 */

import type { CursorGlowEffectOptions } from "@austencloud/backgrounds/card";

export type CursorGlowOptions = CursorGlowEffectOptions;

// The /card barrel defines a Custom Element (extends HTMLElement) at module
// scope, so it can only be evaluated in the browser. Actions run client-side
// only, so a dynamic import here keeps the barrel out of the SSR module graph
// (same pattern as tilt.ts).
export function cursorGlow(node: HTMLElement, options: CursorGlowOptions = {}) {
	let destroyed = false;
	let destroyHandle: (() => void) | undefined;

	import("@austencloud/backgrounds/card").then(({ attachCursorGlowEffect }) => {
		if (destroyed) return;
		destroyHandle = attachCursorGlowEffect(node, options).destroy;
	});

	return {
		destroy() {
			destroyed = true;
			destroyHandle?.();
		},
	};
}

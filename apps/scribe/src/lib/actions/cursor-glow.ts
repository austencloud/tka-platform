/**
 * cursor-glow.ts - Svelte action adapter for @austencloud/backgrounds glow effect
 *
 * Thin wrapper preserving `use:cursorGlow` syntax while delegating to the shared package.
 */

import { attachCursorGlowEffect } from "@austencloud/backgrounds/card";
import type { CursorGlowEffectOptions } from "@austencloud/backgrounds/card";

export type CursorGlowOptions = CursorGlowEffectOptions;

export function cursorGlow(node: HTMLElement, options: CursorGlowOptions = {}) {
	const handle = attachCursorGlowEffect(node, options);
	return { destroy: handle.destroy };
}

/**
 * tilt.ts - Svelte action adapter for @austencloud/backgrounds tilt effect
 *
 * Thin wrapper preserving `use:tilt` syntax while delegating to the shared package.
 */

import { attachTiltEffect } from "@austencloud/backgrounds/card";
import type { TiltEffectOptions } from "@austencloud/backgrounds/card";

export type TiltOptions = TiltEffectOptions;

export function tilt(node: HTMLElement, options: TiltOptions = {}) {
	const handle = attachTiltEffect(node, options);
	return { destroy: handle.destroy };
}

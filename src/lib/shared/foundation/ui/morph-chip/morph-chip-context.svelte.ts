/**
 * MorphChip Context
 *
 * Provides shared state between MorphChipGroup and MorphChip components.
 * Uses Svelte's Context API for parent-child communication.
 */

import { getContext, setContext } from "svelte";
import type { MorphChipContext } from "./types";

const MORPH_CHIP_CONTEXT_KEY = Symbol("morph-chip-context");

/**
 * Set the MorphChip context (called by MorphChipGroup)
 */
export function setMorphChipContext(ctx: MorphChipContext): void {
	setContext(MORPH_CHIP_CONTEXT_KEY, ctx);
}

/**
 * Get the MorphChip context (called by MorphChip)
 * Throws if used outside of a MorphChipGroup
 */
export function getMorphChipContext(): MorphChipContext {
	const ctx = getContext<MorphChipContext>(MORPH_CHIP_CONTEXT_KEY);
	if (!ctx) {
		throw new Error(
			"MorphChipContext not found. Ensure MorphChip is used within a MorphChipGroup."
		);
	}
	return ctx;
}

/**
 * Try to get the MorphChip context (returns null if not found)
 */
export function tryGetMorphChipContext(): MorphChipContext | null {
	return getContext<MorphChipContext>(MORPH_CHIP_CONTEXT_KEY) ?? null;
}

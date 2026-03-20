/**
 * Fuse Module Context
 *
 * Distributes fuse state to all descendant components via Svelte context.
 * Set once in FuseTab, consumed by any child component.
 */

import { getContext, setContext } from "svelte";
import type { FuseState } from "../state/fuse-state.svelte";

export interface FuseContext {
	state: FuseState;
}

const FUSE_CONTEXT_KEY = Symbol("fuse");

export function setFuseContext(context: FuseContext): void {
	setContext(FUSE_CONTEXT_KEY, context);
}

export function getFuseContext(): FuseContext {
	const context = getContext<FuseContext>(FUSE_CONTEXT_KEY);

	if (!context) {
		throw new Error(
			"FuseContext not found. Ensure you're calling getFuseContext() " +
				"within a component that is a descendant of FuseTab."
		);
	}

	return context;
}

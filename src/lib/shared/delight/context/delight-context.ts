/**
 * Delight Context
 *
 * Provides the DelightOrchestrator to child components via Svelte context.
 * Use getDelightOrchestrator() to access in any child component.
 */

import { getContext, setContext } from 'svelte';
import type { IDelightOrchestrator } from '../services/contracts/IDelightOrchestrator';

const DELIGHT_CONTEXT_KEY = Symbol('delight-orchestrator');

/**
 * Set the delight orchestrator in context.
 * Call this in the parent component that provides the delight system.
 */
export function setDelightOrchestrator(orchestrator: IDelightOrchestrator): void {
	setContext(DELIGHT_CONTEXT_KEY, orchestrator);
}

/**
 * Get the delight orchestrator from context.
 * Returns null if not provided (component is outside delight provider).
 */
export function getDelightOrchestrator(): IDelightOrchestrator | null {
	return getContext<IDelightOrchestrator | null>(DELIGHT_CONTEXT_KEY) ?? null;
}

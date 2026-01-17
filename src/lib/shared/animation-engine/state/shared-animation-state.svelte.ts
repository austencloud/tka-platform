/**
 * Shared Animation State
 *
 * Provides a global singleton animation state that can be shared across
 * different components (e.g., Create module AnimationCoordinator and SharePanel).
 *
 * This enables step grid synchronization when animations play in different contexts.
 */

import { createAnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

/**
 * Global shared animation state instance.
 * Used by Create module's AnimationCoordinator
 * to keep step grid selection in sync with animation playback.
 */
export const sharedAnimationState = createAnimationPanelState();

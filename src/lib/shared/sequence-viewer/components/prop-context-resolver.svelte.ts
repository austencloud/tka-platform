/**
 * PropContextResolver.svelte.ts
 *
 * Reactive module that resolves prop types for the viewer:
 * - Toggle between "notation" (user settings) vs "creator-expression" (creator's intent)
 * - Resolve presentation from getPresentationResolver()
 * - Sync active props to animation orchestrator
 * - State: contextOverride, activeContext
 *
 * Extracted from SequenceViewerOrchestrator.
 */

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { resolvePresentation as resolvePresentationFn } from "../services/presentation-resolver";
import { getSequenceAnimationOrchestrator } from "$lib/shared/animation-engine/get-sequence-animation-orchestrator";
import type { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { ResolvedPresentation, ViewingContext } from "../services/presentation-resolver";
export interface PropContextResolverDeps {
  /** @deprecated Not read internally - activeContext is resolved via getActiveContext() param. */
  viewingContext?: ViewingContext;
}

export function createPropContextResolver(_deps: PropContextResolverDeps) {
  let contextOverride = $state<ViewingContext | null>(null);

  function resolvePresentation(
    sequence: SequenceData | null,
    activeCtx: ViewingContext,
    bluePropType: PropType | undefined,
    redPropType: PropType | undefined,
    catDogModeEnabled: boolean | undefined,
  ): ResolvedPresentation {
    if (!sequence) {
      return {
        bluePropType: bluePropType ?? PropType.STAFF,
        redPropType: redPropType ?? PropType.STAFF,
        catDogMode: catDogModeEnabled ?? false,
        effortTimeline: null,
        source: "viewer-settings",
      };
    }
    return resolvePresentationFn(
      sequence,
      activeCtx,
      bluePropType ?? PropType.STAFF,
      redPropType ?? PropType.STAFF,
      catDogModeEnabled ?? false
    );
  }

  function togglePropContext(currentActiveContext: ViewingContext) {
    contextOverride = currentActiveContext === "creator-expression" ? "notation" : "creator-expression";
  }

  /**
   * Sync active props to animation orchestrator. Call from an $effect.
   */
  function syncPropsToOrchestrator(blueProp: PropType, redProp: PropType, animationServicesReady: boolean) {
    if (blueProp && redProp && animationServicesReady) {
      try {
        const orchestrator = getSequenceAnimationOrchestrator() as SequenceAnimationOrchestrator;
        orchestrator.updatePropTypes(blueProp, redProp);
      } catch {
        // Animation services not ready yet - will pick up correct props on init
      }
    }
  }

  return {
    get contextOverride() { return contextOverride; },
    getActiveContext(viewingContext: ViewingContext): ViewingContext {
      return contextOverride ?? viewingContext;
    },
    resolvePresentation,
    togglePropContext,
    syncPropsToOrchestrator,
  };
}

export type PropContextResolverState = ReturnType<typeof createPropContextResolver>;

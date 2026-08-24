import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import type { AnimationPropConfig } from "$lib/shared/animation-engine/domain/animation-prop-config";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * App players follow the prop choices in Settings. Standalone players can skip
 * this adapter and stay independent of the authenticated application graph.
 */
export function getViewerAnimationPropConfig(): AnimationPropConfig {
  const settings = getSettings();
  return {
    bluePropType: settings.bluePropType || settings.propType || PropType.STAFF,
    redPropType: settings.redPropType || settings.propType || PropType.STAFF,
  };
}

import type { AvatarInstanceState } from "./avatar-instance-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

/**
 * Resolves the prop type for a performer.
 *
 * Uses the cascade: performer override → viewer defaults → globalFallback.
 * The globalFallback only applies when performer itself is nullish (no
 * performer selected); otherwise effectiveProp already resolves through
 * the cascade.
 */
export function resolvePerformerProp(
  performer: AvatarInstanceState | null | undefined,
  globalFallback: PropType,
): PropType {
  return performer?.effectiveProp ?? globalFallback;
}

import type { AvatarInstanceState } from "./avatar-instance-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

/**
 * Resolves the prop type for a performer.
 *
 * Per spec §7.3, prop type is per-performer. When a performer has an explicit
 * prop setting, that wins. Otherwise falls back to the global prop type derived
 * from sequence metadata or user settings.
 */
export function resolvePerformerProp(
  performer: AvatarInstanceState | null | undefined,
  globalFallback: PropType,
): PropType {
  return performer?.settings.prop ?? globalFallback;
}

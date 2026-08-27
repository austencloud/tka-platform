import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { UserProfile } from "./models/enhanced-user-profile";

/**
 * The single precedence rule for a creator's displayed prop identity. An
 * explicit Profile prop wins. A single curated prop can represent the creator
 * without an extra decision. Multiple curated props intentionally have no
 * implicit favorite. activeProp remains a fallback for legacy profiles only.
 *
 * All display sites (creator cards, profile hero, group-by-prop sort) go
 * through this — never read favoriteProp/activeProp directly for display.
 */
export function getEffectiveProp(
  user: Pick<UserProfile, "favoriteProp" | "activeProp" | "propsISpinWith">
): PropType | null {
  if (user.favoriteProp) return user.favoriteProp;

  const curatedProps = user.propsISpinWith ?? [];
  if (curatedProps.length === 1) return curatedProps[0] ?? null;
  if (curatedProps.length > 1) return null;

  return user.activeProp ?? null;
}

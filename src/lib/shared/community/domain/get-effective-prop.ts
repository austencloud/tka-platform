import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { UserProfile } from "./models/enhanced-user-profile";

/**
 * The single precedence rule for a creator's displayed prop identity:
 * an explicit favorite (My Props drawer) wins over the prop inferred from
 * their settings (mirrored to users/{uid}.activeProp on settings save).
 *
 * All display sites (creator cards, profile hero, group-by-prop sort) go
 * through this — never read favoriteProp/activeProp directly for display.
 */
export function getEffectiveProp(
  user: Pick<UserProfile, "favoriteProp" | "activeProp">
): PropType | null {
  return user.favoriteProp ?? user.activeProp ?? null;
}

import { getEffectiveProp } from "$lib/shared/community/domain/get-effective-prop";
import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
import { formatLocationLabel } from "$lib/shared/presence/domain/models/presence-models";

/**
 * Match the details shown on creator cards. A search for "staff Chicago" should
 * find the same person the visible prop and location labels describe.
 */
export function matchesCreatorQuery(
  user: EnhancedUserProfile,
  query: string
): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const effectiveProp = getEffectiveProp(user);
  const propNames = [
    effectiveProp ? getPropTypeDisplayInfo(effectiveProp).label : "",
    ...(user.propsISpinWith ?? []).map(
      (prop) => getPropTypeDisplayInfo(prop).label
    ),
  ];
  const searchableText = [
    user.username,
    user.displayName,
    user.bio,
    user.pronouns,
    formatLocationLabel(user.location),
    ...propNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.every((term) => searchableText.includes(term));
}

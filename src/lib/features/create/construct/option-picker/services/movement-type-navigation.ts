import type { OrganizedSection } from "../domain/option-picker-types";
import { MOVEMENT_FAMILY_DESCRIPTORS } from "./section-title-formatter";

/**
 * A fixed four-panel shape keeps the chosen family stable while option data
 * refreshes. Empty families stay put so the UI can explain the empty result.
 */
export function buildMovementFamilyPanels(
  sections: OrganizedSection[]
): OrganizedSection[] {
  const byTitle = new Map(sections.map((section) => [section.title, section]));

  return MOVEMENT_FAMILY_DESCRIPTORS.map((family) => ({
    title: family.key,
    pictographs: family.memberKeys.flatMap(
      (type) => byTitle.get(type)?.pictographs ?? []
    ),
    type: family.memberKeys.length > 1 ? "grouped" : "section",
  }));
}

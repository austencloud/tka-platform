import type { OrganizedSection } from "../domain/option-picker-types";
import { LETTER_TYPE_GROUP_DESCRIPTORS } from "./section-title-formatter";

/**
 * A fixed four-panel shape keeps the chosen letter-type group stable while
 * option data refreshes. Empty groups stay put so the UI can explain the
 * empty result.
 */
export function buildLetterTypeGroupPanels(
  sections: OrganizedSection[]
): OrganizedSection[] {
  const byTitle = new Map(sections.map((section) => [section.title, section]));

  return LETTER_TYPE_GROUP_DESCRIPTORS.map((group) => ({
    title: group.key,
    pictographs: group.memberKeys.flatMap(
      (type) => byTitle.get(type)?.pictographs ?? []
    ),
    type: group.memberKeys.length > 1 ? "grouped" : "section",
  }));
}

import type { MajorLevel, UserKnowledgeOverlay } from "../types/curriculum.js";
import { getConceptById } from "./knowledge-helpers.js";

export function deriveUserOverlay(completedConceptIds: string[]): UserKnowledgeOverlay {
  const knownTerms = new Set<string>();
  let highestLevel = 0;
  let majorLevel: MajorLevel = 1;

  for (const conceptId of completedConceptIds) {
    const concept = getConceptById(conceptId);
    if (concept) {
      concept.terms.forEach((term) => knownTerms.add(term.toLowerCase()));

      const numericLevel = concept.level + concept.subLevel / 10;
      if (numericLevel > highestLevel) {
        highestLevel = numericLevel;
        majorLevel = concept.level;
      }
    }
  }

  return {
    knownTerms,
    completedConcepts: new Set(completedConceptIds),
    currentLevel: highestLevel,
    majorLevel,
  };
}

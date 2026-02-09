import type { KnowledgeConcept, MajorLevel, UserKnowledgeOverlay } from "../types/curriculum.js";
import { KNOWLEDGE_GRAPH } from "./knowledge-graph.js";

/** Get a concept by its ID */
export function getConceptById(id: string): KnowledgeConcept | undefined {
  return KNOWLEDGE_GRAPH.find((c) => c.id === id);
}

/** Get all concepts for a given major level */
export function getConceptsByLevel(level: MajorLevel): KnowledgeConcept[] {
  return KNOWLEDGE_GRAPH.filter((c) => c.level === level);
}

/** Check if a concept is unlocked given completed concept IDs */
export function isConceptUnlocked(conceptId: string, completedIds: Set<string>): boolean {
  const concept = getConceptById(conceptId);
  if (!concept) return false;
  return concept.prerequisites.every((prereq) => completedIds.has(prereq));
}

/** Get all terms available at a given set of completed concepts */
export function getAvailableTerms(completedIds: Set<string>): Set<string> {
  const terms = new Set<string>();
  for (const conceptId of completedIds) {
    const concept = getConceptById(conceptId);
    if (concept) {
      concept.terms.forEach((term) => terms.add(term.toLowerCase()));
    }
  }
  return terms;
}

/** Derive the numeric level from a concept ID (e.g., "1.3" → 1.3) */
export function getNumericLevel(conceptId: string): number {
  const concept = getConceptById(conceptId);
  if (!concept) return 0;
  return concept.level + concept.subLevel / 10;
}

/** Check if a term is known at the user's current level */
export function isTermKnown(term: string, overlay: UserKnowledgeOverlay): boolean {
  return overlay.knownTerms.has(term.toLowerCase());
}

/** Get the next concept to learn (first unlocked but incomplete) */
export function getNextConcept(completedIds: Set<string>): KnowledgeConcept | undefined {
  for (const concept of KNOWLEDGE_GRAPH) {
    if (!completedIds.has(concept.id) && isConceptUnlocked(concept.id, completedIds)) {
      return concept;
    }
  }
  return undefined;
}

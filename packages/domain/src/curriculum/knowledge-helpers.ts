import type { KnowledgeConcept, MajorLevel, UserKnowledgeOverlay } from "../types/curriculum.js";
import { KNOWLEDGE_GRAPH } from "./knowledge-graph.js";

export function getConceptById(id: string): KnowledgeConcept | undefined {
  return KNOWLEDGE_GRAPH.find((c) => c.id === id);
}

export function getConceptsByLevel(level: MajorLevel): KnowledgeConcept[] {
  return KNOWLEDGE_GRAPH.filter((c) => c.level === level);
}

export function isConceptUnlocked(conceptId: string, completedIds: Set<string>): boolean {
  const concept = getConceptById(conceptId);
  if (!concept) return false;
  return concept.prerequisites.every((prereq) => completedIds.has(prereq));
}

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

export function getNumericLevel(conceptId: string): number {
  const concept = getConceptById(conceptId);
  if (!concept) return 0;
  return concept.level + concept.subLevel / 10;
}

export function isTermKnown(term: string, overlay: UserKnowledgeOverlay): boolean {
  return overlay.knownTerms.has(term.toLowerCase());
}

export function getNextConcept(completedIds: Set<string>): KnowledgeConcept | undefined {
  for (const concept of KNOWLEDGE_GRAPH) {
    if (!completedIds.has(concept.id) && isConceptUnlocked(concept.id, completedIds)) {
      return concept;
    }
  }
  return undefined;
}

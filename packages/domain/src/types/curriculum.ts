export type MajorLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface KnowledgeConcept {
  /** Unique identifier, e.g., "1.1", "2.3" */
  id: string;
  /** Major TKA curriculum level (1-9) */
  level: MajorLevel;
  /** Sub-concept within the level */
  subLevel: number;
  /** Human-readable name */
  name: string;
  /** Concept IDs that must be completed first */
  prerequisites: string[];
  /** Domain terms this concept unlocks for explanations */
  terms: string[];
  /** Brief description of what this concept covers */
  description: string;
}

export interface UserKnowledgeOverlay {
  /** All domain terms the user has learned */
  knownTerms: Set<string>;
  /** Concept IDs the user has completed */
  completedConcepts: Set<string>;
  /** Highest concept level completed (e.g., 1.7, 2.3) */
  currentLevel: number;
  /** Major TKA level (1-9) */
  majorLevel: MajorLevel;
}

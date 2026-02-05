/**
 * Codex Letter Mapping Repository Interface
 * Handles letter mapping data access for the codex module
 */

import type { CodexLetterMapping } from "../../domain/models/codex-models";

export interface ICodexLetterMappingRepo {
  /**
   * Initialize the repository
   */
  initialize?(): Promise<void>;

  /**
   * Get all letter mappings
   */
  getAllLetters(): string[];

  /**
   * Get letter mapping by letter
   */
  getLetterMapping(letter: string): CodexLetterMapping | null;

  /**
   * Get all letter mappings
   */
  getAllMappings(): CodexLetterMapping[];

  /**
   * Search letter mappings
   */
  searchMappings(query: string): CodexLetterMapping[];
}

/**
 * Letter Mapping Repo Implementation
 *
 * Service implementation for letter mapping management and codex configuration.
 * Handles letter mappings, categories, and validation.
 */

import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  CodexConfig,
  CodexLetterMapping,
  CodexLetterRow,
} from "$lib/shared/learn/domain/codex-models";
import { createLetterMapping } from "$lib/shared/learn/domain/codex-models";

export class CodexLetterMappingRepo {
  private configuration: CodexConfig | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load codex configuration
      await this.loadCodexConfig();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize CodexLetterMappingRepo:", error);
      throw error;
    }
  }

  getLetterMapping(letter: string): CodexLetterMapping | null {
    if (!this.initialized || !this.configuration) {
      console.warn(
        "CodexLetterMappingRepo not initialized. Call initialize() first."
      );
      return null;
    }

    // Find letter mapping in configuration
    const letterMapping = this.configuration.letters[letter];
    if (letterMapping) {
      return letterMapping;
    }

    return null;
  }

  getLetterRows(): CodexLetterRow[] {
    if (!this.initialized || !this.configuration) {
      console.warn(
        "CodexLetterMappingRepo not initialized. Call initialize() first."
      );
      return [];
    }

    return this.configuration.rows;
  }

  getAllLetters(): string[] {
    if (!this.initialized || !this.configuration) {
      console.warn(
        "CodexLetterMappingRepo not initialized. Call initialize() first."
      );
      return [];
    }

    const letters: string[] = [];
    for (const letterKey in this.configuration.letters) {
      letters.push(letterKey);
    }

    return letters;
  }

  isValidLetter(letter: string): boolean {
    return this.getLetterMapping(letter) !== null;
  }

  private async loadCodexConfig(): Promise<void> {
    try {
      // Load from actual codex configuration file
      const response = await fetch("/data/learn/letter-mappings.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch letter mappings: ${response.status}`);
      }

      const data = await response.json();

      // Convert the JSON data to our internal format
      const letters: Record<string, CodexLetterMapping> = {};
      for (const [letter, mapping] of Object.entries(data.letters)) {
        const letterData = mapping as {
          startPosition: string;
          endPosition: string;
          blueMotion: string;
          redMotion: string;
        };
        letters[letter] = createLetterMapping({
          startPosition: letterData.startPosition,
          endPosition: letterData.endPosition,
          blueMotionType: this.mapMotionString(letterData.blueMotion),
          redMotionType: this.mapMotionString(letterData.redMotion),
        });
      }

      this.configuration = {
        version: "1.0.0",
        letters,
        rows: data.rows,
        categories: data.categories,
      };
    } catch (error) {
      console.error("Failed to load codex configuration:", error);
      throw error;
    }
  }

  private mapMotionString(motionString: string | unknown): MotionType {
    const motionStr =
      typeof motionString === "string" ? motionString : String(motionString);
    switch (motionStr.toLowerCase()) {
      case "pro":
        return MotionType.PRO;
      case "anti":
        return MotionType.ANTI;
      case "static":
        return MotionType.STATIC;
      case "dash":
        return MotionType.DASH;
      default:
        console.warn(`Unknown motion type: ${motionStr}, defaulting to PRO`);
        return MotionType.PRO;
    }
  }

  /**
   * Get all letter mappings
   */
  getAllMappings(): CodexLetterMapping[] {
    if (!this.configuration) {
      console.warn("Codex configuration not loaded");
      return [];
    }

    return Object.values(this.configuration.letters || {});
  }

  /**
   * Search letter mappings by query
   */
  searchMappings(query: string): CodexLetterMapping[] {
    if (!this.configuration) {
      console.warn("Codex configuration not loaded");
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: CodexLetterMapping[] = [];

    // Search through letters by key (letter name) and mapping properties
    for (const [letterKey, mapping] of Object.entries(
      this.configuration.letters || {}
    )) {
      if (
        letterKey.toLowerCase().includes(lowerQuery) ||
        mapping.startPosition.toLowerCase().includes(lowerQuery) ||
        mapping.endPosition.toLowerCase().includes(lowerQuery) ||
        mapping.blueMotionType.toString().toLowerCase().includes(lowerQuery) ||
        mapping.redMotionType.toString().toLowerCase().includes(lowerQuery)
      ) {
        results.push(mapping);
      }
    }

    return results;
  }
}
